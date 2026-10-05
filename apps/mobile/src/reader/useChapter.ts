import { ReadChapterResponseSchema, paths } from '@manga/api-contract';
import { HISTORY_MIN_OPEN_MS } from '@manga/core';
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

/** A remote page is `pending` while its single download into the cache runs. */
export type ChapterPage = PageSource & { pending?: boolean };

export type ChapterState =
  | { status: 'loading' }
  | { status: 'ready'; pages: ChapterPage[] }
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
  /** How long the chapter must stay open before it enters history (tests shorten it). */
  historyDelayMs?: number;
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
  const historyDelayMs = input.historyDelayMs ?? HISTORY_MIN_OPEN_MS;
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
  // History also waits until the chapter stayed open HISTORY_MIN_OPEN_MS, so
  // leaving earlier (or a mis-tap) records nothing.
  const ready = state.status === 'ready';
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      try {
        recordOpen(db, title, chapter, Date.now());
      } catch {
        // History is best-effort.
      }
    }, historyDelayMs);
    return () => clearTimeout(timer);
  }, [db, title, chapter, ready, historyDelayMs]);

  useEffect(() => {
    if (!ready) return;
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
      // The cache holds originals only, so xl pages are shown straight from the server.
      if (quality !== 'original') {
        setState({ status: 'ready', pages: r.pages });
        return;
      }
      // Each remote page is downloaded once, into the cache, and shown from
      // there (showing the URL too would fetch every page twice).
      setState({
        status: 'ready',
        pages: r.pages.map((p) => (p.kind === 'remote' ? { ...p, pending: true } : p)),
      });
      const settle = (index: number, page: Partial<ChapterPage>) =>
        setState((s) =>
          s.status !== 'ready'
            ? s
            : { ...s, pages: s.pages.map((p) => (p.index === index ? { ...p, ...page } : p)) },
        );
      const remote = r.pages.filter((p) => p.kind === 'remote');
      let cursor = 0;
      const worker = async () => {
        while (!cancelled && cursor < remote.length) {
          const p = remote[cursor++];
          const dest = await fetchToTransient({
            db,
            files,
            client,
            title,
            chapter,
            page: p.index,
            imagePath: imagePathOf(p.uri),
          });
          if (cancelled) return;
          // A failed download falls back to loading the URL directly.
          settle(p.index, dest ? { kind: 'transient', uri: dest, pending: false } : { pending: false });
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
