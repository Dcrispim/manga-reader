import { DEFAULT_LIMITS, canAdmit, projectChapterBytes } from '@manga/core';
import { eq, and } from 'drizzle-orm';

import { jobs } from '../db/schema';
import type { Db } from '../db/types';
import { getServerState, subscribeServerState } from '../server/status';
import { getSetting } from '../settings/repo';
import {
  MAX_CONCURRENT_PAGES,
  createSemaphore,
  runDownloadJob,
  type Semaphore,
  type WorkerClient,
} from './downloadWorker';
import { enqueue, nextRunnable, requeue, type JobKind } from './repo';
import type { FileStore } from '../storage/files';

export interface DrainDeps {
  db: Db;
  files: FileStore;
  client: WorkerClient;
  now?: () => number;
  /** Defaults to the reactive server status being `online`. */
  isOnline?: () => boolean;
  /** Shared page semaphore; one is created if omitted. */
  semaphore?: Semaphore;
}

export interface DrainOptions {
  /** Time budget in ms from the start of the drain (background ~25 s); omit for no limit. */
  deadlineMs?: number;
  onlyKinds?: JobKind[];
}

export interface DrainResult {
  ran: number;
  skipped: boolean;
}

// A second drain would double the request concurrency, so it is refused.
let draining = false;

function minFree(db: Db): number {
  const n = Number(getSetting(db, 'space.minFreeBytes'));
  return getSetting(db, 'space.minFreeBytes') !== null && Number.isFinite(n) && n >= 0
    ? n
    : DEFAULT_LIMITS.minFreeBytes;
}

/** Jobs paused for lack of space go back to the queue once the chapter fits. */
async function resumePaused(deps: DrainDeps): Promise<void> {
  const { db, files } = deps;
  const rows = db
    .select()
    .from(jobs)
    .where(and(eq(jobs.state, 'paused'), eq(jobs.lastError, 'no_space')))
    .all();
  if (rows.length === 0) return;
  const free = await files.freeDiskBytes();
  for (const r of rows) {
    if (canAdmit(free, projectChapterBytes(r.pagesTotal), minFree(db))) requeue(db, r.id);
  }
}

/**
 * Processes runnable jobs one after the other until none is left or the
 * budget is spent. Needs the server `online`; never throws.
 */
export async function drainQueue(
  deps: DrainDeps,
  opts: DrainOptions = {},
): Promise<DrainResult> {
  const now = deps.now ?? Date.now;
  const isOnline = deps.isOnline ?? (() => getServerState().status === 'online');
  if (draining) return { ran: 0, skipped: true };
  draining = true;
  let ran = 0;
  try {
    const end = opts.deadlineMs === undefined ? Infinity : now() + opts.deadlineMs;
    const semaphore = deps.semaphore ?? createSemaphore(MAX_CONCURRENT_PAGES);
    await resumePaused(deps);
    while (isOnline() && now() < end) {
      // Upgrades are M4-11; until then only downloads are picked.
      const job = nextRunnable(deps.db, now(), opts.onlyKinds ?? ['download']);
      if (!job || job.kind !== 'download') break;
      await runDownloadJob(job, {
        db: deps.db,
        files: deps.files,
        client: deps.client,
        now,
        semaphore,
        shouldStop: () => now() >= end || !isOnline(),
      });
      ran++;
    }
  } catch {
    // Drains are best-effort; the queue is persistent.
  } finally {
    draining = false;
  }
  return { ran, skipped: false };
}

let foreground: DrainDeps | null = null;

/** Ask for a foreground drain (no deadline); a no-op until startForegroundDrain ran. */
export function requestDrain(): void {
  if (foreground) void drainQueue(foreground);
}

/** Enqueue and immediately try to drain. */
export function enqueueAndDrain(
  db: Db,
  kind: JobKind,
  title: string,
  chapter: string,
): void {
  enqueue(db, kind, title, chapter);
  requestDrain();
}

/** Foreground: drain whenever the server turns `online`. Returns the unsubscribe. */
export function startForegroundDrain(deps: DrainDeps): () => void {
  foreground = deps;
  let last = getServerState().status;
  const unsubscribe = subscribeServerState(() => {
    const status = getServerState().status;
    if (status === 'online' && last !== 'online') requestDrain();
    last = status;
  });
  if (last === 'online') requestDrain();
  return () => {
    unsubscribe();
    if (foreground === deps) foreground = null;
  };
}
