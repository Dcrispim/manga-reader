import { createTestDb } from '../../db/testDb';
import { diagLog, downloads, jobs } from '../../db/schema';
import { setSetting } from '../../settings/repo';
import { chapterDir, chapterXlTmpDir, commitChapter } from '../../storage/downloads';
import { memoryFileStore } from '../../storage/memoryFileStore';
import { drainQueue } from '../drain';
import { createSemaphore, type WorkerClient, type WorkerDeps } from '../downloadWorker';
import { enqueue, getJob } from '../repo';
import { POLL_MS, REPOST_ERROR_MS, REPOST_NULL_MS, runUpgradeJob } from '../upgradeWorker';

type Status = 'pending' | 'processing' | 'done' | 'error' | null;

interface Opts {
  xlPages?: number;
  failXlFrom?: number; // 1-based xl page from which downloads fail
}

function setup(o: Opts = {}) {
  const db = createTestDb();
  const sv = {
    status: 'pending' as Status,
    posts: [] as number[], // clock value at each POST
    gets: 0,
    postSets: undefined as Status | undefined, // status after a POST, if it changes
    failXlFrom: o.failXlFrom ?? Infinity,
  };
  const files = memoryFileStore({
    downloader: (url) => {
      const n = Number(/\/xl\/(\d+)/.exec(url)?.[1] ?? 0);
      return n >= sv.failXlFrom ? { ok: false, bytes: 0 } : { ok: true, bytes: 2000 };
    },
  });
  let t = 10_000_000;
  const xl = o.xlPages ?? 3;
  const client: WorkerClient = {
    async getJson<T>(path: string) {
      if (path.endsWith('/xl')) {
        const images = Array.from({ length: xl }, (_, i) => `/api/read/T/1/xl/${i + 1}`);
        return { ok: true as const, value: { images } as T };
      }
      sv.gets++;
      return { ok: true as const, value: { status: sv.status } as T };
    },
    async postJson<T>() {
      sv.posts.push(t);
      if (sv.postSets !== undefined) sv.status = sv.postSets;
      return { ok: true as const, value: { status: sv.status } as T };
    },
    url: (p) => `http://srv${p}`,
  };
  const deps: WorkerDeps = { db, files, client, now: () => t, semaphore: createSemaphore(2) };
  const advance = (ms: number) => (t += ms);

  async function seedDownload() {
    for (let i = 1; i <= 3; i++) files.files.set(`${chapterXlTmpDir(files, 'T', '1').replace('.xl', '')}/00${i}.jpg`, 1000);
    await commitChapter(db, files, { title: 'T', chapter: '1', pages: 3, quality: 'original' });
  }
  /** Runs one check at the job's scheduled time. */
  async function tick() {
    const job = getJob(db, jobId())!;
    t = Math.max(t, job.nextAttemptAt);
    return runUpgradeJob(job, deps);
  }
  const jobId = () => db.select().from(jobs).all()[0].id;
  return { db, files, sv, deps, advance, seedDownload, tick, jobId };
}

describe('commitChapter hook', () => {
  it('enqueues an upgrade only when downloads.highRes is on and quality is original', async () => {
    const s = setup();
    await s.seedDownload();
    expect(s.db.select().from(jobs).all()).toHaveLength(0);

    setSetting(s.db, 'downloads.highRes', 'true');
    await s.seedDownload();
    expect(s.db.select().from(jobs).all()).toMatchObject([{ kind: 'upgrade', title: 'T', chapter: '1' }]);

    s.db.delete(jobs).run();
    await commitChapter(s.db, s.files, { title: 'T', chapter: '1', pages: 3, quality: 'xl' });
    expect(s.db.select().from(jobs).all()).toHaveLength(0);
  });
});

describe('runUpgradeJob', () => {
  it('happy path: POST, pending, processing, done, swap to xl', async () => {
    const s = setup();
    await s.seedDownload();
    const job = enqueue(s.db, 'upgrade', 'T', '1')!;
    const savedAt = s.db.select().from(downloads).all()[0].savedAt;

    expect(await runUpgradeJob(job, s.deps)).toBe('retry'); // first POST -> pending
    expect(s.sv.posts).toHaveLength(1);
    expect(getJob(s.db, job.id)).toMatchObject({ state: 'queued', nextAttemptAt: s.deps.now() + POLL_MS });

    s.sv.status = 'processing';
    expect(await s.tick()).toBe('retry');
    s.sv.status = 'done';
    expect(await s.tick()).toBe('done');

    expect(s.sv.posts).toHaveLength(1);
    expect(getJob(s.db, job.id)!.state).toBe('done');
    const row = s.db.select().from(downloads).all()[0];
    expect(row).toMatchObject({ quality: 'xl', pages: 3, savedAt });
    const dir = chapterDir(s.files, 'T', '1');
    expect([...s.files.files.entries()].filter(([k]) => k.startsWith(`${dir}/`)).every(([, b]) => b === 2000)).toBe(true);
    expect(await s.files.exists(chapterXlTmpDir(s.files, 'T', '1'))).toBe(false);
  });

  it('a null status re-POSTs only after 30 minutes', async () => {
    const s = setup();
    await s.seedDownload();
    enqueue(s.db, 'upgrade', 'T', '1');
    await s.tick(); // POST #1
    s.sv.status = null;
    for (let i = 0; i < 5; i++) await s.tick(); // 25 min of polling
    expect(s.sv.posts).toHaveLength(1);
    await s.tick(); // 30 min after POST #1
    expect(s.sv.posts).toHaveLength(2);
    expect(s.sv.posts[1] - s.sv.posts[0]).toBeGreaterThanOrEqual(REPOST_NULL_MS);
  });

  it('an error status re-POSTs only after 6 hours', async () => {
    const s = setup();
    await s.seedDownload();
    s.sv.status = 'error';
    enqueue(s.db, 'upgrade', 'T', '1');
    await s.tick();
    const id = s.jobId();
    expect(getJob(s.db, id)!.nextAttemptAt - s.sv.posts[0]).toBeGreaterThanOrEqual(REPOST_ERROR_MS);
    s.sv.postSets = 'pending';
    await s.tick(); // 6 h later: GET says error, so POST
    expect(s.sv.posts).toHaveLength(2);
    expect(s.sv.posts[1] - s.sv.posts[0]).toBeGreaterThanOrEqual(REPOST_ERROR_MS);
  });

  it('a chapter deleted mid-way: job cancelled, nothing resurrected', async () => {
    const s = setup();
    await s.seedDownload();
    enqueue(s.db, 'upgrade', 'T', '1');
    await s.tick();
    s.sv.status = 'done';
    s.db.delete(downloads).run();
    await s.files.remove(chapterDir(s.files, 'T', '1'));
    expect(await s.tick()).toBe('cancelled');
    expect(s.db.select().from(jobs).all()).toHaveLength(0);
    expect(s.db.select().from(downloads).all()).toHaveLength(0);
    expect([...s.files.files.keys()].filter((k) => k.includes('/downloads/'))).toHaveLength(0);
  });

  it('a chapter deleted while xl pages are fetched: swap refused, job ends with no effect', async () => {
    const s = setup();
    await s.seedDownload();
    s.sv.status = 'done';
    const job = enqueue(s.db, 'upgrade', 'T', '1')!;
    const orig = s.deps.files.download.bind(s.deps.files);
    s.deps.files.download = async (url, dest) => {
      s.db.delete(downloads).run(); // user deletes during the fetch
      return orig(url, dest);
    };
    expect(await runUpgradeJob(job, s.deps)).toBe('done');
    expect(s.db.select().from(downloads).all()).toHaveLength(0);
    expect(await s.files.exists(chapterXlTmpDir(s.files, 'T', '1'))).toBe(false);
    expect(getJob(s.db, job.id)!.state).toBe('done');
  });

  it('an xl page failing keeps the original pages and reschedules; resume skips fetched pages', async () => {
    const s = setup({ failXlFrom: 3 });
    await s.seedDownload();
    s.sv.status = 'done';
    const job = enqueue(s.db, 'upgrade', 'T', '1')!;
    expect(await runUpgradeJob(job, s.deps)).toBe('retry');
    expect(getJob(s.db, job.id)).toMatchObject({ state: 'queued', attempts: 1 });
    expect(s.db.select().from(downloads).all()[0].quality).toBe('original');
    const dir = chapterDir(s.files, 'T', '1');
    expect([...s.files.files.entries()].filter(([k]) => k.startsWith(`${dir}/`)).every(([, b]) => b === 1000)).toBe(true);

    s.sv.failXlFrom = Infinity;
    const before = s.files.downloadLog.length;
    expect(await s.tick()).toBe('done');
    expect(s.files.downloadLog.length - before).toBeLessThanOrEqual(2);
    expect(s.db.select().from(downloads).all()[0].quality).toBe('xl');
  });

  it('accepts a different xl page count and records it in diag_log', async () => {
    const s = setup({ xlPages: 4 });
    await s.seedDownload();
    s.sv.status = 'done';
    const job = enqueue(s.db, 'upgrade', 'T', '1')!;
    expect(await runUpgradeJob(job, s.deps)).toBe('done');
    expect(s.db.select().from(downloads).all()[0]).toMatchObject({ pages: 4, quality: 'xl' });
    expect(s.db.select().from(diagLog).all().some((r) => r.message.includes('xl page count differs'))).toBe(true);
  });

  it('POSTs never exceed the rule over a long mixed run', async () => {
    const s = setup();
    await s.seedDownload();
    enqueue(s.db, 'upgrade', 'T', '1');
    const seq: Status[] = ['pending', null, null, 'processing', null, 'error', 'error', null, 'pending'];
    let ticks = 0;
    for (let i = 0; i < 200; i++) {
      s.sv.status = seq[i % seq.length];
      await s.tick();
      ticks++;
    }
    expect(ticks).toBe(200);
    // Every POST is at least 30 min after the previous one.
    for (let i = 1; i < s.sv.posts.length; i++) {
      expect(s.sv.posts[i] - s.sv.posts[i - 1]).toBeGreaterThanOrEqual(REPOST_NULL_MS);
    }
    expect(s.sv.gets).toBeGreaterThan(s.sv.posts.length); // mostly GETs
    expect(getJob(s.db, s.jobId())!.state).toBe('queued'); // never failed
  });
});

describe('drainQueue with upgrade jobs', () => {
  it('processes upgrade jobs and stops when the next check is in the future', async () => {
    const s = setup();
    await s.seedDownload();
    enqueue(s.db, 'upgrade', 'T', '1');
    const r = await drainQueue({ db: s.db, files: s.files, client: s.deps.client, now: s.deps.now, isOnline: () => true });
    expect(r.ran).toBe(1);
    expect(s.sv.posts).toHaveLength(1);
    expect(getJob(s.db, s.jobId())!.state).toBe('queued');
  });
});
