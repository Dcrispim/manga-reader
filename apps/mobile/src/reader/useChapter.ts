import { ReadChapterResponseSchema, paths } from '@manga/api-contract';
import { HISTORY_MIN_OPEN_MS } from '@manga/core';
import { useEffect, useRef, useState } from 'react';

import type { Db } from '../db/types';
import { recordOpen } from '../history/repo';
import { downloadAhead, enqueue } from '../jobs/repo';
import { requestDrain } from '../jobs/drain';
import { getLimit } from '../settings/limits';
import { getSetting, setSetting } from '../settings/repo';
import type { FileStore } from '../storage/files';
import { fetchToTransient } from '../storage/transient';
import { chapterId, clearOpenChapter, setOpenChapter } from './openChapter';
import { resolveChapterPages, type PageSource, type ResolverClient } from './resolve';

export type Quality = 'original' | 'xl';

export const QUALITY_KEY = 'reader.quality';

/**
 * The quality last picked in the reader, kept across chapters. Before any
 * pick, upscaled when high-res downloads are on.
 */
export function preferredQuality(db: Db): Quality {
  const saved = getSetting(db, QUALITY_KEY);
  if (saved === 'original' || saved === 'xl') return saved;
  return getSetting(db, 'downloads.highRes') === 'true' ? 'xl' : 'original';
}

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
  /**
   * Chapters after this one, in reading order; the first `downloads.ahead` get
   * queued, never more than the per-title limit (the excess would only evict
   * the chapters right after this one).
   */
  upcoming: string[];
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
  const { db, client, files, title, chapter, upcoming, online } = input;
  const upcomingKey = upcoming.join(',');
  const historyDelayMs = input.historyDelayMs ?? HISTORY_MIN_OPEN_MS;
  const [wanted, setWanted] = useState<Quality>(() => preferredQuality(db));
  const [state, setState] = useState<ChapterState>({ status: 'loading' });
  // null while the /xl check runs.
  const [xlAvailable, setXlAvailable] = useState<boolean | null>(null);
  const [reload, setReload] = useState(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  // Which chapter the `ready` pages belong to.
  const shownRef = useRef<string | null>(null);

  // Offline, xl silently falls back to original.
  const quality: Quality = online && xlAvailable ? wanted : 'original';
  // Wanting xl, wait for the check instead of loading the original first.
  const waitXl = online && wanted === 'xl' && xlAvailable === null;

  const setQuality = (q: Quality) => {
    setWanted(q);
    try {
      setSetting(db, QUALITY_KEY, q);
    } catch {
      // The preference is best-effort.
    }
  };

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
    const n = Math.min(downloadAhead(db), getLimit(db, 'space.maxPerTitle'));
    const ahead = upcomingKey ? upcomingKey.split(',').slice(0, n) : [];
    for (const c of ahead) enqueue(db, 'download', title, c);
    if (ahead.length) requestDrain();
  }, [db, title, chapter, upcomingKey, ready]);

  useEffect(() => {
    if (waitXl) return;
    let cancelled = false;
    setState((s) => (s.status === 'ready' ? s : { status: 'loading' }));
    void (async () => {
      const r = await resolveChapterPages({ db, client, files, title, chapter, quality });
      if (cancelled) return;
      const key = chapterId(title, chapter);
      if ('unavailable' in r) {
        // Going offline (or the quality falling back to original) re-resolves:
        // pages already on screen stay, whatever image cache holds them.
        if (stateRef.current.status === 'ready' && shownRef.current === key) return;
        setState({ status: 'unavailable' });
        return;
      }
      shownRef.current = key;
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
  }, [db, client, files, title, chapter, quality, reload, waitXl]);

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
    setXlAvailable(null);
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

  /** Resolves the chapter again (e.g. after a download committed offline). */
  const retry = () => setReload((n) => n + 1);

  return { state, quality, setQuality, xlAvailable: xlAvailable === true, retry };
}
