import { ReadChapterResponseSchema, paths } from '@manga/api-contract';
import { DEFAULT_LIMITS, canAdmit, projectChapterBytes } from '@manga/core';
import type { ZodSchema } from 'zod';

import type { Db } from '../db/types';
import { log } from '../diag/log';
import type { Result } from '../lib/result';
import { getSetting } from '../settings/repo';
import { chapterTmpDir, commitChapter } from '../storage/downloads';
import type { FileStore } from '../storage/files';
import { promoteToDownload } from '../storage/transient';
import {
  markDone,
  markFailed,
  markPaused,
  markProgress,
  markRunning,
  requeue,
  reschedule,
  type Job,
} from './repo';

/** At most this many image requests at once, across every job (small servers). */
export const MAX_CONCURRENT_PAGES = 2;

export interface Semaphore {
  run<T>(fn: () => Promise<T>): Promise<T>;
}

export function createSemaphore(limit: number): Semaphore {
  let active = 0;
  const waiting: (() => void)[] = [];
  const acquire = async (): Promise<void> => {
    if (active < limit) {
      active++;
      return;
    }
    // The slot is handed over directly by release(), so `active` stays put.
    await new Promise<void>((resolve) => waiting.push(resolve));
  };
  const release = (): void => {
    const next = waiting.shift();
    if (next) next();
    else active--;
  };
  return {
    async run(fn) {
      await acquire();
      try {
        return await fn();
      } finally {
        release();
      }
    },
  };
}

export interface WorkerClient {
  getJson<T>(path: string, schema: ZodSchema): Promise<Result<T>>;
  /** Only the upgrade worker needs it (upscale request); absent = unreachable. */
  postJson?<T>(path: string, body: unknown, schema: ZodSchema): Promise<Result<T>>;
  url(pathOrRelative: string): string | null;
}

export interface WorkerDeps {
  db: Db;
  files: FileStore;
  client: WorkerClient;
  /** Injectable clock so backoff is testable. */
  now: () => number;
  /** Shared by every worker so the 2-request cap is global. */
  semaphore: Semaphore;
  /** True once the background deadline passed; checked between pages. */
  shouldStop?: () => boolean;
}

export type JobOutcome = 'done' | 'paused' | 'retry' | 'failed';

function extOf(path: string): string {
  const name = path.split('?')[0].split('#')[0].split('/').pop() ?? '';
  const m = /\.([A-Za-z0-9]{1,5})$/.exec(name);
  return m ? m[1].toLowerCase() : 'jpg';
}

function pageName(index: number, imagePath: string): string {
  return `${String(index + 1).padStart(3, '0')}.${extOf(imagePath)}`;
}

function minFreeBytes(db: Db): number {
  const raw = getSetting(db, 'space.minFreeBytes');
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_LIMITS.minFreeBytes;
}

/** Page indexes already in the tmp dir with content (resume skips them). */
async function presentPages(files: FileStore, tmp: string): Promise<Set<number>> {
  const out = new Set<number>();
  for (const name of await files.listDir(tmp)) {
    const m = /^(\d+)\./.exec(name);
    if (!m) continue;
    if ((await files.size(`${tmp}/${name}`)) > 0) out.add(Number(m[1]) - 1);
  }
  return out;
}

/**
 * Runs one download job. Never throws. Only a 404 for the chapter list ends a
 * job as `failed`; any other trouble keeps it `queued` with a backoff.
 */
export async function runDownloadJob(job: Job, deps: WorkerDeps): Promise<JobOutcome> {
  const { db, files, client, now, semaphore, shouldStop } = deps;
  const fail = (reason: string): JobOutcome => {
    reschedule(db, job.id, reason, now());
    return 'retry';
  };
  try {
    markRunning(db, job.id);

    // Fully cached while reading online: moving it needs no network.
    if (await promoteToDownload(db, files, job.title, job.chapter)) {
      markDone(db, job.id);
      return 'done';
    }

    const list = await client.getJson<{ images: string[] }>(
      paths.readChapter(job.title, job.chapter),
      ReadChapterResponseSchema,
    );
    if (!list.ok) {
      if (list.reason === 'http' && list.status === 404) {
        await files.remove(chapterTmpDir(files, job.title, job.chapter));
        markFailed(db, job.id, 'not_found');
        log(db, 'warn', 'jobs', `chapter gone: ${job.title} / ${job.chapter}`);
        return 'failed';
      }
      return fail(`list_${list.reason}${list.status ? `_${list.status}` : ''}`);
    }
    const images = list.value.images;
    if (images.length === 0) return fail('empty_chapter');

    const tmp = chapterTmpDir(files, job.title, job.chapter);
    const done = await presentPages(files, tmp);

    // Bytes already on disk for this chapter are not asked for again.
    const projected = Math.max(
      0,
      projectChapterBytes(images.length) - (await files.size(tmp)),
    );
    if (!canAdmit(await files.freeDiskBytes(), projected, minFreeBytes(db))) {
      markProgress(db, job.id, done.size, images.length);
      markPaused(db, job.id, 'no_space');
      return 'paused';
    }

    await files.makeDir(tmp);
    markProgress(db, job.id, done.size, images.length);

    const pending: number[] = [];
    for (let i = 0; i < images.length; i++) if (!done.has(i)) pending.push(i);

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
          const dest = `${tmp}/${pageName(index, images[index])}`;
          const r = await files.download(url, dest);
          if (!r.ok || r.bytes <= 0) {
            await files.remove(dest);
            return false;
          }
          return true;
        });
        if (!ok) {
          failed = true;
          return;
        }
        done.add(index);
        markProgress(db, job.id, done.size, images.length);
      }
    };
    await Promise.all(Array.from({ length: MAX_CONCURRENT_PAGES }, pump));

    if (failed) return fail('download_failed');
    if (stopped && done.size < images.length) {
      requeue(db, job.id);
      return 'retry';
    }

    const committed = await commitChapter(db, files, {
      title: job.title,
      chapter: job.chapter,
      pages: images.length,
      quality: 'original',
    });
    if (!committed) return fail('commit_failed');
    markDone(db, job.id);
    return 'done';
  } catch (err) {
    return fail(`error_${err instanceof Error ? err.message : String(err)}`.slice(0, 200));
  }
}
