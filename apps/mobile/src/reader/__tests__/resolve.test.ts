import { createTestDb } from '../../db/testDb';
import { setSetting } from '../../settings/repo';
import { chapterTmpDir, commitChapter } from '../../storage/downloads';
import { memoryFileStore } from '../../storage/memoryFileStore';
import { fetchToTransient, setPageCount } from '../../storage/transient';
import { resolveChapterPages, setLocalPageProvider, type ResolverClient } from '../resolve';

function fakeClient(images: string[] | null, xl: string[] | null = null): ResolverClient {
  return {
    url: (p) => `http://srv${p}`,
    getJson: (async (path: string) => {
      const list = path.endsWith('/xl') ? xl : images;
      if (!list) return { ok: false, reason: path.endsWith('/xl') ? 'http' : 'unreachable', status: 404 };
      return { ok: true, value: { images: list } };
    }) as ResolverClient['getJson'],
  };
}

const IMGS = ['/a/1.jpg', '/a/2.jpg', '/a/3.jpg'];

async function cache(
  db: ReturnType<typeof createTestDb>,
  files: ReturnType<typeof memoryFileStore>,
  n: number,
) {
  for (let i = 0; i < n; i++) {
    await fetchToTransient({
      db, files, client: { url: (p) => `http://srv${p}` }, title: 'T', chapter: '1', page: i, imagePath: IMGS[i],
    });
  }
}

beforeEach(() => setLocalPageProvider(async () => null));

describe('resolveChapterPages', () => {
  it('prefers a local source over everything', async () => {
    const db = createTestDb();
    const files = memoryFileStore();
    setLocalPageProvider(async () => ['saf://1', 'saf://2']);
    const r = await resolveChapterPages({
      db, files, client: fakeClient(IMGS), title: 'T', chapter: '1', quality: 'original',
    });
    expect(r).toEqual({
      pages: [
        { kind: 'local', uri: 'saf://1', index: 0 },
        { kind: 'local', uri: 'saf://2', index: 1 },
      ],
    });
  });

  it('prefers download over transient and remote', async () => {
    const db = createTestDb();
    const files = memoryFileStore();
    const tmp = chapterTmpDir(files, 'T', '1');
    for (let i = 1; i <= 3; i++) files.files.set(`${tmp}/00${i}.jpg`, 10);
    await commitChapter(db, files, { title: 'T', chapter: '1', pages: 3, quality: 'original' });
    await cache(db, files, 3);
    setPageCount(db, 'T', '1', 3);
    const r = await resolveChapterPages({
      db, files, client: fakeClient(IMGS), title: 'T', chapter: '1', quality: 'original',
    });
    expect('pages' in r && r.pages.map((p) => p.kind)).toEqual(['download', 'download', 'download']);
  });

  it('uses a complete transient cache even offline', async () => {
    const db = createTestDb();
    const files = memoryFileStore();
    await cache(db, files, 3);
    setPageCount(db, 'T', '1', 3);
    const r = await resolveChapterPages({
      db, files, client: fakeClient(null), title: 'T', chapter: '1', quality: 'original',
    });
    expect('pages' in r && r.pages.map((p) => p.kind)).toEqual(['transient', 'transient', 'transient']);
  });

  it('mixes transient and remote when online with a partial cache', async () => {
    const db = createTestDb();
    const files = memoryFileStore();
    await cache(db, files, 1);
    const r = await resolveChapterPages({
      db, files, client: fakeClient(IMGS), title: 'T', chapter: '1', quality: 'original',
    });
    expect('pages' in r && r.pages.map((p) => p.kind)).toEqual(['transient', 'remote', 'remote']);
    expect('pages' in r && r.pages[1].uri).toBe('http://srv/a/2.jpg');
  });

  it('is unavailable offline with nothing stored', async () => {
    const db = createTestDb();
    const r = await resolveChapterPages({
      db, files: memoryFileStore(), client: fakeClient(null), title: 'T', chapter: '1', quality: 'original',
    });
    expect(r).toEqual({ unavailable: true });
  });

  it('is unavailable offline with a partial cache', async () => {
    const db = createTestDb();
    const files = memoryFileStore();
    await cache(db, files, 2);
    setPageCount(db, 'T', '1', 3);
    const r = await resolveChapterPages({
      db, files, client: fakeClient(null), title: 'T', chapter: '1', quality: 'original',
    });
    expect(r).toEqual({ unavailable: true });
  });

  it('uses the xl list when available and falls back to the original on 404', async () => {
    const db = createTestDb();
    setSetting(db, 'server.host', 'h');
    const files = memoryFileStore();
    const xl = await resolveChapterPages({
      db, files, client: fakeClient(IMGS, ['/x/1.jpg']), title: 'T', chapter: '1', quality: 'xl',
    });
    expect('pages' in xl && xl.pages).toEqual([{ kind: 'remote', uri: 'http://srv/x/1.jpg', index: 0 }]);
    const fb = await resolveChapterPages({
      db, files, client: fakeClient(IMGS, null), title: 'T', chapter: '1', quality: 'xl',
    });
    expect('pages' in fb && fb.pages).toHaveLength(3);
  });
});
