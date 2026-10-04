import { and, eq } from 'drizzle-orm';
import { DEFAULT_LIMITS, planEviction, type StoredChapter } from '@manga/core';

import { hashName } from '../catalog/hash';
import { downloads, jobs } from '../db/schema';
import type { Db } from '../db/types';
import { log } from '../diag/log';
import { enqueue } from '../jobs/repo';
import { isRead } from '../history/repo';
import { chapterId, getOpenChapterId } from '../reader/openChapter';
import { getSetting } from '../settings/repo';
import type { FileStore } from './files';

export type Quality = 'original' | 'xl';

export interface ChapterInput {
  title: string;
  chapter: string;
  pages: number;
  quality: Quality;
}

const TMP = '.tmp';
const XL_TMP = '.xl.tmp';

function downloadsRoot(files: FileStore): string {
  return `${files.documentDirectory}/downloads`;
}

function titleDir(files: FileStore, title: string): string {
  return `${downloadsRoot(files)}/${hashName(title)}`;
}

/** Where the pages of a chapter are written while it downloads. */
export function chapterTmpDir(files: FileStore, title: string, chapter: string): string {
  return `${titleDir(files, title)}/${chapter}${TMP}`;
}

/** Where the high-res pages are written during an upgrade. */
export function chapterXlTmpDir(files: FileStore, title: string, chapter: string): string {
  return `${titleDir(files, title)}/${chapter}${XL_TMP}`;
}

/** Final location of a downloaded chapter. */
export function chapterDir(files: FileStore, title: string, chapter: string): string {
  return `${titleDir(files, title)}/${chapter}`;
}

function numSetting(db: Db, key: string, fallback: number): number {
  const raw = getSetting(db, key);
  if (raw === null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Renames the finished tmp dir to its final name, then (and only then) writes
 * the row: a half-written chapter never shows up as downloaded. Returns false
 * (and drops the tmp) if the rename fails.
 */
export async function commitChapter(
  db: Db,
  files: FileStore,
  input: ChapterInput,
): Promise<boolean> {
  const { title, chapter, pages, quality } = input;
  const tmp = chapterTmpDir(files, title, chapter);
  const dir = chapterDir(files, title, chapter);
  // A previous copy would otherwise be merged with the new pages.
  await files.remove(dir);
  if (!(await files.move(tmp, dir))) {
    await files.remove(tmp);
    return false;
  }
  const bytes = await files.size(dir);
  const savedAt = Date.now();
  db.insert(downloads)
    .values({ title, chapter, dir, pages, bytes, savedAt, quality })
    .onConflictDoUpdate({
      target: [downloads.title, downloads.chapter],
      set: { dir, pages, bytes, savedAt, quality },
    })
    .run();
  // Only original-quality chapters can be upgraded; an xl commit is final.
  if (quality === 'original' && getSetting(db, 'downloads.highRes') === 'true') {
    enqueue(db, 'upgrade', title, chapter);
  }
  const protectedIds = [chapterId(title, chapter)];
  const open = getOpenChapterId();
  if (open) protectedIds.push(open);
  await enforceSpace(db, files, protectedIds);
  return true;
}

/**
 * High-res upgrade: the `.xl` tmp dir replaces the pages. saved_at is kept
 * (the chapter is not "new") and no eviction runs. False if the chapter was
 * deleted meanwhile; the tmp is dropped.
 */
export async function replaceChapterImages(
  db: Db,
  files: FileStore,
  input: ChapterInput,
): Promise<boolean> {
  const { title, chapter, pages, quality } = input;
  const tmp = chapterXlTmpDir(files, title, chapter);
  const dir = chapterDir(files, title, chapter);
  const row = db
    .select()
    .from(downloads)
    .where(and(eq(downloads.title, title), eq(downloads.chapter, chapter)))
    .get();
  if (!row) {
    await files.remove(tmp);
    return false;
  }
  await files.remove(dir);
  if (!(await files.move(tmp, dir))) {
    await files.remove(tmp);
    // The old pages are gone too; drop the row so disk and DB agree.
    db.delete(downloads)
      .where(and(eq(downloads.title, title), eq(downloads.chapter, chapter)))
      .run();
    return false;
  }
  const bytes = await files.size(dir);
  db.update(downloads)
    .set({ dir, pages, bytes, quality })
    .where(and(eq(downloads.title, title), eq(downloads.chapter, chapter)))
    .run();
  return true;
}

export async function deleteChapter(
  db: Db,
  files: FileStore,
  title: string,
  chapter: string,
): Promise<void> {
  await files.remove(chapterDir(files, title, chapter));
  db.delete(downloads)
    .where(and(eq(downloads.title, title), eq(downloads.chapter, chapter)))
    .run();
}

export async function deleteTitle(db: Db, files: FileStore, title: string): Promise<void> {
  await files.remove(titleDir(files, title));
  db.delete(downloads).where(eq(downloads.title, title)).run();
}

export async function deleteAll(db: Db, files: FileStore): Promise<void> {
  await files.remove(downloadsRoot(files));
  db.delete(downloads).run();
}

/** Applies the core eviction plan; every eviction is recorded in diag_log. */
export async function enforceSpace(
  db: Db,
  files: FileStore,
  protectedIds: string[],
): Promise<void> {
  const rows = db.select().from(downloads).all();
  const stored: StoredChapter[] = rows.map((r) => ({
    id: chapterId(r.title, r.chapter),
    title: r.title,
    bytes: r.bytes,
    savedAt: r.savedAt,
    isRead: isRead(db, r.title, r.chapter),
  }));
  const limits = {
    maxPerTitle: numSetting(db, 'space.maxPerTitle', DEFAULT_LIMITS.maxPerTitle),
    maxGlobal: numSetting(db, 'space.maxGlobal', DEFAULT_LIMITS.maxGlobal),
    maxBytes: numSetting(db, 'space.maxBytes', DEFAULT_LIMITS.maxBytes),
  };
  const plan = new Set(planEviction(stored, limits, protectedIds));
  for (const r of rows) {
    if (!plan.has(chapterId(r.title, r.chapter))) continue;
    await deleteChapter(db, files, r.title, r.chapter);
    log(db, 'info', 'space', `evicted ${r.title} / ${r.chapter} (${r.bytes} bytes)`);
  }
}

/**
 * Brings disk and SQLite back in sync (run at startup): chapter dirs without a
 * row and rows without a dir are dropped. `*.tmp` dirs survive when a job can
 * still resume them, otherwise they are orphans and go.
 */
export async function reconcile(db: Db, files: FileStore): Promise<void> {
  const root = downloadsRoot(files);
  const rows = db.select().from(downloads).all();
  const knownDirs = new Set(rows.map((r) => r.dir));

  const jobKeys = new Set<string>();
  for (const j of db.select().from(jobs).all()) {
    if (j.state === 'done' || j.state === 'failed') continue;
    const suffix = j.kind === 'upgrade' ? XL_TMP : TMP;
    jobKeys.add(`${hashName(j.title)}/${j.chapter}${suffix}`);
  }

  for (const hash of await files.listDir(root)) {
    const hashPath = `${root}/${hash}`;
    for (const name of await files.listDir(hashPath)) {
      const path = `${hashPath}/${name}`;
      if (name.endsWith(TMP)) {
        if (!jobKeys.has(`${hash}/${name}`)) await files.remove(path);
      } else if (!knownDirs.has(path)) {
        await files.remove(path);
      }
    }
    if ((await files.listDir(hashPath)).length === 0) await files.remove(hashPath);
  }

  for (const r of rows) {
    if (!(await files.exists(r.dir))) {
      db.delete(downloads)
        .where(and(eq(downloads.title, r.title), eq(downloads.chapter, r.chapter)))
        .run();
    }
  }
}

/** Page file paths of a downloaded chapter, in reading order. */
export async function listDownloadedPages(
  files: FileStore,
  title: string,
  chapter: string,
): Promise<string[]> {
  const dir = chapterDir(files, title, chapter);
  const names = await files.listDir(dir);
  names.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return names.map((n) => `${dir}/${n}`);
}
