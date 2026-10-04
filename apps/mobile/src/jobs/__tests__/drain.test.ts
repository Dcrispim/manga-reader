import { createTestDb } from '../../db/testDb';
import { memoryFileStore } from '../../storage/memoryFileStore';
import { drainQueue, type DrainDeps } from '../drain';
import { enqueue, getJob, markRunning, recoverInterrupted } from '../repo';

function setup(opts: { freeBytes?: number; online?: boolean } = {}) {
  const db = createTestDb();
  const files = memoryFileStore({ freeBytes: opts.freeBytes });
  let t = 1_000_000;
  const state = { online: opts.online ?? true };
  const deps: DrainDeps = {
    db,
    files,
    client: {
      async getJson<T>() {
        return { ok: true as const, value: { images: ['/a/1.jpg', '/a/2.jpg'] } as T };
      },
      url: (p) => `http://srv${p}`,
    },
    now: () => t,
    isOnline: () => state.online,
  };
  return { db, files, deps, state, advance: (ms: number) => (t += ms) };
}

describe('drainQueue', () => {
  it('drains every runnable job while online', async () => {
    const { db, deps } = setup();
    const a = enqueue(db, 'download', 'T', '1')!;
    const b = enqueue(db, 'download', 'T', '2')!;
    expect(await drainQueue(deps)).toEqual({ ran: 2, skipped: false });
    expect(getJob(db, a.id)!.state).toBe('done');
    expect(getJob(db, b.id)!.state).toBe('done');
  });

  it('does nothing while the server is not online', async () => {
    const { db, deps, state } = setup({ online: false });
    const a = enqueue(db, 'download', 'T', '1')!;
    expect((await drainQueue(deps)).ran).toBe(0);
    expect(getJob(db, a.id)!.state).toBe('queued');
    state.online = true;
    expect((await drainQueue(deps)).ran).toBe(1);
  });

  it('refuses a simultaneous second drain', async () => {
    const { db, deps } = setup();
    enqueue(db, 'download', 'T', '1');
    const [first, second] = await Promise.all([drainQueue(deps), drainQueue(deps)]);
    expect(first.skipped).toBe(false);
    expect(second.skipped).toBe(true);
  });

  it('respects the deadline: nothing starts once the budget is spent', async () => {
    const { db, deps } = setup();
    const a = enqueue(db, 'download', 'T', '1')!;
    expect((await drainQueue(deps, { deadlineMs: 0 })).ran).toBe(0);
    expect(getJob(db, a.id)!.state).toBe('queued');
  });

  it('keeps no-space jobs paused, then resumes them when room appears', async () => {
    const { db, files, deps } = setup({ freeBytes: 100 });
    const a = enqueue(db, 'download', 'T', '1')!;
    await drainQueue(deps);
    expect(getJob(db, a.id)).toMatchObject({ state: 'paused', lastError: 'no_space' });
    // still no room: stays paused
    await drainQueue(deps);
    expect(getJob(db, a.id)!.state).toBe('paused');

    const roomy = memoryFileStore();
    await drainQueue({ ...deps, files: roomy });
    expect(getJob(db, a.id)!.state).toBe('done');
    expect(files.files.size).toBe(0);
  });

  it('skips jobs in backoff and picks them up after the delay', async () => {
    const { db, deps, advance } = setup();
    const failing = { ...deps, client: { ...deps.client, getJson: async () => ({ ok: false as const, reason: 'unreachable' as const }) } };
    const a = enqueue(db, 'download', 'T', '1')!;
    expect((await drainQueue(failing)).ran).toBe(1);
    expect(getJob(db, a.id)!.attempts).toBe(1);
    expect((await drainQueue(deps)).ran).toBe(0);
    advance(60_001);
    expect((await drainQueue(deps)).ran).toBe(1);
    expect(getJob(db, a.id)!.state).toBe('done');
  });

  it('a job interrupted while running is recovered and finished', async () => {
    const { db, deps } = setup();
    const a = enqueue(db, 'download', 'T', '1')!;
    markRunning(db, a.id);
    expect((await drainQueue(deps)).ran).toBe(0);
    recoverInterrupted(db);
    expect((await drainQueue(deps)).ran).toBe(1);
    expect(getJob(db, a.id)!.state).toBe('done');
  });
});
