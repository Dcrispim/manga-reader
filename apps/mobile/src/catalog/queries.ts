import { buildCategoryMap, getLatestChapter, type CategoryMap } from '@manga/core';
import { count, eq } from 'drizzle-orm';

import {
  chapterSources,
  downloads,
  history,
  jobs,
  titles,
  transientPages,
} from '../db/schema';
import type { Db } from '../db/types';
import { SERVER_SOURCE } from '../sync/serverSource';

// Query builders (no .all()) so the screens can wrap them in useLiveQuery and
// the tests can run the very same statements; the shaping is in pure functions
// below, fed with the raw rows.

export const q = {
  titles: (db: Db) => db.select().from(titles),
  chapterCounts: (db: Db) =>
    db
      .select({ title: chapterSources.title, n: count() })
      .from(chapterSources)
      .groupBy(chapterSources.title),
  history: (db: Db) => db.select().from(history),
  downloads: (db: Db) =>
    db
      .select({ title: downloads.title, chapter: downloads.chapter, savedAt: downloads.savedAt })
      .from(downloads),
  titleTitles: (db: Db, name: string) => db.select().from(titles).where(eq(titles.name, name)),
  sources: (db: Db, name: string) =>
    db.select().from(chapterSources).where(eq(chapterSources.title, name)),
  titleDownloads: (db: Db, name: string) =>
    db.select().from(downloads).where(eq(downloads.title, name)),
  titleTransient: (db: Db, name: string) =>
    db
      .select({ chapter: transientPages.chapter, page: transientPages.page })
      .from(transientPages)
      .where(eq(transientPages.title, name)),
  titleJobs: (db: Db, name: string) => db.select().from(jobs).where(eq(jobs.title, name)),
  titleHistory: (db: Db, name: string) => db.select().from(history).where(eq(history.title, name)),
};

type TitleRow = typeof titles.$inferSelect;

export interface TitleMeta {
  author?: string;
  authors?: string;
  status?: string;
  type?: string;
  demographic?: string;
  published?: string;
  volumes?: string;
  description?: string;
}

export interface CatalogTitle {
  name: string;
  thumbPath: string | null;
  categories: string[];
  caps: number;
  modifiedAt: number;
  meta: TitleMeta;
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Titles with their parsed metadata and chapter count (for the category rules). */
export function buildCatalog(
  rows: TitleRow[],
  counts: { title: string; n: number }[],
): CatalogTitle[] {
  const caps = new Map(counts.map((c) => [c.title, c.n]));
  return rows.map((r) => {
    const cats = parseJson<unknown>(r.categoriesJson, []);
    return {
      name: r.name,
      thumbPath: r.thumbPath,
      categories: Array.isArray(cats) ? cats.filter((c): c is string => typeof c === 'string') : [],
      caps: caps.get(r.name) ?? 0,
      modifiedAt: r.serverMtime ?? r.updatedAt,
      meta: parseJson<TitleMeta>(r.metadataJson, {}),
    };
  });
}

export function categoriesOf(catalog: CatalogTitle[]): CategoryMap {
  return buildCategoryMap(
    catalog.map((t) => ({
      name: t.name,
      modifiedAt: t.modifiedAt,
      caps: t.caps,
      categories: t.categories,
    })),
  );
}

export interface ContinueItem {
  title: string;
  chapter: string;
  lastRead: number;
}

/** "Continuar lendo": titles by most recent open, with core's latest chapter. */
export function continueReading(
  rows: { title: string; chapter: string; openedAt: number }[],
  known: Set<string>,
  limit = 20,
): ContinueItem[] {
  const byTitle = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!known.has(r.title)) continue;
    const list = byTitle.get(r.title) ?? [];
    list.push(r);
    byTitle.set(r.title, list);
  }
  const out: ContinueItem[] = [];
  for (const [title, list] of byTitle) {
    const openedAt: Record<string, number> = {};
    for (const r of list) openedAt[r.chapter] = r.openedAt;
    const lastRead = Math.max(...list.map((r) => r.openedAt));
    const chapter = getLatestChapter({
      lastRead,
      history: Object.keys(openedAt),
      openedAt,
    });
    if (chapter) out.push({ title, chapter, lastRead });
  }
  return out.sort((a, b) => b.lastRead - a.lastRead).slice(0, limit);
}

/** Titles that have at least one downloaded chapter, newest download first. */
export function downloadedTitles(
  rows: { title: string; savedAt: number }[],
  known: Set<string>,
): string[] {
  const last = new Map<string, number>();
  for (const r of rows) last.set(r.title, Math.max(last.get(r.title) ?? 0, r.savedAt));
  return [...last.entries()]
    .filter(([t]) => known.has(t))
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);
}

export type ChapterBadge =
  | { kind: 'local' }
  | { kind: 'downloaded' }
  | { kind: 'queued'; done: number; total: number | null }
  | { kind: 'waiting-space' }
  | { kind: 'cached' }
  | { kind: 'none' };

export interface ChapterRow {
  chapter: string;
  number: number;
  pages: number | null;
  read: boolean;
  badge: ChapterBadge;
  /** True when a server copy exists, so "Baixar" makes sense. */
  onServer: boolean;
  /** Latest modification time among its sources (0 when unknown). */
  mtimeMs: number;
}

export interface ChapterInputs {
  sources: { chapter: string; sourceId: string; pages: number | null; mtimeMs?: number | null }[];
  downloads: { chapter: string }[];
  transient: { chapter: string }[];
  jobs: {
    kind: string;
    chapter: string;
    state: string;
    pagesDone: number;
    pagesTotal: number | null;
  }[];
  history: { chapter: string }[];
}

/**
 * One row per chapter, highest number first. Badge priority: a local source
 * beats a download, which beats an active job, which beats the read cache.
 */
export function chapterRows(input: ChapterInputs, ascending = false): ChapterRow[] {
  const downloaded = new Set(input.downloads.map((d) => d.chapter));
  const cached = new Set(input.transient.map((t) => t.chapter));
  const read = new Set(input.history.map((h) => h.chapter));
  const activeJobs = new Map<string, ChapterInputs['jobs'][number]>();
  for (const j of input.jobs) {
    if (j.kind === 'download' && ['queued', 'running', 'paused'].includes(j.state)) {
      activeJobs.set(j.chapter, j);
    }
  }

  const byChapter = new Map<
    string,
    { pages: number | null; local: boolean; server: boolean; mtimeMs: number }
  >();
  for (const s of input.sources) {
    const e = byChapter.get(s.chapter) ?? { pages: null, local: false, server: false, mtimeMs: 0 };
    e.pages = e.pages ?? s.pages;
    e.mtimeMs = Math.max(e.mtimeMs, s.mtimeMs ?? 0);
    if (s.sourceId === SERVER_SOURCE) e.server = true;
    else e.local = true;
    byChapter.set(s.chapter, e);
  }
  // A downloaded chapter stays listed even if its server rows vanished.
  for (const c of downloaded) {
    if (!byChapter.has(c)) byChapter.set(c, { pages: null, local: false, server: false, mtimeMs: 0 });
  }

  const rows: ChapterRow[] = [];
  for (const [chapter, e] of byChapter) {
    const job = activeJobs.get(chapter);
    let badge: ChapterBadge = { kind: 'none' };
    if (e.local) badge = { kind: 'local' };
    else if (downloaded.has(chapter)) badge = { kind: 'downloaded' };
    else if (job?.state === 'paused') badge = { kind: 'waiting-space' };
    else if (job) badge = { kind: 'queued', done: job.pagesDone, total: job.pagesTotal ?? e.pages };
    else if (cached.has(chapter)) badge = { kind: 'cached' };
    rows.push({
      chapter,
      number: parseFloat(chapter),
      pages: e.pages,
      read: read.has(chapter),
      badge,
      onServer: e.server,
      mtimeMs: e.mtimeMs,
    });
  }
  rows.sort((a, b) => (ascending ? a.number - b.number : b.number - a.number));
  return rows;
}

export function badgeLabel(b: ChapterBadge): string | null {
  switch (b.kind) {
    case 'local':
      return 'local';
    case 'downloaded':
      return 'baixado';
    case 'cached':
      return 'em cache';
    case 'waiting-space':
      return 'aguardando espaço';
    case 'queued':
      return `na fila (${b.done}/${b.total ?? '?'})`;
    default:
      return null;
  }
}

/** Grid columns: ~3 on a phone, 6 to 8 on a tablet. */
export function gridColumns(width: number): number {
  return Math.max(2, Math.floor(width / 130));
}
