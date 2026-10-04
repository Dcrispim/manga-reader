import { createTestDb } from '../../db/testDb';
import { chapterSources, downloads, settings, transientPages } from '../../db/schema';
import { clearOpenChapter, setOpenChapter } from '../../reader/openChapter';
import { setSetting } from '../../settings/repo';
import { chapterDir } from '../downloads';
import { memoryFileStore } from '../memoryFileStore';
import {
  clearTransient,
  fetchToTransient,
  isChapterFullyCached,
  promoteToDownload,
  reconcileTransient,
  setPageCount,
  getPageCount,
  touch,
  transientChapterDir,
} from '../transient';

const client = { url: (p: string) => `http://srv${p.startsWith('/') ? '' : '/'}${p}` };
const rows = (db: ReturnType<typeof createTestDb>) => db.select().from(transientPages).all();

async function fetchPages(
  db: ReturnType<typeof createTestDb>,
  files: ReturnType<typeof memoryFileStore>,
  title: string,
  chapter: string,
  n: number,
) {
  for (let i = 0; i < n; i++) {
    await fetchToTransient({ db, files, client, title, chapter, page: i, imagePath: `/img/${i}.png` });
  }
}

beforeEach(() => {
  clearOpenChapter();
  jest.useFakeTimers();
  jest.setSystemTime(1000);
});
afterEach(() => jest.useRealTimers());

describe('fetchToTransient', () => {
  it('stores the page under cacheDirectory and records it', async () => {
    const db = createTestDb();
    const files = memoryFileStore();
    const path = await fetchToTransient({
      db, files, client, title: 'T', chapter: '1', page: 0, imagePath: '/img/a.png?x=1',
    });
    expect(path).toBe(`${transientChapterDir(files, 'T', '1')}/001.png`);
    expect(path!.startsWith('memory://cache/transient/')).toBe(true);
    expect(rows(db)).toHaveLength(1);
    expect(files.files.has(path!)).toBe(true);
  });

  it('returns null without throwing when the download fails', async () => {
    const db = createTestDb();
    const files = memoryFileStore({ downloader: () => ({ ok: false, bytes: 0 }) });
    const path = await fetchToTransient({
      db, files, client, title: 'T', chapter: '1', page: 0, imagePath: '/a.jpg',
    });
    expect(path).toBeNull();
    expect(rows(db)).toHaveLength(0);
    expect(files.files.size).toBe(0);
  });

  it('returns null when the downloader throws', async () => {
    const db = createTestDb();
    const files = memoryFileStore({
      downloader: () => {
        throw new Error('boom');
      },
    });
    await expect(
      fetchToTransient({ db, files, client, title: 'T', chapter: '1', page: 0, imagePath: '/a.jpg' }),
    ).resolves.toBeNull();
  });

  it('evicts least recently used pages above the cap (default 300 MB)', async () => {
    const db = createTestDb();
    const files = memoryFileStore({ downloader: () => ({ ok: true, bytes: 100_000_000 }) });
    for (let c = 1; c <= 4; c++) {
      jest.setSystemTime(1000 * c);
      await fetchPages(db, files, 'T', String(c), 1);
    }
    const left = rows(db).map((r) => r.chapter).sort();
    expect(left).toEqual(['2', '3', '4']);
    expect([...files.files.keys()].some((k) => k.includes('/1/'))).toBe(false);
  });

  it('honours space.transientMaxBytes and protects the open chapter', async () => {
    const db = createTestDb();
    setSetting(db, 'space.transientMaxBytes', '250');
    const files = memoryFileStore({ downloader: () => ({ ok: true, bytes: 100 }) });
    setOpenChapter('T', 'open');
    jest.setSystemTime(500);
    await fetchPages(db, files, 'T', 'open', 2);
    jest.setSystemTime(1000);
    await fetchPages(db, files, 'T', 'old', 2);
    jest.setSystemTime(3000);
    await fetchPages(db, files, 'T', 'b', 1);
    // The open chapter is the least recently used but is spared; 'old' goes.
    const count = (c: string) => rows(db).filter((r) => r.chapter === c).length;
    expect([count('open'), count('old'), count('b')]).toEqual([2, 0, 1]);
  });
});

describe('touch / isChapterFullyCached / clear', () => {
  it('touch refreshes last_access', async () => {
    const db = createTestDb();
    const files = memoryFileStore();
    await fetchPages(db, files, 'T', '1', 2);
    jest.setSystemTime(9000);
    touch(db, 'T', '1');
    expect(rows(db).every((r) => r.lastAccess === 9000)).toBe(true);
  });

  it('reports full vs partial', async () => {
    const db = createTestDb();
    const files = memoryFileStore();
    await fetchPages(db, files, 'T', '1', 2);
    expect(await isChapterFullyCached(db, files, 'T', '1', 2)).toBe(true);
    expect(await isChapterFullyCached(db, files, 'T', '1', 3)).toBe(false);
  });

  it('clearTransient wipes files and rows', async () => {
    const db = createTestDb();
    const files = memoryFileStore();
    await fetchPages(db, files, 'T', '1', 2);
    await clearTransient(db, files);
    expect(rows(db)).toHaveLength(0);
    expect(files.files.size).toBe(0);
  });
});

describe('reconcileTransient', () => {
  it('drops files without a row and rows without a file', async () => {
    const db = createTestDb();
    const files = memoryFileStore();
    await fetchPages(db, files, 'T', '1', 2);
    const dir = transientChapterDir(files, 'T', '1');
    files.files.set(`${dir}/orphan.jpg`, 5);
    files.files.delete(`${dir}/002.png`);
    await reconcileTransient(db, files);
    expect(files.files.has(`${dir}/orphan.jpg`)).toBe(false);
    expect(files.files.has(`${dir}/001.png`)).toBe(true);
    expect(rows(db).map((r) => r.page)).toEqual([0]);
  });
});

describe('promoteToDownload', () => {
  it('moves a complete chapter into downloads without network', async () => {
    const db = createTestDb();
    const files = memoryFileStore();
    await fetchPages(db, files, 'T', '1', 3);
    setPageCount(db, 'T', '1', 3);
    const before = files.downloadLog.length;
    expect(await promoteToDownload(db, files, 'T', '1')).toBe(true);
    expect(files.downloadLog.length).toBe(before);
    expect(rows(db)).toHaveLength(0);
    const dir = chapterDir(files, 'T', '1');
    expect(await files.listDir(dir)).toHaveLength(3);
    expect(db.select().from(downloads).all()).toHaveLength(1);
    expect([...files.files.keys()].some((k) => k.startsWith('memory://cache'))).toBe(false);
  });

  it('refuses a partial chapter and leaves the cache alone', async () => {
    const db = createTestDb();
    const files = memoryFileStore();
    await fetchPages(db, files, 'T', '1', 2);
    setPageCount(db, 'T', '1', 3);
    expect(await promoteToDownload(db, files, 'T', '1')).toBe(false);
    expect(rows(db)).toHaveLength(2);
    expect(db.select().from(downloads).all()).toHaveLength(0);
  });
});

describe('page count storage', () => {
  it('creates, then updates the server row in chapter_sources, never in settings', () => {
    const db = createTestDb();
    expect(getPageCount(db, 'T', '1')).toBeNull();
    setPageCount(db, 'T', '1', 3);
    setPageCount(db, 'T', '1', 5);
    const src = db.select().from(chapterSources).all();
    expect(src).toHaveLength(1);
    expect(src[0]).toMatchObject({ sourceId: 'server', location: '1', pages: 5 });
    expect(getPageCount(db, 'T', '1')).toBe(5);
    expect(
      db.select().from(settings).all().some((r) => r.key.startsWith('transient.pages:')),
    ).toBe(false);
  });

  it('keeps the existing row location when updating', () => {
    const db = createTestDb();
    db.insert(chapterSources)
      .values({ title: 'T', chapter: '1', sourceId: 'server', location: 'abc', pages: null, mtimeMs: 1 })
      .run();
    setPageCount(db, 'T', '1', 4);
    expect(db.select().from(chapterSources).all()[0]).toMatchObject({ location: 'abc', pages: 4 });
  });
});
