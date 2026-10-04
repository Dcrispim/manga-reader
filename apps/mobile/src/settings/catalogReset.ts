import { and, eq } from 'drizzle-orm';

import { chapterSources, downloads, history, titles } from '../db/schema';
import type { Db } from '../db/types';
import { log } from '../diag/log';
import type { FileStore } from '../storage/files';
import { CURSOR_KEY, SERVER_SOURCE } from '../sync/catalog';
import { setSetting } from './repo';

/** Where the catalog sync keeps the covers (see sync/catalog.ts). */
export function thumbsDir(files: FileStore): string {
  return `${files.documentDirectory}/thumbs`;
}

/**
 * "Limpar catálogo": drops the server's chapter_sources, then only the titles
 * nothing else needs (no other source, download or history) together with their
 * covers, and rewinds the cursor so the next cycle resyncs everything. Titles
 * still in use keep their metadata and cover.
 */
export async function clearCatalog(db: Db, files: FileStore): Promise<void> {
  db.delete(chapterSources).where(and(eq(chapterSources.sourceId, SERVER_SOURCE))).run();
  const keep = new Set<string>();
  for (const r of db.select({ t: chapterSources.title }).from(chapterSources).all()) keep.add(r.t);
  for (const r of db.select({ t: downloads.title }).from(downloads).all()) keep.add(r.t);
  for (const r of db.select({ t: history.title }).from(history).all()) keep.add(r.t);
  for (const t of db.select().from(titles).all()) {
    if (keep.has(t.name)) continue;
    if (t.thumbPath) await files.remove(t.thumbPath);
    db.delete(titles).where(eq(titles.name, t.name)).run();
  }
  setSetting(db, CURSOR_KEY, '0');
  log(db, 'info', 'settings', 'catalog cleared');
}
