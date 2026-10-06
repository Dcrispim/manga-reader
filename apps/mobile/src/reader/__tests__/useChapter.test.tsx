import { HISTORY_MIN_OPEN_MS } from '@manga/core';
import { act, create } from 'react-test-renderer';

import { createTestDb } from '../../db/testDb';
import { history, jobs } from '../../db/schema';
import { setSetting } from '../../settings/repo';
import { chapterTmpDir, commitChapter } from '../../storage/downloads';
import { memoryFileStore } from '../../storage/memoryFileStore';
import { transientPages } from '../../db/schema';
import { getOpenChapterId } from '../openChapter';
import { setLocalPageProvider, type ResolverClient } from '../resolve';
import { imagePathOf, useChapter, type ChapterState } from '../useChapter';

function fakeClient(images: string[] | null, xl: string[] | null = null): ResolverClient {
  return {
    url: (p) => `http://srv${p}`,
    getJson: (async (path: string) => {
      const list = path.endsWith('/xl') ? xl : images;
      if (!list) return { ok: false, reason: 'unreachable' };
      return { ok: true, value: { images: list } };
    }) as ResolverClient['getJson'],
  };
}

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });

function mount(props: Parameters<typeof useChapter>[0]) {
  const out: { current: ReturnType<typeof useChapter> | null } = { current: null };
  function Probe(p: { input: Parameters<typeof useChapter>[0] }) {
    out.current = useChapter(p.input);
    return null;
  }
  let tree!: ReturnType<typeof create>;
  act(() => { tree = create(<Probe input={props} />); });
  return { out, tree, rerender: (i: Parameters<typeof useChapter>[0]) => act(() => tree.update(<Probe input={i} />)) };
}

beforeEach(() => setLocalPageProvider(async () => null));

describe('imagePathOf', () => {
  it('strips the origin', () => {
    expect(imagePathOf('http://10.0.2.2:3994/api/img/a.jpg')).toBe('/api/img/a.jpg');
    expect(imagePathOf('/x/y.jpg')).toBe('/x/y.jpg');
  });
});

describe('useChapter', () => {
  it('is unavailable when nothing can serve the chapter', async () => {
    const db = createTestDb();
    const { out } = mount({ db, client: fakeClient(null), files: memoryFileStore(), title: 'T', chapter: '1', upcoming: [], online: false });
    await flush();
    expect((out.current!.state as ChapterState).status).toBe('unavailable');
  });

  it('downloads remote pages once into the transient store and shows them from there', async () => {
    const db = createTestDb();
    const files = memoryFileStore();
    const { out } = mount({ db, client: fakeClient(['/a/1.jpg', '/a/2.jpg']), files, title: 'T', chapter: '1', upcoming: [], online: true });
    await flush();
    const s = out.current!.state;
    expect(s.status).toBe('ready');
    if (s.status === 'ready') {
      expect(s.pages.map((p) => [p.kind, p.pending])).toEqual([
        ['transient', false],
        ['transient', false],
      ]);
    }
    expect(db.select().from(transientPages).all()).toHaveLength(2);
    expect(files.downloadLog).toHaveLength(2);
  });

  it('falls back to the page URL when its download fails', async () => {
    const db = createTestDb();
    const files = memoryFileStore({ downloader: () => ({ ok: false, bytes: 0 }) });
    const { out } = mount({ db, client: fakeClient(['/a/1.jpg']), files, title: 'T', chapter: '1', upcoming: [], online: true });
    await flush();
    const s = out.current!.state;
    if (s.status === 'ready') expect(s.pages.map((p) => [p.kind, p.pending])).toEqual([['remote', false]]);
    else throw new Error(`unexpected ${s.status}`);
  });

  it('uses downloaded pages without caching anything', async () => {
    const db = createTestDb();
    const files = memoryFileStore();
    const tmp = chapterTmpDir(files, 'T', '1');
    files.files.set(`${tmp}/001.jpg`, 10);
    await commitChapter(db, files, { title: 'T', chapter: '1', pages: 1, quality: 'original' });
    const { out } = mount({ db, client: fakeClient(null), files, title: 'T', chapter: '1', upcoming: [], online: false });
    await flush();
    const s = out.current!.state;
    expect(s.status === 'ready' && s.pages[0].kind).toBe('download');
    expect(db.select().from(transientPages).all()).toHaveLength(0);
  });

  it('records history only after the delay, guards the open chapter and queues the chapters ahead', async () => {
    const db = createTestDb();
    setSetting(db, 'downloads.ahead', '2');
    const { tree } = mount({ db, client: fakeClient(['/a/1.jpg']), files: memoryFileStore(), title: 'T', chapter: '1', upcoming: ['2', '3'], online: true, historyDelayMs: 60 });
    await flush();
    expect(db.select().from(history).all()).toHaveLength(0);
    await act(async () => { await new Promise((r) => setTimeout(r, 80)); });
    expect(db.select().from(history).all().map((h) => h.chapter)).toEqual(['1']);
    expect(getOpenChapterId()).toContain('T');
    expect(db.select().from(jobs).all().map((j) => j.chapter)).toEqual(['2', '3']);
    act(() => tree.unmount());
    expect(getOpenChapterId()).toBeNull();
  });

  it('does not record history when the chapter closes before the delay', async () => {
    const db = createTestDb();
    const { tree } = mount({ db, client: fakeClient(['/a/1.jpg']), files: memoryFileStore(), title: 'T', chapter: '1', upcoming: [], online: true, historyDelayMs: 60 });
    await flush();
    act(() => tree.unmount());
    await act(async () => { await new Promise((r) => setTimeout(r, 80)); });
    expect(db.select().from(history).all()).toHaveLength(0);
  });

  it('uses the shared 15 s minimum by default', () => {
    expect(HISTORY_MIN_OPEN_MS).toBe(15_000);
  });

  it('does not record history nor queue chapters ahead for an unavailable chapter', async () => {
    const db = createTestDb();
    mount({ db, client: fakeClient(null), files: memoryFileStore(), title: 'T', chapter: '1', upcoming: ['2', '3'], online: false });
    await flush();
    expect(db.select().from(history).all()).toHaveLength(0);
    expect(db.select().from(jobs).all()).toHaveLength(0);
  });

  it('queues one chapter ahead by default', async () => {
    const one = createTestDb();
    mount({ db: one, client: fakeClient(['/a/1.jpg']), files: memoryFileStore(), title: 'T', chapter: '1', upcoming: ['2', '3'], online: true });
    await flush();
    expect(one.select().from(jobs).all().map((j) => j.chapter)).toEqual(['2']);
  });

  it('does not queue chapters ahead when set to 0', async () => {
    const db = createTestDb();
    setSetting(db, 'downloads.ahead', '0');
    mount({ db, client: fakeClient(['/a/1.jpg']), files: memoryFileStore(), title: 'T', chapter: '1', upcoming: ['2', '3'], online: true });
    await flush();
    expect(db.select().from(jobs).all()).toHaveLength(0);
  });

  it('offers xl only when online and listed; offline falls back to original', async () => {
    const db = createTestDb();
    const files = memoryFileStore();
    const client = fakeClient(['/a/1.jpg'], ['/x/1.jpg']);
    const { out, rerender } = mount({ db, client, files, title: 'T', chapter: '1', upcoming: [], online: true });
    await flush();
    expect(out.current!.xlAvailable).toBe(true);
    act(() => out.current!.setQuality('xl'));
    await flush();
    expect(out.current!.quality).toBe('xl');
    rerender({ db, client, files, title: 'T', chapter: '1', upcoming: [], online: false });
    await flush();
    expect(out.current!.xlAvailable).toBe(false);
    expect(out.current!.quality).toBe('original');
  });
});
