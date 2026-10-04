import { createTestDb } from '../../db/testDb';
import { chapterSources, downloads, transientPages } from '../../db/schema';
import { chapterTmpDir, chapterDir } from '../../storage/downloads';
import { memoryFileStore } from '../../storage/memoryFileStore';
import { fetchToTransient, setPageCount } from '../../storage/transient';
import {
  createSemaphore,
  runDownloadJob,
  type WorkerClient,
  type WorkerDeps,
} from '../downloadWorker';
import { backoffMs, enqueue, getJob } from '../repo';

type Db = ReturnType<typeof createTestDb>;

interface FakeOpts {
  pages?: number;
  listError?: { reason: 'unreachable' | 'http'; status?: number };
  failFrom?: number; // 1-based page number from which downloads fail
  freeBytes?: number;
  delay?: boolean;
}

function setup(o: FakeOpts = {}) {
  const db: Db = createTestDb();
  const state = { failFrom: o.failFrom ?? Infinity, listCalls: 0, active: 0, maxActive: 0 };
  const base = memoryFileStore({
    freeBytes: o.freeBytes,
    downloader: (url) => {
      const n = Number(/\/(\d+)\.jpg/.exec(url)![1]);
      return n >= state.failFrom ? { ok: false, bytes: 0 } : { ok: true, bytes: 1000 };
    },
  });
  const files = o.delay
    ? {
        ...base,
        async download(url: string, dest: string) {
          state.active++;
          state.maxActive = Math.max(state.maxActive, state.active);
          await new Promise((r) => setTimeout(r, 1));
          const res = await base.download(url, dest);
          state.active--;
          return res;
        },
      }
    : base;
  const pages = o.pages ?? 15;
  const client: WorkerClient = {
    async getJson<T>() {
      state.listCalls++;
      if (o.listError) return { ok: false as const, ...o.listError };
      const images = Array.from({ length: pages }, (_, i) => `/img/${i + 1}.jpg`);
      return { ok: true as const, value: { images } as T };
    },
    url: (p) => `http://srv${p}`,
  };
  let t = 1_000_000;
  const deps: WorkerDeps = {
    db,
    files,
    client,
    now: () => t,
    semaphore: createSemaphore(2),
  };
  return { db, base, files, deps, state, advance: (ms: number) => (t += ms), clock: () => t };
}

describe('runDownloadJob', () => {
  it('downloads a whole chapter and commits it', async () => {
    const { db, deps, base } = setup();
    const job = enqueue(db, 'download', 'T', '1')!;
    expect(await runDownloadJob(job, deps)).toBe('done');
    expect(getJob(db, job.id)).toMatchObject({ state: 'done', pagesDone: 15, pagesTotal: 15 });
    expect(db.select().from(downloads).all()).toHaveLength(1);
    expect([...base.files.keys()].filter((k) => k.startsWith(chapterDir(base, 'T', '1') + '/'))).toHaveLength(15);
    expect(await base.exists(chapterTmpDir(base, 'T', '1'))).toBe(false);
  });

  it('a drop at page 7 requeues; the resume only fetches pages 8 to 15', async () => {
    const { db, deps, base, state } = setup({ failFrom: 8 });
    const job = enqueue(db, 'download', 'T', '1')!;
    expect(await runDownloadJob(job, deps)).toBe('retry');
    const after = getJob(db, job.id)!;
    expect(after.state).toBe('queued');
    expect(after.attempts).toBe(1);
    expect(after.pagesDone).toBe(7);
    expect(db.select().from(downloads).all()).toHaveLength(0);

    state.failFrom = Infinity;
    base.downloadLog.length = 0;
    expect(await runDownloadJob(after, deps)).toBe('done');
    const fetched = base.downloadLog.map((d) => Number(/\/(\d+)\.jpg/.exec(d.url)![1])).sort((a, b) => a - b);
    expect(fetched).toEqual([8, 9, 10, 11, 12, 13, 14, 15]);
  });

  it('pauses without space and goes through once there is room', async () => {
    const { db, deps, base } = setup({ freeBytes: 100 });
    const job = enqueue(db, 'download', 'T', '1')!;
    expect(await runDownloadJob(job, deps)).toBe('paused');
    expect(getJob(db, job.id)).toMatchObject({ state: 'paused', lastError: 'no_space', attempts: 0 });
    expect(base.downloadLog).toHaveLength(0);
  });

  it('marks failed on 404 only', async () => {
    const a = setup({ listError: { reason: 'http', status: 404 } });
    const job = enqueue(a.db, 'download', 'T', '1')!;
    expect(await runDownloadJob(job, a.deps)).toBe('failed');
    expect(getJob(a.db, job.id)!.state).toBe('failed');

    const b = setup({ listError: { reason: 'http', status: 500 } });
    const job2 = enqueue(b.db, 'download', 'T', '1')!;
    expect(await runDownloadJob(job2, b.deps)).toBe('retry');
    expect(getJob(b.db, job2.id)!.state).toBe('queued');
  });

  it('backs off progressively and never fails because of the network', async () => {
    const { db, deps, advance, clock } = setup({ listError: { reason: 'unreachable' } });
    let job = enqueue(db, 'download', 'T', '1')!;
    const waits: number[] = [];
    for (let i = 0; i < 6; i++) {
      const start = clock();
      expect(await runDownloadJob(job, deps)).toBe('retry');
      job = getJob(db, job.id)!;
      expect(job.state).toBe('queued');
      waits.push(job.nextAttemptAt - start);
      advance(job.nextAttemptAt - start);
    }
    expect(waits).toEqual([1, 2, 3, 4, 5, 6].map(backoffMs));
    expect(waits).toEqual([60_000, 300_000, 900_000, 3_600_000, 3_600_000, 3_600_000]);
  });

  it('promotes a fully cached chapter without any network call', async () => {
    const { db, deps, base, state } = setup();
    setPageCount(db, 'T', '1', 3);
    for (let i = 0; i < 3; i++) {
      await fetchToTransient({
        db, files: base, client: deps.client, title: 'T', chapter: '1', page: i, imagePath: `/img/${i}.jpg`,
      });
    }
    base.downloadLog.length = 0;
    const job = enqueue(db, 'download', 'T', '1')!;
    expect(await runDownloadJob(job, deps)).toBe('done');
    expect(state.listCalls).toBe(0);
    expect(base.downloadLog).toHaveLength(0);
    expect(db.select().from(downloads).all()).toHaveLength(1);
    expect(db.select().from(transientPages).all()).toHaveLength(0);
    expect(db.select().from(chapterSources).all()).toHaveLength(1);
  });

  it('never exceeds 2 simultaneous image requests, even across jobs', async () => {
    const { db, deps, state } = setup({ delay: true, pages: 10 });
    const jobs = [1, 2, 3].map((c) => enqueue(db, 'download', 'T', String(c))!);
    const out = await Promise.all(jobs.map((j) => runDownloadJob(j, deps)));
    expect(out).toEqual(['done', 'done', 'done']);
    expect(state.maxActive).toBe(2);
  });

  it('stops between pages when asked and requeues without counting an attempt', async () => {
    const { db, deps } = setup();
    let n = 0;
    const job = enqueue(db, 'download', 'T', '1')!;
    const out = await runDownloadJob(job, { ...deps, shouldStop: () => ++n > 4 });
    expect(out).toBe('retry');
    const after = getJob(db, job.id)!;
    expect(after.state).toBe('queued');
    expect(after.attempts).toBe(0);
    expect(after.pagesDone).toBeGreaterThan(0);
  });
});
