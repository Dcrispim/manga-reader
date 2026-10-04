import { createTestDb } from '../../db/testDb';
import { downloads, diagLog, jobs } from '../../db/schema';
import { recordOpen } from '../../history/repo';
import { clearOpenChapter, chapterId, setOpenChapter } from '../../reader/openChapter';
import { setSetting } from '../../settings/repo';
import {
  chapterDir,
  chapterTmpDir,
  chapterXlTmpDir,
  commitChapter,
  deleteAll,
  deleteTitle,
  listDownloadedPages,
  reconcile,
  replaceChapterImages,
} from '../downloads';
import { memoryFileStore } from '../memoryFileStore';

async function stage(
  files: ReturnType<typeof memoryFileStore>,
  dir: string,
  n: number,
  bytes = 100,
) {
  for (let i = 1; i <= n; i++) {
    files.files.set(`${dir}/${String(i).padStart(3, '0')}.jpg`, bytes);
  }
}

async function save(
  db: ReturnType<typeof createTestDb>,
  files: ReturnType<typeof memoryFileStore>,
  title: string,
  chapter: string,
  bytes = 100,
) {
  await stage(files, chapterTmpDir(files, title, chapter), 3, bytes);
  return commitChapter(db, files, { title, chapter, pages: 3, quality: 'original' });
}

const rows = (db: ReturnType<typeof createTestDb>) =>
  db.select().from(downloads).all();

beforeEach(() => {
  clearOpenChapter();
  jest.useFakeTimers();
  jest.setSystemTime(1000);
});
afterEach(() => jest.useRealTimers());

describe('downloads storage', () => {
  it('commits atomically: tmp becomes the final dir and bytes are measured', async () => {
    const db = createTestDb();
    const files = memoryFileStore();
    expect(await save(db, files, 'A', '1', 50)).toBe(true);
    expect(await files.exists(chapterTmpDir(files, 'A', '1'))).toBe(false);
    expect(await files.exists(chapterDir(files, 'A', '1'))).toBe(true);
    expect(rows(db)).toEqual([
      expect.objectContaining({ title: 'A', chapter: '1', pages: 3, bytes: 150, savedAt: 1000 }),
    ]);
    expect(await listDownloadedPages(files, 'A', '1')).toHaveLength(3);
  });

  it('an incomplete tmp never appears in downloads', async () => {
    const db = createTestDb();
    const files = memoryFileStore();
    await stage(files, chapterTmpDir(files, 'A', '1'), 2);
    expect(rows(db)).toEqual([]);
    // Commit without a tmp fails cleanly and inserts nothing.
    expect(
      await commitChapter(db, files, { title: 'A', chapter: '9', pages: 1, quality: 'original' }),
    ).toBe(false);
    expect(rows(db)).toEqual([]);
  });

  it('evicts per title, oldest first, read chapters first', async () => {
    const db = createTestDb();
    const files = memoryFileStore();
    setSetting(db, 'space.maxPerTitle', '2');
    for (const [i, c] of ['1', '2', '3'].entries()) {
      jest.setSystemTime(1000 + i);
      await save(db, files, 'A', c);
    }
    // 3 saved with limit 2: oldest (1) goes.
    expect(rows(db).map((r) => r.chapter).sort()).toEqual(['2', '3']);
    // Mark 3 as read: the read one is evicted before the older unread 2.
    recordOpen(db, 'A', '3', 5);
    jest.setSystemTime(2000);
    await save(db, files, 'A', '4');
    expect(rows(db).map((r) => r.chapter).sort()).toEqual(['2', '4']);
    expect(await files.exists(chapterDir(files, 'A', '3'))).toBe(false);
    expect(
      db.select().from(diagLog).all().filter((l) => l.scope === 'space').length,
    ).toBe(2);
  });

  it('evicts globally', async () => {
    const db = createTestDb();
    const files = memoryFileStore();
    setSetting(db, 'space.maxGlobal', '2');
    for (const [i, t] of ['A', 'B', 'C'].entries()) {
      jest.setSystemTime(1000 + i);
      await save(db, files, t, '1');
    }
    expect(rows(db).map((r) => r.title).sort()).toEqual(['B', 'C']);
  });

  it('evicts by bytes', async () => {
    const db = createTestDb();
    const files = memoryFileStore();
    setSetting(db, 'space.maxBytes', '700');
    for (const [i, c] of ['1', '2', '3'].entries()) {
      jest.setSystemTime(1000 + i);
      await save(db, files, 'A', c, 100); // 300 bytes each
    }
    expect(rows(db).map((r) => r.chapter).sort()).toEqual(['2', '3']);
  });

  it('never evicts the just-saved or the open chapter', async () => {
    const db = createTestDb();
    const files = memoryFileStore();
    setSetting(db, 'space.maxPerTitle', '1');
    await save(db, files, 'A', '1');
    setOpenChapter('A', '1');
    jest.setSystemTime(2000);
    await save(db, files, 'A', '2');
    expect(rows(db).map((r) => r.chapter).sort()).toEqual(['1', '2']);
    expect(chapterId('A', '1')).toBe('A\u00001');
  });

  it('replaceChapterImages keeps saved_at and does not evict', async () => {
    const db = createTestDb();
    const files = memoryFileStore();
    await save(db, files, 'A', '1');
    setSetting(db, 'space.maxPerTitle', '0');
    jest.setSystemTime(9000);
    await stage(files, chapterXlTmpDir(files, 'A', '1'), 2, 500);
    expect(
      await replaceChapterImages(db, files, { title: 'A', chapter: '1', pages: 2, quality: 'xl' }),
    ).toBe(true);
    expect(rows(db)).toEqual([
      expect.objectContaining({ savedAt: 1000, pages: 2, bytes: 1000, quality: 'xl' }),
    ]);
    expect(await listDownloadedPages(files, 'A', '1')).toHaveLength(2);
    expect(await files.exists(chapterXlTmpDir(files, 'A', '1'))).toBe(false);
  });

  it('replaceChapterImages of a deleted chapter returns false and drops the tmp', async () => {
    const db = createTestDb();
    const files = memoryFileStore();
    await stage(files, chapterXlTmpDir(files, 'A', '1'), 2);
    expect(
      await replaceChapterImages(db, files, { title: 'A', chapter: '1', pages: 2, quality: 'xl' }),
    ).toBe(false);
    expect(await files.exists(chapterXlTmpDir(files, 'A', '1'))).toBe(false);
  });

  it('deleteTitle and deleteAll remove files and rows', async () => {
    const db = createTestDb();
    const files = memoryFileStore();
    await save(db, files, 'A', '1');
    await save(db, files, 'B', '1');
    await deleteTitle(db, files, 'A');
    expect(rows(db).map((r) => r.title)).toEqual(['B']);
    expect(await files.exists(chapterDir(files, 'A', '1'))).toBe(false);
    await deleteAll(db, files);
    expect(rows(db)).toEqual([]);
    expect(files.files.size).toBe(0);
  });

  it('reconcile drops dirs without a row', async () => {
    const db = createTestDb();
    const files = memoryFileStore();
    await stage(files, chapterDir(files, 'A', '7'), 2);
    await reconcile(db, files);
    expect(await files.exists(chapterDir(files, 'A', '7'))).toBe(false);
  });

  it('reconcile drops rows without a dir', async () => {
    const db = createTestDb();
    const files = memoryFileStore();
    await save(db, files, 'A', '1');
    await save(db, files, 'A', '2');
    await files.remove(chapterDir(files, 'A', '1'));
    await reconcile(db, files);
    expect(rows(db).map((r) => r.chapter)).toEqual(['2']);
  });

  it('reconcile keeps tmp dirs that have a job and drops the others', async () => {
    const db = createTestDb();
    const files = memoryFileStore();
    await stage(files, chapterTmpDir(files, 'A', '1'), 2);
    await stage(files, chapterTmpDir(files, 'A', '2'), 2);
    await stage(files, chapterXlTmpDir(files, 'A', '3'), 2);
    db.insert(jobs)
      .values({ kind: 'download', title: 'A', chapter: '1', state: 'paused', createdAt: 1 })
      .run();
    await reconcile(db, files);
    expect(await files.exists(chapterTmpDir(files, 'A', '1'))).toBe(true);
    expect(await files.exists(chapterTmpDir(files, 'A', '2'))).toBe(false);
    expect(await files.exists(chapterXlTmpDir(files, 'A', '3'))).toBe(false);
  });
});
