import { chapterSources, downloads, history, sources, titles } from '../../db/schema';
import { createTestDb } from '../../db/testDb';
import { memoryFileStore } from '../../storage/memoryFileStore';
import { clearCatalog, thumbsDir } from '../catalogReset';
import { getSetting, setSetting } from '../repo';

describe('clearCatalog', () => {
  it('removes only unused titles and covers; keeps used ones intact', async () => {
    const db = createTestDb();
    const files = memoryFileStore();
    const names = ['dl', 'hist', 'saf', 'only'];
    for (const n of names) {
      db.insert(titles).values({ name: n, updatedAt: 1, thumbPath: `${thumbsDir(files)}/${n}.jpg` }).run();
      files.files.set(`${thumbsDir(files)}/${n}.jpg`, 5);
      db.insert(chapterSources)
        .values({ title: n, chapter: '1', sourceId: 'server', location: '1', mtimeMs: 1 })
        .run();
    }
    db.insert(sources).values({ id: 'saf1', kind: 'saf', root: 'content://x' }).run();
    db.insert(chapterSources)
      .values({ title: 'saf', chapter: '1', sourceId: 'saf1', location: 'content://x', mtimeMs: 1 })
      .run();
    db.insert(downloads)
      .values({ title: 'dl', chapter: '1', dir: 'd', pages: 1, bytes: 10, savedAt: 1, quality: 'original' })
      .run();
    db.insert(history).values({ title: 'hist', chapter: '1', openedAt: 1 }).run();
    setSetting(db, 'catalog.since', '999');

    await clearCatalog(db, files);

    const left = db.select().from(titles).all();
    expect(left.map((t) => t.name).sort()).toEqual(['dl', 'hist', 'saf']);
    for (const t of left) {
      expect(t.thumbPath).toBe(`${thumbsDir(files)}/${t.name}.jpg`);
      expect(files.files.has(t.thumbPath!)).toBe(true);
    }
    expect(files.files.has(`${thumbsDir(files)}/only.jpg`)).toBe(false);
    expect(db.select().from(chapterSources).all().map((r) => r.sourceId)).toEqual(['saf1']);
    expect(db.select().from(sources).all().map((r) => r.id).sort()).toEqual(['saf1', 'server']);
    expect(db.select().from(downloads).all()).toHaveLength(1);
    expect(db.select().from(history).all()).toHaveLength(1);
    expect(getSetting(db, 'catalog.since')).toBe('0');
  });
});
