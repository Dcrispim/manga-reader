import { eq } from 'drizzle-orm';

import { chapterSources, downloads, settings, titles } from '../../db/schema';
import { createTestDb } from '../../db/testDb';
import type { Db } from '../../db/types';
import { createClient } from '../../net/client';
import {
  checkServer,
  resetServerState,
  type HealthClient,
} from '../../server/status';
import { setSetting } from '../../settings/repo';
import { hashName } from '../../catalog/hash';
import { memoryFileStore } from '../../storage/memoryFileStore';
import { syncCatalog, syncTitleOnDemand } from '../catalog';

const meta = {
  categories: ['a'],
  author: '',
  volumes: '',
  status: '',
  type: '',
  demographic: '',
  published: '',
  description: '',
};

function title(name: string, nums: number[], version = 'v1', thumb = true) {
  return {
    name,
    mtimeMs: 10,
    metadata: meta,
    categories: ['a'],
    thumb: thumb ? { url: `/api/thumb/${name}`, version } : null,
    chapters: nums.map((n) => ({
      id: String(n).padStart(4, '0'),
      number: n,
      pages: 12,
      mtimeMs: 5,
    })),
  };
}

function catalogBody(over: Record<string, unknown> = {}) {
  return {
    serverTime: 1000,
    since: 0,
    full: true,
    allTitleNames: ['Alpha', 'Beta'],
    titles: [title('Alpha', [1, 2]), title('Beta', [566])],
    ...over,
  };
}

function setup(body: unknown | (() => Response) = catalogBody()) {
  const db = createTestDb();
  setSetting(db, 'server.host', 'h');
  setSetting(db, 'server.port', '1');
  const calls: string[] = [];
  const fetchImpl = jest.fn(async (url: string) => {
    calls.push(url);
    if (typeof body === 'function') return (body as () => Response)();
    return new Response(JSON.stringify(body), { status: 200 });
  });
  const client = createClient({ db, fetchImpl: fetchImpl as unknown as typeof fetch });
  const files = memoryFileStore();
  return { db, client, files, calls, fetchImpl };
}

async function goOnline(db: Db, features: string[] = ['catalog']) {
  const health: HealthClient = {
    getJson: (async () => ({
      ok: true,
      value: { version: '1', features },
    })) as unknown as HealthClient['getJson'],
  };
  await checkServer(health, db);
}

const cursor = (db: Db) =>
  db.select().from(settings).where(eq(settings.key, 'catalog.since')).get()?.value;

beforeEach(() => resetServerState());

describe('hashName', () => {
  it('is stable and distinguishes names', () => {
    expect(hashName('Alpha')).toBe(hashName('Alpha'));
    expect(hashName('Alpha')).not.toBe(hashName('Beta'));
    expect(hashName('')).toBe('811c9dc5');
  });
});

describe('syncCatalog', () => {
  it('skips when offline or without the catalog feature', async () => {
    const s = setup();
    expect(await syncCatalog({ ...s })).toEqual({ skipped: 'offline' });
    await goOnline(s.db, []);
    expect(await syncCatalog({ ...s })).toEqual({ skipped: 'no-catalog-feature' });
    expect(s.calls).toHaveLength(0);
  });

  it('does a full initial sync (titles, server chapters, covers, cursor)', async () => {
    const s = setup();
    await goOnline(s.db);
    const out = await syncCatalog({ ...s, now: () => 77 });
    expect(out).toEqual({ changed: 2 });
    expect(s.calls[0]).toBe('http://h:1/api/catalog?since=0');

    const rows = s.db.select().from(titles).all();
    expect(rows.map((r) => r.name).sort()).toEqual(['Alpha', 'Beta']);
    const alpha = rows.find((r) => r.name === 'Alpha')!;
    expect(alpha.thumbVersion).toBe('v1');
    expect(alpha.thumbPath).toBe(
      `memory://doc/thumbs/${hashName('Alpha')}.jpg`,
    );
    expect(s.files.files.has(alpha.thumbPath!)).toBe(true);
    expect([...s.files.files.keys()].some((k) => k.endsWith('.tmp'))).toBe(false);

    const beta = s.db
      .select()
      .from(chapterSources)
      .where(eq(chapterSources.title, 'Beta'))
      .all();
    expect(beta).toEqual([
      {
        title: 'Beta',
        chapter: '566',
        sourceId: 'server',
        location: '0566',
        pages: 12,
        mtimeMs: 5,
      },
    ]);
    expect(cursor(s.db)).toBe('1000');
  });

  it('incremental with no changes writes nothing and advances the cursor', async () => {
    const s = setup();
    await goOnline(s.db);
    await syncCatalog({ ...s });
    const before = JSON.stringify([
      s.db.select().from(titles).all(),
      s.db.select().from(chapterSources).all(),
    ]);
    s.fetchImpl.mockImplementationOnce(async (url: string) => {
      s.calls.push(url);
      return new Response(
        JSON.stringify(catalogBody({ serverTime: 2000, since: 1000, full: false, titles: [] })),
        { status: 200 },
      );
    });
    expect(await syncCatalog({ ...s })).toEqual({ changed: 0 });
    expect(s.calls.at(-1)).toBe('http://h:1/api/catalog?since=1000');
    expect(
      JSON.stringify([
        s.db.select().from(titles).all(),
        s.db.select().from(chapterSources).all(),
      ]),
    ).toBe(before);
    expect(cursor(s.db)).toBe('2000');
  });

  it('keeps a removed title that still has a download; drops the others', async () => {
    const s = setup();
    await goOnline(s.db);
    await syncCatalog({ ...s });
    s.db
      .insert(downloads)
      .values({ title: 'Alpha', chapter: '1', dir: 'd', pages: 1, bytes: 1, savedAt: 1, quality: 'original' })
      .run();
    const betaThumb = s.db.select().from(titles).where(eq(titles.name, 'Beta')).get()!.thumbPath!;
    s.fetchImpl.mockImplementationOnce(async () =>
      new Response(
        JSON.stringify(catalogBody({ serverTime: 3000, full: false, allTitleNames: [], titles: [] })),
        { status: 200 },
      ),
    );
    expect(await syncCatalog({ ...s })).toEqual({ changed: 2 });
    expect(s.db.select().from(titles).all().map((r) => r.name)).toEqual(['Alpha']);
    expect(s.db.select().from(chapterSources).all()).toEqual([]);
    expect(s.files.files.has(betaThumb)).toBe(false);
    expect(cursor(s.db)).toBe('3000');
  });

  it('keeps a title that has a local source when it leaves the server', async () => {
    const s = setup();
    await goOnline(s.db);
    await syncCatalog({ ...s });
    s.db
      .insert(chapterSources)
      .values({ title: 'Beta', chapter: '1', sourceId: 'saf1', location: 'x', pages: null, mtimeMs: 1 })
      .run();
    s.fetchImpl.mockImplementationOnce(async () =>
      new Response(
        JSON.stringify(catalogBody({ serverTime: 3000, allTitleNames: ['Alpha'], titles: [] })),
        { status: 200 },
      ),
    );
    await syncCatalog({ ...s });
    const left = s.db.select().from(chapterSources).where(eq(chapterSources.title, 'Beta')).all();
    expect(left.map((r) => r.sourceId)).toEqual(['saf1']);
    expect(s.db.select().from(titles).where(eq(titles.name, 'Beta')).all()).toHaveLength(1);
  });

  it('does not re-download a cover with the same version', async () => {
    const s = setup();
    await goOnline(s.db);
    await syncCatalog({ ...s });
    expect(s.files.downloadLog).toHaveLength(2);
    await syncCatalog({ ...s }); // same body again, same versions
    expect(s.files.downloadLog).toHaveLength(2);
    // A new version does download again.
    s.fetchImpl.mockImplementationOnce(async () =>
      new Response(
        JSON.stringify(catalogBody({ titles: [title('Alpha', [1, 2], 'v2')] })),
        { status: 200 },
      ),
    );
    await syncCatalog({ ...s });
    expect(s.files.downloadLog).toHaveLength(3);
    expect(
      s.db.select().from(titles).where(eq(titles.name, 'Alpha')).get()?.thumbVersion,
    ).toBe('v2');
  });

  it('keeps the old cover when a new one fails to download', async () => {
    const s = setup();
    await goOnline(s.db);
    await syncCatalog({ ...s });
    const old = s.db.select().from(titles).where(eq(titles.name, 'Alpha')).get()!;
    const failing = memoryFileStore({ downloader: () => ({ ok: false, bytes: 0 }) });
    for (const [k, v] of s.files.files) failing.files.set(k, v);
    s.fetchImpl.mockImplementationOnce(async () =>
      new Response(
        JSON.stringify(
          catalogBody({
            serverTime: 2000,
            titles: [{ ...title('Alpha', [1, 2, 3], 'v2') }],
          }),
        ),
        { status: 200 },
      ),
    );
    const out = await syncCatalog({ ...s, files: failing });
    expect(out).toEqual({ changed: 1 });
    const now = s.db.select().from(titles).where(eq(titles.name, 'Alpha')).get()!;
    expect(now.thumbVersion).toBe(old.thumbVersion);
    expect(now.thumbPath).toBe(old.thumbPath);
    expect(failing.files.has(old.thumbPath!)).toBe(true);
    expect(
      s.db.select().from(chapterSources).where(eq(chapterSources.title, 'Alpha')).all(),
    ).toHaveLength(3);
    expect(cursor(s.db)).toBe('2000');
  });

  it('writes nothing and keeps the cursor on an invalid response', async () => {
    const s = setup({ nope: true });
    await goOnline(s.db);
    expect(await syncCatalog({ ...s })).toEqual({ skipped: 'fetch-failed' });
    expect(s.db.select().from(titles).all()).toEqual([]);
    expect(cursor(s.db)).toBeUndefined();
  });

  it('rolls back the failed batch and keeps the cursor when a title fails', async () => {
    const dup = title('Beta', [1, 1]); // duplicate PK -> the batch transaction fails
    const s = setup(
      catalogBody({ titles: [title('Alpha', [1]), dup, title('Gamma', [1])], allTitleNames: ['Alpha', 'Beta', 'Gamma'] }),
    );
    await goOnline(s.db);
    expect(await syncCatalog({ ...s })).toEqual({ skipped: 'write-failed' });
    // The three titles share one batch, so none of them is kept.
    const names = s.db.select().from(titles).all().map((r) => r.name);
    expect(names).toEqual([]);
    expect(cursor(s.db)).toBeUndefined();

    // Next run with a good body redoes everything idempotently.
    s.fetchImpl.mockImplementationOnce(async () =>
      new Response(
        JSON.stringify(
          catalogBody({ titles: [title('Alpha', [1]), title('Beta', [1]), title('Gamma', [1])], allTitleNames: ['Alpha', 'Beta', 'Gamma'] }),
        ),
        { status: 200 },
      ),
    );
    expect(await syncCatalog({ ...s })).toEqual({ changed: 3 });
    expect(s.db.select().from(titles).all()).toHaveLength(3);
    expect(cursor(s.db)).toBe('1000');
  });

  it('merges simultaneous calls into one request', async () => {
    const s = setup();
    await goOnline(s.db);
    const [a, b] = await Promise.all([syncCatalog({ ...s }), syncCatalog({ ...s })]);
    expect(a).toEqual(b);
    expect(s.calls.filter((c) => c.includes('/api/catalog'))).toHaveLength(1);
  });
});

describe('syncTitleOnDemand (degraded mode)', () => {
  function degraded() {
    const db = createTestDb();
    setSetting(db, 'server.host', 'h');
    setSetting(db, 'server.port', '1');
    const fetchImpl = jest.fn(async (url: string) => {
      if (url.includes('/api/read/Alpha'))
        return new Response(
          JSON.stringify({ chapters: ['0001', '2', 'extras'], modified: { '0001': 7, '2': 8 } }),
          { status: 200 },
        );
      if (url.includes('/api/metadata/Alpha'))
        return new Response(
          JSON.stringify({ ...meta, categories: ['x'], thumbSource: 'crop' }),
          { status: 200 },
        );
      return new Response('{}', { status: 404 });
    });
    const client = createClient({ db, fetchImpl: fetchImpl as unknown as typeof fetch });
    return { db, client, fetchImpl };
  }

  it('fills title and chapters with null pages', async () => {
    const d = degraded();
    await goOnline(d.db, []);
    expect(await syncTitleOnDemand(d, 'Alpha')).toEqual({ changed: 1 });
    const rows = d.db.select().from(chapterSources).all();
    expect(rows.map((r) => [r.chapter, r.location, r.pages, r.mtimeMs])).toEqual([
      ['1', '0001', null, 7],
      ['2', '2', null, 8],
    ]);
    const t = d.db.select().from(titles).get()!;
    expect(JSON.parse(t.categoriesJson)).toEqual(['x']);
    expect(JSON.parse(t.metadataJson).thumbSource).toBeUndefined();
  });

  it('skips offline and survives a failing server', async () => {
    const d = degraded();
    expect(await syncTitleOnDemand(d, 'Alpha')).toEqual({ skipped: 'offline' });
    await goOnline(d.db, []);
    expect(await syncTitleOnDemand(d, 'Missing')).toEqual({ skipped: 'fetch-failed' });
    expect(d.db.select().from(titles).all()).toEqual([]);
  });
});

describe('cover retry', () => {
  it('retries a failed cover on a later cycle even when the catalog returns nothing', async () => {
    let fail = true;
    const s = setup();
    const files = memoryFileStore({ downloader: () => ({ ok: !fail, bytes: 10 }) });
    await goOnline(s.db);
    await syncCatalog({ ...s, files });
    const failed = s.db.select().from(titles).where(eq(titles.name, 'Alpha')).get()!;
    expect(failed.thumbPath).toBeNull();
    expect(failed.thumbWantedVersion).toBe('v1');
    expect(failed.thumbUrl).toBe('/api/thumb/Alpha');

    fail = false;
    s.fetchImpl.mockImplementationOnce(async () =>
      new Response(
        JSON.stringify(catalogBody({ serverTime: 2000, full: false, titles: [] })),
        { status: 200 },
      ),
    );
    await syncCatalog({ ...s, files });
    const ok = s.db.select().from(titles).where(eq(titles.name, 'Alpha')).get()!;
    expect(ok.thumbPath).toBe(`memory://doc/thumbs/${hashName('Alpha')}.jpg`);
    expect(ok.thumbVersion).toBe('v1');
    expect(ok.thumbWantedVersion).toBeNull();
    expect(ok.thumbUrl).toBeNull();
  });

  it('retries at most 20 covers per cycle', async () => {
    const s = setup();
    const files = memoryFileStore({ downloader: () => ({ ok: false, bytes: 0 }) });
    await goOnline(s.db);
    const names = Array.from({ length: 25 }, (_, i) => `T${i}`);
    s.fetchImpl.mockImplementationOnce(async () =>
      new Response(
        JSON.stringify(
          catalogBody({ allTitleNames: names, titles: names.map((n) => title(n, [1])) }),
        ),
        { status: 200 },
      ),
    );
    await syncCatalog({ ...s, files });
    const before = files.downloadLog.length; // 25 initial attempts
    s.fetchImpl.mockImplementationOnce(async () =>
      new Response(
        JSON.stringify(
          catalogBody({ serverTime: 2000, full: false, allTitleNames: names, titles: [] }),
        ),
        { status: 200 },
      ),
    );
    await syncCatalog({ ...s, files });
    expect(files.downloadLog.length - before).toBe(20);
  });
});
