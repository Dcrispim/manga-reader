import { and, asc, eq, inArray, lte } from 'drizzle-orm';

import { jobs } from '../db/schema';
import type { Db } from '../db/types';
import { getSetting } from '../settings/repo';

export type Job = typeof jobs.$inferSelect;
export type JobKind = Job['kind'];

/** Delay before the next attempt, indexed by attempts already made (1-based). */
export const BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000] as const;

/** 1 min, 5 min, 15 min, 1 h and then 1 h forever; network trouble never ends a job. */
export function backoffMs(attempts: number): number {
  const i = Math.max(1, attempts) - 1;
  return BACKOFF_MS[Math.min(i, BACKOFF_MS.length - 1)];
}

/**
 * Idempotent: the (kind,title,chapter) row is created once; enqueuing it again
 * reactivates it (queued, no backoff) but keeps its progress so a resume does
 * not start over. A job that is running right now is left alone.
 */
export function enqueue(
  db: Db,
  kind: JobKind,
  title: string,
  chapter: string,
  now: number = Date.now(),
): Job | null {
  try {
    const where = and(eq(jobs.kind, kind), eq(jobs.title, title), eq(jobs.chapter, chapter));
    const existing = db.select().from(jobs).where(where).get();
    if (!existing) {
      db.insert(jobs).values({ kind, title, chapter, createdAt: now }).run();
    } else if (existing.state !== 'running') {
      db.update(jobs)
        .set({ state: 'queued', attempts: 0, nextAttemptAt: 0, lastError: null })
        .where(where)
        .run();
    }
    return db.select().from(jobs).where(where).get() ?? null;
  } catch {
    return null;
  }
}

export function getJob(db: Db, id: number): Job | null {
  try {
    return db.select().from(jobs).where(eq(jobs.id, id)).get() ?? null;
  } catch {
    return null;
  }
}

export function cancel(db: Db, id: number): void {
  try {
    db.delete(jobs).where(eq(jobs.id, id)).run();
  } catch {
    // Best-effort.
  }
}

/** Everything the queue UI should show: not finished successfully. */
export function listActive(db: Db): Job[] {
  try {
    return db
      .select()
      .from(jobs)
      .where(inArray(jobs.state, ['queued', 'running', 'paused', 'failed']))
      .orderBy(asc(jobs.id))
      .all();
  } catch {
    return [];
  }
}

export function nextRunnable(db: Db, now: number, kinds?: JobKind[]): Job | null {
  try {
    const conds = [eq(jobs.state, 'queued'), lte(jobs.nextAttemptAt, now)];
    if (kinds && kinds.length > 0) conds.push(inArray(jobs.kind, kinds));
    return (
      db
        .select()
        .from(jobs)
        .where(and(...conds))
        .orderBy(asc(jobs.nextAttemptAt), asc(jobs.id))
        .get() ?? null
    );
  } catch {
    return null;
  }
}

function patch(db: Db, id: number, set: Partial<typeof jobs.$inferInsert>): void {
  try {
    db.update(jobs).set(set).where(eq(jobs.id, id)).run();
  } catch {
    // Best-effort: the next drain re-reads the row.
  }
}

export function markRunning(db: Db, id: number): void {
  patch(db, id, { state: 'running', lastError: null });
}

export function markProgress(db: Db, id: number, pagesDone: number, pagesTotal: number): void {
  patch(db, id, { pagesDone, pagesTotal });
}

export function markDone(db: Db, id: number): void {
  patch(db, id, { state: 'done', lastError: null, attempts: 0 });
}

/** Terminal: only used when the server says the chapter no longer exists. */
export function markFailed(db: Db, id: number, error: string): void {
  patch(db, id, { state: 'failed', lastError: error });
}

/** Waiting for something that is not the network (disk space). */
export function markPaused(db: Db, id: number, error: string): void {
  patch(db, id, { state: 'paused', lastError: error });
}

/** Back to queued without counting an attempt (deadline hit, space freed). */
export function requeue(db: Db, id: number): void {
  patch(db, id, { state: 'queued', lastError: null });
}

/** Network/server trouble: one more attempt, later, never `failed`. */
export function reschedule(db: Db, id: number, error: string, now: number): void {
  const job = getJob(db, id);
  if (!job) return;
  const attempts = job.attempts + 1;
  patch(db, id, {
    state: 'queued',
    attempts,
    nextAttemptAt: now + backoffMs(attempts),
    lastError: error,
  });
}

/** Startup: whatever was running when the app died is simply queued again. */
export function recoverInterrupted(db: Db): number {
  try {
    const rows = db.select().from(jobs).where(eq(jobs.state, 'running')).all();
    if (rows.length > 0) db.update(jobs).set({ state: 'queued' }).where(eq(jobs.state, 'running')).run();
    return rows.length;
  } catch {
    return 0;
  }
}

/** `downloads.autoNext` (default false): opening chapter N queues N+1 (wired in M4-15). */
export function isAutoNext(db: Db): boolean {
  return getSetting(db, 'downloads.autoNext') === 'true';
}
