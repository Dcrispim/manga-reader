import {
  ReadChapterXlResponseSchema,
  UpscaleResponseSchema,
  paths,
  type UpscaleStatus,
} from '@manga/api-contract';
import { and, eq } from 'drizzle-orm';

import { downloads, jobs } from '../db/schema';
import { log } from '../diag/log';
import type { Result } from '../lib/result';
import { chapterXlTmpDir, replaceChapterImages } from '../storage/downloads';
import { MAX_CONCURRENT_PAGES, type JobOutcome, type WorkerDeps } from './downloadWorker';
import { cancel, getJob, markDone, markFailed, markRunning, requeue, reschedule, type Job } from './repo';

/** Between status checks while the server is still working. */
export const POLL_MS = 5 * 60_000;
/** The server GPU queue holds 1 running + 1 waiting; a new POST bumps the waiting one. */
export const REPOST_NULL_MS = 30 * 60_000;
export const REPOST_ERROR_MS = 6 * 60 * 60_000;

export type UpgradeOutcome = JobOutcome | 'cancelled';

interface Meta {
  /** Epoch ms of the last POST attempt; absent = never posted. */
  lastPostAt?: number;
}

function readMeta(job: Job): Meta {
  try {
    const m = JSON.parse(job.metaJson ?? '{}') as Meta;
    return typeof m.lastPostAt === 'number' ? { lastPostAt: m.lastPostAt } : {};
  } catch {
    return {};
  }
}

function writeMeta(deps: WorkerDeps, id: number, meta: Meta): void {
  try {
    deps.db.update(jobs).set({ metaJson: JSON.stringify(meta) }).where(eq(jobs.id, id)).run();
  } catch {
    // Best-effort: worst case the next attempt is treated as a first one.
  }
}

/** Polling, not failing: the job stays queued until `at`, with no attempt cap. */
function scheduleAt(deps: WorkerDeps, id: number, at: number, note: string): void {
  try {
    deps.db
      .update(jobs)
      .set({ state: 'queued', nextAttemptAt: at, lastError: note })
      .where(eq(jobs.id, id))
      .run();
  } catch {
    // The row is re-read on the next drain.
  }
}

function extOf(path: string): string {
  const name = path.split('?')[0].split('#')[0].split('/').pop() ?? '';
  const m = /\.([A-Za-z0-9]{1,5})$/.exec(name);
  return m ? m[1].toLowerCase() : 'jpg';
}

/**
 * One check of the upgrade state machine. Never throws.
 *
 * - first attempt: POST (the only unconditional one);
 * - later attempts: GET only. A new POST goes out when the GET says `null`
 *   (request bumped or lost) and the last POST is 30 min old, or when it says
 *   `error` and the last POST is 6 h old;
 * - pending/processing: look again in 5 min, forever;
 * - done: fetch the xl pages into `.xl.tmp` and swap them in; any failure
 *   keeps the original pages and retries with backoff.
 */
export async function runUpgradeJob(job: Job, deps: WorkerDeps): Promise<UpgradeOutcome> {
  const { db, files, client, now, semaphore, shouldStop } = deps;
  const fail = (reason: string): UpgradeOutcome => {
    reschedule(db, job.id, reason, now());
    return 'retry';
  };
  try {
    // Deleted (or evicted) while the job existed: drop the job, resurrect nothing.
    const row = db
      .select()
      .from(downloads)
      .where(and(eq(downloads.title, job.title), eq(downloads.chapter, job.chapter)))
      .get();
    if (!row) {
      await files.remove(chapterXlTmpDir(files, job.title, job.chapter));
      cancel(db, job.id);
      return 'cancelled';
    }
    if (row.quality === 'xl') {
      markDone(db, job.id);
      return 'done';
    }
    markRunning(db, job.id);

    const meta = readMeta(job);
    const statusPath = paths.upscaleStatus(job.title, job.chapter);
    const post = async (): Promise<Result<{ status: UpscaleStatus | null }>> => {
      meta.lastPostAt = now();
      writeMeta(deps, job.id, meta);
      return client.postJson
        ? client.postJson<{ status: UpscaleStatus | null }>(
            paths.upscaleStart(job.title, job.chapter),
            {},
            UpscaleResponseSchema,
          )
        : { ok: false, reason: 'unreachable' };
    };

    let res: Result<{ status: UpscaleStatus | null }> =
      meta.lastPostAt === undefined
        ? await post()
        : await client.getJson<{ status: UpscaleStatus | null }>(statusPath, UpscaleResponseSchema);
    if (!res.ok) {
      if (res.reason === 'http' && res.status === 404) {
        markFailed(db, job.id, 'not_found');
        return 'failed';
      }
      return fail(`status_${res.reason}${res.status ? `_${res.status}` : ''}`);
    }

    let status = res.value.status;
    const sinceLast = meta.lastPostAt === undefined ? Infinity : now() - meta.lastPostAt;
    if (status === null && sinceLast >= REPOST_NULL_MS) {
      res = await post();
      if (!res.ok) return fail(`post_${res.reason}${res.status ? `_${res.status}` : ''}`);
      status = res.value.status;
    } else if (status === 'error' && sinceLast >= REPOST_ERROR_MS) {
      res = await post();
      if (!res.ok) return fail(`post_${res.reason}${res.status ? `_${res.status}` : ''}`);
      status = res.value.status;
    }

    if (status === 'error') {
      const at = Math.max(now() + POLL_MS, (meta.lastPostAt ?? now()) + REPOST_ERROR_MS);
      scheduleAt(deps, job.id, at, 'upscale_error');
      return 'retry';
    }
    if (status !== 'done') {
      scheduleAt(deps, job.id, now() + POLL_MS, `upscale_${status ?? 'null'}`);
      return 'retry';
    }

    const list = await client.getJson<{ images: string[] }>(
      paths.readChapterXl(job.title, job.chapter),
      ReadChapterXlResponseSchema,
    );
    if (!list.ok) return fail(`xl_list_${list.reason}${list.status ? `_${list.status}` : ''}`);
    const images = list.value.images;
    if (images.length === 0) return fail('xl_empty');

    const tmp = chapterXlTmpDir(files, job.title, job.chapter);
    await files.makeDir(tmp);
    const name = (i: number) => `${String(i + 1).padStart(3, '0')}.${extOf(images[i])}`;
    const pending: number[] = [];
    for (let i = 0; i < images.length; i++) {
      if ((await files.size(`${tmp}/${name(i)}`)) <= 0) pending.push(i);
    }

    let failed = false;
    let stopped = false;
    const pump = async (): Promise<void> => {
      while (!failed && !stopped) {
        if (shouldStop?.()) {
          stopped = true;
          return;
        }
        const index = pending.shift();
        if (index === undefined) return;
        const ok = await semaphore.run(async () => {
          const url = client.url(images[index]);
          if (!url) return false;
          const dest = `${tmp}/${name(index)}`;
          const r = await files.download(url, dest);
          if (!r.ok || r.bytes <= 0) {
            await files.remove(dest);
            return false;
          }
          return true;
        });
        if (!ok) failed = true;
      }
    };
    await Promise.all(Array.from({ length: MAX_CONCURRENT_PAGES }, pump));

    if (failed) return fail('xl_download_failed');
    if (stopped && pending.length > 0) {
      requeue(db, job.id);
      return 'retry';
    }

    // The xl set is the source of truth for the upscaled version.
    if (images.length !== row.pages) {
      log(db, 'warn', 'jobs', `xl page count differs: ${job.title} / ${job.chapter} ${row.pages} -> ${images.length}`);
    }
    // False = the chapter vanished meanwhile; the job ends with no effect.
    const swapped = await replaceChapterImages(db, files, {
      title: job.title,
      chapter: job.chapter,
      pages: images.length,
      quality: 'xl',
    });
    if (!swapped) log(db, 'info', 'jobs', `upgrade skipped, chapter gone: ${job.title} / ${job.chapter}`);
    markDone(db, job.id);
    return 'done';
  } catch (err) {
    if (getJob(db, job.id)) return fail(`error_${err instanceof Error ? err.message : String(err)}`.slice(0, 200));
    return 'cancelled';
  }
}
