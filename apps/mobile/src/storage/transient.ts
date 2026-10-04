import { and, eq } from 'drizzle-orm';
import { DEFAULT_LIMITS, planLruEviction } from '@manga/core';

import { hashName } from '../catalog/hash';
import { chapterSources, transientPages } from '../db/schema';
import type { Db } from '../db/types';
import { log } from '../diag/log';
import { chapterId, getOpenChapterId } from '../reader/openChapter';
import { getSetting } from '../settings/repo';
import { chapterTmpDir, commitChapter, type Quality } from './downloads';
import type { FileStore } from './files';

/** The only part of the HTTP client the cache needs (easy to fake in tests). */
export interface UrlBuilder {
  url(pathOrRelative: string): string | null;
}

function transientRoot(files: FileStore): string {
  return `${files.cacheDirectory}/transient`;
}

export function transientChapterDir(files: FileStore, title: string, chapter: string): string {
  return `${transientRoot(files)}/${hashName(title)}/${chapter}`;
}

/**
 * Records the page count the server listed for a chapter in chapter_sources
 * (the canonical place), so completeness can be judged later while offline.
 * Creates the row when the catalog has none (degraded mode).
 */
export function setPageCount(db: Db, title: string, chapter: string, count: number): void {
  try {
    const where = and(
      eq(chapterSources.title, title),
      eq(chapterSources.chapter, chapter),
      eq(chapterSources.sourceId, 'server'),
    );
    const existing = db.select().from(chapterSources).where(where).get();
    if (existing) {
      db.update(chapterSources).set({ pages: count }).where(where).run();
    } else {
      db.insert(chapterSources)
        .values({
          title,
          chapter,
          sourceId: 'server',
          location: chapter,
          pages: count,
          mtimeMs: Date.now(),
        })
        .run();
    }
  } catch {
    // Best-effort bookkeeping.
  }
}

/** Server page count from chapter_sources; null when unknown. */
export function getPageCount(db: Db, title: string, chapter: string): number | null {
  try {
    const row = db
      .select({ pages: chapterSources.pages })
      .from(chapterSources)
      .where(
        and(
          eq(chapterSources.title, title),
          eq(chapterSources.chapter, chapter),
          eq(chapterSources.sourceId, 'server'),
        ),
      )
      .get();
    const n = row?.pages;
    return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function extOf(path: string): string {
  const name = path.split('?')[0].split('#')[0].split('/').pop() ?? '';
  const m = /\.([A-Za-z0-9]{1,5})$/.exec(name);
  return m ? m[1].toLowerCase() : 'jpg';
}

function maxBytes(db: Db): number {
  const raw = getSetting(db, 'space.transientMaxBytes');
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_LIMITS.transientMaxBytes;
}

function pageId(title: string, chapter: string, page: number): string {
  return `${chapterId(title, chapter)}\u0000${page}`;
}

/** LRU eviction over pages; the open chapter and the one being fetched are spared. */
async function enforceTransientLimit(
  db: Db,
  files: FileStore,
  keep: { title: string; chapter: string },
): Promise<void> {
  const rows = db.select().from(transientPages).all();
  const guarded = new Set([chapterId(keep.title, keep.chapter)]);
  const open = getOpenChapterId();
  if (open) guarded.add(open);
  const protectedIds = rows
    .filter((r) => guarded.has(chapterId(r.title, r.chapter)))
    .map((r) => pageId(r.title, r.chapter, r.page));
  const plan = new Set(
    planLruEviction(
      rows.map((r) => ({
        id: pageId(r.title, r.chapter, r.page),
        bytes: r.bytes,
        lastAccess: r.lastAccess,
      })),
      maxBytes(db),
      protectedIds,
    ),
  );
  for (const r of rows) {
    if (!plan.has(pageId(r.title, r.chapter, r.page))) continue;
    await files.remove(r.path);
    deleteRow(db, r.title, r.chapter, r.page);
  }
  if (plan.size > 0) log(db, 'info', 'space', `transient cache evicted ${plan.size} pages`);
}

function deleteRow(db: Db, title: string, chapter: string, page: number): void {
  db.delete(transientPages)
    .where(
      and(
        eq(transientPages.title, title),
        eq(transientPages.chapter, chapter),
        eq(transientPages.page, page),
      ),
    )
    .run();
}

export interface FetchToTransientInput {
  db: Db;
  files: FileStore;
  client: UrlBuilder;
  title: string;
  chapter: string;
  /** Zero-based page index. */
  page: number;
  /** Image path as listed by the server (relative). */
  imagePath: string;
}

/**
 * Downloads one remote page into the cache, records it and enforces the LRU
 * cap. Returns the local path, or null on any failure; never throws.
 */
export async function fetchToTransient(input: FetchToTransientInput): Promise<string | null> {
  const { db, files, client, title, chapter, page, imagePath } = input;
  try {
    const url = client.url(imagePath);
    if (!url) return null;
    const name = `${String(page + 1).padStart(3, '0')}.${extOf(imagePath)}`;
    const dir = transientChapterDir(files, title, chapter);
    const dest = `${dir}/${name}`;
    // The real file store does not create parent directories on download.
    await files.makeDir(dir);
    const r = await files.download(url, dest);
    if (!r.ok) {
      await files.remove(dest);
      return null;
    }
    db.insert(transientPages)
      .values({ title, chapter, page, path: dest, bytes: r.bytes, lastAccess: Date.now() })
      .onConflictDoUpdate({
        target: [transientPages.title, transientPages.chapter, transientPages.page],
        set: { path: dest, bytes: r.bytes, lastAccess: Date.now() },
      })
      .run();
    await enforceTransientLimit(db, files, { title, chapter });
    return dest;
  } catch {
    return null;
  }
}

/** Marks every cached page of a chapter as just used. */
export function touch(db: Db, title: string, chapter: string): void {
  try {
    db.update(transientPages)
      .set({ lastAccess: Date.now() })
      .where(and(eq(transientPages.title, title), eq(transientPages.chapter, chapter)))
      .run();
  } catch {
    // The cache is best-effort.
  }
}

export async function clearTransient(db: Db, files: FileStore): Promise<void> {
  await files.remove(transientRoot(files));
  db.delete(transientPages).run();
}

/** Cached pages of a chapter whose file is still on disk, by page index. */
export async function cachedPages(
  db: Db,
  files: FileStore,
  title: string,
  chapter: string,
): Promise<Map<number, string>> {
  const rows = db
    .select()
    .from(transientPages)
    .where(and(eq(transientPages.title, title), eq(transientPages.chapter, chapter)))
    .all();
  const out = new Map<number, string>();
  for (const r of rows) if (await files.exists(r.path)) out.set(r.page, r.path);
  return out;
}

export async function isChapterFullyCached(
  db: Db,
  files: FileStore,
  title: string,
  chapter: string,
  pageCount: number,
): Promise<boolean> {
  if (pageCount <= 0) return false;
  const cached = await cachedPages(db, files, title, chapter);
  for (let i = 0; i < pageCount; i++) if (!cached.has(i)) return false;
  return true;
}

/**
 * Brings the cache and SQLite back in sync (run at startup): files without a
 * row and rows without a file are dropped.
 */
export async function reconcileTransient(db: Db, files: FileStore): Promise<void> {
  const root = transientRoot(files);
  const rows = db.select().from(transientPages).all();
  const known = new Set(rows.map((r) => r.path));

  for (const hash of await files.listDir(root)) {
    const hashPath = `${root}/${hash}`;
    for (const chapter of await files.listDir(hashPath)) {
      const chapterPath = `${hashPath}/${chapter}`;
      for (const name of await files.listDir(chapterPath)) {
        const path = `${chapterPath}/${name}`;
        if (!known.has(path)) await files.remove(path);
      }
      if ((await files.listDir(chapterPath)).length === 0) await files.remove(chapterPath);
    }
    if ((await files.listDir(hashPath)).length === 0) await files.remove(hashPath);
  }

  for (const r of rows) {
    if (!(await files.exists(r.path))) deleteRow(db, r.title, r.chapter, r.page);
  }
}

/**
 * "Download" of a chapter that is fully cached: moves its pages into the
 * download tmp dir and commits, with no network. False if it is not complete
 * (the caller then downloads normally) or the move fails.
 */
export async function promoteToDownload(
  db: Db,
  files: FileStore,
  title: string,
  chapter: string,
  quality: Quality = 'original',
): Promise<boolean> {
  try {
    const count = getPageCount(db, title, chapter);
    if (count === null || !(await isChapterFullyCached(db, files, title, chapter, count))) {
      return false;
    }
    const cached = await cachedPages(db, files, title, chapter);
    const tmp = chapterTmpDir(files, title, chapter);
    await files.remove(tmp);
    await files.makeDir(tmp);
    let moved = true;
    for (let i = 0; i < count; i++) {
      const from = cached.get(i)!;
      const name = from.split('/').pop()!;
      if (!(await files.move(from, `${tmp}/${name}`))) {
        moved = false;
        break;
      }
    }
    // Whatever happened, the cache no longer owns these pages.
    db.delete(transientPages)
      .where(and(eq(transientPages.title, title), eq(transientPages.chapter, chapter)))
      .run();
    await files.remove(transientChapterDir(files, title, chapter));
    if (!moved) {
      await files.remove(tmp);
      return false;
    }
    return await commitChapter(db, files, { title, chapter, pages: count, quality });
  } catch {
    return false;
  }
}

/** Re-applies the LRU cap now (the user lowered it); spares only the open chapter. */
export async function enforceTransientNow(db: Db, files: FileStore): Promise<void> {
  const open = getOpenChapterId();
  const rows = db.select().from(transientPages).all();
  const guarded = new Set(open ? [open] : []);
  const protectedIds = rows
    .filter((r) => guarded.has(chapterId(r.title, r.chapter)))
    .map((r) => pageId(r.title, r.chapter, r.page));
  const plan = new Set(
    planLruEviction(
      rows.map((r) => ({
        id: pageId(r.title, r.chapter, r.page),
        bytes: r.bytes,
        lastAccess: r.lastAccess,
      })),
      maxBytes(db),
      protectedIds,
    ),
  );
  for (const r of rows) {
    if (!plan.has(pageId(r.title, r.chapter, r.page))) continue;
    await files.remove(r.path);
    deleteRow(db, r.title, r.chapter, r.page);
  }
  if (plan.size > 0) log(db, 'info', 'space', `transient cache evicted ${plan.size} pages`);
}
