import {
  CatalogResponseSchema,
  MetadataResponseSchema,
  ReadTitleResponseSchema,
  paths,
  type CatalogResponse,
  type CatalogTitle,
} from '@manga/api-contract';
import { chapterNumber } from '@manga/core';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import type { ZodSchema } from 'zod';

import { hashName } from '../catalog/hash';
import { chapterSources, downloads, settings, titles } from '../db/schema';
import type { Db } from '../db/types';
import { log } from '../diag/log';
import type { Result } from '../lib/result';
import { getServerState, hasFeature } from '../server/status';
import { getSetting } from '../settings/repo';
import type { FileStore } from '../storage/files';

import { SERVER_SOURCE } from './serverSource';

export { SERVER_SOURCE };
export const CURSOR_KEY = 'catalog.since';
// The first sync can carry ~80k chapters in one JSON body.
const CATALOG_TIMEOUT_MS = 60_000;
// Titles written between two yields to the event loop (keeps the UI alive).
const YIELD_EVERY = 5;

/** Slice of the net client the engine needs (easy to fake). */
export interface SyncClient {
  getJson: <T>(
    path: string,
    schema: ZodSchema,
    opts?: { timeoutMs?: number },
  ) => Promise<Result<T>>;
  url: (pathOrRelative: string) => string | null;
}

export interface SyncDeps {
  db: Db;
  client: SyncClient;
  files: FileStore;
  now?: () => number;
}

export type SyncSkipReason =
  | 'offline'
  | 'no-catalog-feature'
  | 'fetch-failed'
  | 'write-failed';

export type SyncOutcome = { changed: number } | { skipped: SyncSkipReason };

const yieldToEventLoop = () => new Promise<void>((r) => setTimeout(r, 0));

let inflight: Promise<SyncOutcome> | null = null;

/**
 * Incremental catalog sync (titles, server chapter_sources, covers). Never
 * throws. Two simultaneous calls share one run. The `catalog.since` cursor
 * only moves after every write of the response was applied; a mid-batch
 * failure leaves earlier titles saved and the cursor untouched, and the next
 * run redoes the work (idempotent).
 */
export function syncCatalog(deps: SyncDeps): Promise<SyncOutcome> {
  if (inflight) return inflight;
  const run = runSync(deps)
    .catch((err): SyncOutcome => {
      log(deps.db, 'error', 'sync.catalog', `unexpected: ${String(err)}`);
      return { skipped: 'write-failed' };
    })
    .finally(() => {
      inflight = null;
    });
  inflight = run;
  return run;
}

async function runSync(deps: SyncDeps): Promise<SyncOutcome> {
  const { db, client, files } = deps;
  const now = deps.now ?? Date.now;

  if (getServerState().status !== 'online') return { skipped: 'offline' };
  if (!hasFeature('catalog')) return { skipped: 'no-catalog-feature' };

  const since = Number(getSetting(db, CURSOR_KEY)) || 0;
  const res = await client.getJson<CatalogResponse>(
    paths.catalog(since),
    CatalogResponseSchema,
    { timeoutMs: CATALOG_TIMEOUT_MS },
  );
  if (!res.ok) return { skipped: 'fetch-failed' };
  const catalog = res.value;

  let changed = 0;
  try {
    let batch = 0;
    for (const title of catalog.titles) {
      writeTitle(db, title, now());
      changed++;
      await syncThumb(deps, title);
      if (++batch % YIELD_EVERY === 0) await yieldToEventLoop();
    }

    // Removals and the cursor commit together: the cursor never gets ahead of
    // the data it describes.
    const removedThumbs: string[] = [];
    db.transaction((tx) => {
      changed += removeVanished(tx as unknown as Db, catalog, removedThumbs);
      setCursor(tx as unknown as Db, catalog.serverTime);
    });
    for (const p of removedThumbs) await files.remove(p);
    await retryThumbs(deps);
  } catch (err) {
    log(db, 'error', 'sync.catalog', `write failed: ${String(err)}`);
    return { skipped: 'write-failed' };
  }
  return { changed };
}

function setCursor(db: Db, value: number): void {
  db.insert(settings)
    .values({ key: CURSOR_KEY, value: String(value) })
    .onConflictDoUpdate({ target: settings.key, set: { value: String(value) } })
    .run();
}

/** One title = one transaction; thumb columns are owned by syncThumb. */
function writeTitle(db: Db, t: CatalogTitle, at: number): void {
  db.transaction((tx) => {
    const metadataJson = JSON.stringify(t.metadata);
    const categoriesJson = JSON.stringify(t.categories);
    tx.insert(titles)
      .values({
        name: t.name,
        metadataJson,
        categoriesJson,
        serverMtime: t.mtimeMs,
        updatedAt: at,
      })
      .onConflictDoUpdate({
        target: titles.name,
        set: { metadataJson, categoriesJson, serverMtime: t.mtimeMs, updatedAt: at },
      })
      .run();
    tx.delete(chapterSources)
      .where(
        and(
          eq(chapterSources.title, t.name),
          eq(chapterSources.sourceId, SERVER_SOURCE),
        ),
      )
      .run();
    for (const c of t.chapters) {
      tx.insert(chapterSources)
        .values({
          title: t.name,
          chapter: String(c.number),
          sourceId: SERVER_SOURCE,
          location: c.id,
          pages: c.pages,
          mtimeMs: c.mtimeMs,
        })
        .run();
    }
  });
}

// Covers retried per cycle (titles whose last download failed).
const THUMB_RETRY_LIMIT = 20;

/** Downloads the cover only when its version changed; a failure keeps the old one. */
async function syncThumb(deps: SyncDeps, t: CatalogTitle): Promise<void> {
  const { db, files } = deps;
  if (!t.thumb) return;
  const row = db
    .select({ v: titles.thumbVersion, p: titles.thumbPath })
    .from(titles)
    .where(eq(titles.name, t.name))
    .get();
  if (row?.v === t.thumb.version && row.p && (await files.exists(row.p))) {
    db.update(titles)
      .set({ thumbUrl: null, thumbWantedVersion: null })
      .where(eq(titles.name, t.name))
      .run();
    return;
  }
  // Remember what we want before trying: a failed download is retried by
  // retryThumbs, since the incremental catalog will not send this title again.
  db.update(titles)
    .set({ thumbUrl: t.thumb.url, thumbWantedVersion: t.thumb.version })
    .where(eq(titles.name, t.name))
    .run();
  await downloadThumb(deps, t.name, t.thumb.url, t.thumb.version);
}

async function downloadThumb(
  deps: SyncDeps,
  name: string,
  rawUrl: string,
  version: string,
): Promise<void> {
  const { db, client, files } = deps;
  const url = /^https?:\/\//.test(rawUrl) ? rawUrl : client.url(rawUrl);
  if (!url) return;

  const dir = `${files.documentDirectory}/thumbs`;
  const dest = `${dir}/${hashName(name)}.jpg`;
  const tmp = `${dest}.tmp`;
  // Download to a temp name first so a broken transfer never replaces a good cover.
  await files.makeDir(dir);
  const dl = await files.download(url, tmp);
  if (!dl.ok || !(await files.move(tmp, dest))) {
    await files.remove(tmp);
    log(db, 'warn', 'sync.catalog', `cover download failed: ${name}`);
    return;
  }
  db.update(titles)
    .set({
      thumbVersion: version,
      thumbPath: dest,
      thumbUrl: null,
      thumbWantedVersion: null,
    })
    .where(eq(titles.name, name))
    .run();
}

/** Cheap pass over covers whose download failed earlier (bounded per cycle). */
async function retryThumbs(deps: SyncDeps): Promise<void> {
  const pending = deps.db
    .select({
      name: titles.name,
      url: titles.thumbUrl,
      version: titles.thumbWantedVersion,
    })
    .from(titles)
    .where(isNotNull(titles.thumbWantedVersion))
    .limit(THUMB_RETRY_LIMIT)
    .all();
  for (const p of pending) {
    if (p.url && p.version) await downloadThumb(deps, p.name, p.url, p.version);
  }
}

/**
 * Titles missing from allTitleNames lose their server chapter rows; the title
 * row itself goes only when no other source or download still references it.
 */
function removeVanished(
  db: Db,
  catalog: CatalogResponse,
  removedThumbs: string[],
): number {
  const alive = new Set(catalog.allTitleNames);
  const withServer = db
    .selectDistinct({ title: chapterSources.title })
    .from(chapterSources)
    .where(eq(chapterSources.sourceId, SERVER_SOURCE))
    .all()
    .map((r) => r.title)
    .filter((n) => !alive.has(n));
  const affected = new Set(withServer);
  if (withServer.length > 0) {
    db.delete(chapterSources)
      .where(
        and(
          eq(chapterSources.sourceId, SERVER_SOURCE),
          inArray(chapterSources.title, withServer),
        ),
      )
      .run();
  }

  for (const row of db.select().from(titles).all()) {
    if (alive.has(row.name)) continue;
    const hasSource = db
      .select({ t: chapterSources.title })
      .from(chapterSources)
      .where(eq(chapterSources.title, row.name))
      .limit(1)
      .get();
    const hasDownload = db
      .select({ t: downloads.title })
      .from(downloads)
      .where(eq(downloads.title, row.name))
      .limit(1)
      .get();
    if (hasSource || hasDownload) continue;
    db.delete(titles).where(eq(titles.name, row.name)).run();
    if (row.thumbPath) removedThumbs.push(row.thumbPath);
    affected.add(row.name);
  }
  return affected.size;
}

const onDemand = new Map<string, Promise<SyncOutcome>>();

/**
 * Degraded mode (server without the `catalog` feature): refresh one title from
 * /api/read/:title + /api/metadata/:title when its screen opens. `pages` stays
 * null (blind projection) and no cover is fetched. Never throws.
 */
export function syncTitleOnDemand(
  deps: Omit<SyncDeps, 'files'> & { files?: FileStore },
  title: string,
): Promise<SyncOutcome> {
  const existing = onDemand.get(title);
  if (existing) return existing;
  const run = runOnDemand(deps, title)
    .catch((err): SyncOutcome => {
      log(deps.db, 'error', 'sync.catalog', `on-demand failed: ${String(err)}`);
      return { skipped: 'write-failed' };
    })
    .finally(() => {
      onDemand.delete(title);
    });
  onDemand.set(title, run);
  return run;
}

async function runOnDemand(
  deps: Omit<SyncDeps, 'files'>,
  title: string,
): Promise<SyncOutcome> {
  const { db, client } = deps;
  const now = deps.now ?? Date.now;
  if (getServerState().status !== 'online') return { skipped: 'offline' };

  const read = await client.getJson<{
    chapters: string[];
    modified: Record<string, number>;
  }>(paths.readTitle(title), ReadTitleResponseSchema);
  if (!read.ok) return { skipped: 'fetch-failed' };
  // Metadata is best effort: without it the existing row content is kept.
  const meta = await client.getJson<{
    categories: string[];
    [k: string]: unknown;
  }>(paths.metadata(title), MetadataResponseSchema);

  const rows = new Map<string, { id: string; mtime: number }>();
  for (const id of read.value.chapters) {
    const n = chapterNumber(id);
    if (n === null) continue;
    rows.set(String(n), { id, mtime: read.value.modified[id] ?? 0 });
  }

  try {
    db.transaction((tx) => {
      const at = now();
      if (meta.ok) {
        const { thumbSource: _ts, ...metadata } = meta.value as Record<string, unknown>;
        void _ts;
        const metadataJson = JSON.stringify(metadata);
        const categoriesJson = JSON.stringify(meta.value.categories ?? []);
        tx.insert(titles)
          .values({ name: title, metadataJson, categoriesJson, updatedAt: at })
          .onConflictDoUpdate({
            target: titles.name,
            set: { metadataJson, categoriesJson, updatedAt: at },
          })
          .run();
      } else {
        tx.insert(titles)
          .values({ name: title, updatedAt: at })
          .onConflictDoUpdate({ target: titles.name, set: { updatedAt: at } })
          .run();
      }
      tx.delete(chapterSources)
        .where(
          and(
            eq(chapterSources.title, title),
            eq(chapterSources.sourceId, SERVER_SOURCE),
          ),
        )
        .run();
      for (const [chapter, r] of rows) {
        tx.insert(chapterSources)
          .values({
            title,
            chapter,
            sourceId: SERVER_SOURCE,
            location: r.id,
            pages: null,
            mtimeMs: r.mtime,
          })
          .run();
      }
    });
  } catch (err) {
    log(db, 'error', 'sync.catalog', `on-demand write failed: ${String(err)}`);
    return { skipped: 'write-failed' };
  }
  return { changed: 1 };
}
