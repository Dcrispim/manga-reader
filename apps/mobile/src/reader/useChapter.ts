import { ReadChapterResponseSchema, paths } from '@manga/api-contract';
import { useEffect, useRef, useState } from 'react';

import type { Db } from '../db/types';
import { recordOpen } from '../history/repo';
import { enqueue, isAutoNext } from '../jobs/repo';
import { requestDrain } from '../jobs/drain';
import type { FileStore } from '../storage/files';
import { fetchToTransient } from '../storage/transient';
import { clearOpenChapter, setOpenChapter } from './openChapter';
import { resolveChapterPages, type PageSource, type ResolverClient } from './resolve';

export type Quality = 'original' | 'xl';

export type ChapterState =
  | { status: 'loading' }
  | { status: 'ready'; pages: PageSource[] }
  | { status: 'unavailable' };

export interface UseChapterInput {
  db: Db;
  client: ResolverClient;
  files: FileStore;
  title: string;
  chapter: string;
  /** Next chapter in the title's list, or null; queued when downloads.autoNext is on. */
  next: string | null;
  online: boolean;
}

/** Remote pages are cached two at a time, like the download queue. */
const CACHE_CONCURRENCY = 2;

/** Path part of an absolute page URL (fetchToTransient wants the server-relative path). */
export function imagePathOf(uri: string): string {
  return uri.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, '');
}

/**
 * Loads a chapter's pages from the best origin and does the bookkeeping that
 * opening it implies: history entry, "open chapter" guard for the space
 * policy, optional auto-queue of the next chapter, and caching of remote pages
 * while they are shown. Never throws and never surfaces errors.
 */
export function useChapter(input: UseChapterInput) {
  const { db, client, files, title, chapter, next, online } = input;
  const [wanted, setWanted] = useState<Quality>('original');
  const [state, setState] = useState<ChapterState>({ status: 'loading' });
  const [xlAvailable, setXlAvailable] = useState(false);
  const [reload, setReload] = useState(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Offline, xl silently falls back to original.
  const quality: Quality = online && xlAvailable ? wanted : 'original';

  // The open-chapter guard is set on entry; it only protects from eviction.
  useEffect(() => {
    setOpenChapter(title, chapter);
    return () => clearOpenChapter();
  }, [title, chapter]);

  // History ("read") and auto-next only once the chapter really has pages: an
  // unavailable chapter must not count as read nor be propagated by bind.
  const ready = state.status === 'ready';
  useEffect(() => {
    if (!ready) return;
    try {
      recordOpen(db, title, chapter, Date.now());
    } catch {
      // History is best-effort.
    }
    if (next && isAutoNext(db)) {
      enqueue(db, 'download', title, next);
      requestDrain();
    }
  }, [db, title, chapter, next, ready]);

  useEffect(() => {
    let cancelled = false;
    setState((s) => (s.status === 'ready' ? s : { status: 'loading' }));
    void (async () => {
      const r = await resolveChapterPages({ db, client, files, title, chapter, quality });
      if (cancelled) return;
      if ('unavailable' in r) {
        setState({ status: 'unavailable' });
        return;
      }
      setState({ status: 'ready', pages: r.pages });
      // The cache holds originals only, so xl pages are never stored.
      if (quality !== 'original') return;
      const remote = r.pages.filter((p) => p.kind === 'remote');
      let cursor = 0;
      const worker = async () => {
        while (!cancelled && cursor < remote.length) {
          const p = remote[cursor++];
          await fetchToTransient({
            db,
            files,
            client,
            title,
            chapter,
            page: p.index,
            imagePath: imagePathOf(p.uri),
          });
        }
      };
      await Promise.all(Array.from({ length: CACHE_CONCURRENCY }, worker));
    })();
    return () => {
      cancelled = true;
    };
  }, [db, client, files, title, chapter, quality, reload]);

  // A chapter that was unavailable gets another try when the server comes back.
  useEffect(() => {
    if (online && stateRef.current.status === 'unavailable') setReload((n) => n + 1);
  }, [online]);

  // The toggle only exists when the server is online and /xl lists pages.
  useEffect(() => {
    let cancelled = false;
    if (!online) {
      setXlAvailable(false);
      return;
    }
    void (async () => {
      const r = await client.getJson<{ images: string[] }>(
        paths.readChapterXl(title, chapter),
        ReadChapterResponseSchema,
      );
      if (!cancelled) setXlAvailable(r.ok && r.value.images.length > 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [online, client, title, chapter]);

  return { state, quality, setQuality: setWanted, xlAvailable };
}
