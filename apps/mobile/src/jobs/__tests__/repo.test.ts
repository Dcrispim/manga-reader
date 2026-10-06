import { createTestDb } from '../../db/testDb';
import { jobs } from '../../db/schema';
import { setSetting } from '../../settings/repo';
import {
  backoffMs,
  cancel,
  downloadAhead,
  enqueue,
  listActive,
  markDone,
  markFailed,
  markProgress,
  markRunning,
  nextRunnable,
  recoverInterrupted,
  reschedule,
} from '../repo';

const all = (db: ReturnType<typeof createTestDb>) => db.select().from(jobs).all();

describe('jobs repo', () => {
  it('enqueuing twice keeps a single job and reactivates it', () => {
    const db = createTestDb();
    const a = enqueue(db, 'download', 'T', '1', 10)!;
    markProgress(db, a.id, 4, 15);
    reschedule(db, a.id, 'x', 100);
    const b = enqueue(db, 'download', 'T', '1', 20)!;
    expect(all(db)).toHaveLength(1);
    expect(b.id).toBe(a.id);
    expect(b).toMatchObject({ state: 'queued', attempts: 0, nextAttemptAt: 0, pagesDone: 4 });
    // a different kind is a different job
    enqueue(db, 'upgrade', 'T', '1');
    expect(all(db)).toHaveLength(2);
  });

  it('reactivates a failed job but leaves a running one alone', () => {
    const db = createTestDb();
    const a = enqueue(db, 'download', 'T', '1')!;
    markFailed(db, a.id, 'not_found');
    expect(enqueue(db, 'download', 'T', '1')!.state).toBe('queued');
    markRunning(db, a.id);
    expect(enqueue(db, 'download', 'T', '1')!.state).toBe('running');
  });

  it('nextRunnable honours state, next_attempt_at and kinds', () => {
    const db = createTestDb();
    const a = enqueue(db, 'download', 'T', '1')!;
    reschedule(db, a.id, 'x', 1000);
    expect(nextRunnable(db, 1000)).toBeNull();
    expect(nextRunnable(db, 1000 + backoffMs(1))!.id).toBe(a.id);
    expect(nextRunnable(db, 1e12, ['upgrade'])).toBeNull();
  });

  it('backoff is 1 min, 5 min, 15 min, 1 h and then 1 h forever', () => {
    expect([1, 2, 3, 4, 5, 50].map(backoffMs)).toEqual([
      60_000, 300_000, 900_000, 3_600_000, 3_600_000, 3_600_000,
    ]);
  });

  it('listActive hides done jobs; cancel removes', () => {
    const db = createTestDb();
    const a = enqueue(db, 'download', 'T', '1')!;
    const b = enqueue(db, 'download', 'T', '2')!;
    markDone(db, a.id);
    expect(listActive(db).map((j) => j.id)).toEqual([b.id]);
    cancel(db, b.id);
    expect(listActive(db)).toEqual([]);
  });

  it('recoverInterrupted turns running jobs back into queued', () => {
    const db = createTestDb();
    const a = enqueue(db, 'download', 'T', '1')!;
    const b = enqueue(db, 'download', 'T', '2')!;
    markRunning(db, a.id);
    markDone(db, b.id);
    expect(recoverInterrupted(db)).toBe(1);
    const rows = all(db);
    expect(rows.find((j) => j.id === a.id)!.state).toBe('queued');
    expect(rows.find((j) => j.id === b.id)!.state).toBe('done');
  });
});

describe('downloadAhead', () => {
  it('defaults to 1, honours the setting within 0..10 and an old explicit off', () => {
    const db = createTestDb();
    expect(downloadAhead(db)).toBe(1);
    setSetting(db, 'downloads.autoNext', 'false');
    expect(downloadAhead(db)).toBe(0);
    setSetting(db, 'downloads.ahead', '3');
    expect(downloadAhead(db)).toBe(3);
    setSetting(db, 'downloads.ahead', '99');
    expect(downloadAhead(db)).toBe(10);
    setSetting(db, 'downloads.ahead', '-2');
    expect(downloadAhead(db)).toBe(0);
  });
});
