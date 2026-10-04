import { ReadChapterResponseSchema, paths } from '@manga/api-contract';

import type { Db } from '../db/types';
import type { Result } from '../lib/result';
import { listDownloadedPages } from '../storage/downloads';
import type { FileStore } from '../storage/files';
import {
  cachedPages,
  getPageCount,
  isChapterFullyCached,
  setPageCount,
  touch,
} from '../storage/transient';
import type { ZodSchema } from 'zod';

export interface PageSource {
  kind: 'local' | 'download' | 'transient' | 'remote';
  uri: string;
  index: number;
}

/** The slice of the HTTP client the resolver uses. */
export interface ResolverClient {
  getJson<T>(path: string, schema: ZodSchema): Promise<Result<T>>;
  url(pathOrRelative: string): string | null;
}

/** Page URIs of a chapter in a local (SAF) source, or null if it has none. */
export type LocalPageProvider = (title: string, chapter: string) => Promise<string[] | null>;

// Extension point for M4-17 (SAF sources): until then there are no local sources.
let localPageProvider: LocalPageProvider = async () => null;

export function setLocalPageProvider(provider: LocalPageProvider): void {
  localPageProvider = provider;
}

export interface ResolveInput {
  db: Db;
  client: ResolverClient;
  files: FileStore;
  title: string;
  chapter: string;
  quality: 'original' | 'xl';
}

type ImageList = { images: string[] };

/**
 * Best origin per page: local source > download > transient cache > server.
 * A chapter that is only partly available and cannot be completed from the
 * server is `unavailable` rather than shown half-way.
 */
export async function resolveChapterPages(
  input: ResolveInput,
): Promise<{ pages: PageSource[] } | { unavailable: true }> {
  const { db, client, files, title, chapter, quality } = input;
  try {
    const local = await localPageProvider(title, chapter);
    if (local && local.length > 0) {
      return { pages: local.map((uri, index) => ({ kind: 'local', uri, index })) };
    }

    const downloaded = await listDownloadedPages(files, title, chapter);
    if (downloaded.length > 0) {
      return { pages: downloaded.map((uri, index) => ({ kind: 'download', uri, index })) };
    }

    // The cache only holds original-quality pages.
    if (quality === 'original') {
      const count = getPageCount(db, title, chapter);
      if (count !== null && (await isChapterFullyCached(db, files, title, chapter, count))) {
        touch(db, title, chapter);
        const cached = await cachedPages(db, files, title, chapter);
        return {
          pages: Array.from({ length: count }, (_, index) => ({
            kind: 'transient' as const,
            uri: cached.get(index)!,
            index,
          })),
        };
      }
    }

    let list: Result<ImageList> | null = null;
    let fromXl = false;
    if (quality === 'xl') {
      list = await client.getJson<ImageList>(
        paths.readChapterXl(title, chapter),
        ReadChapterResponseSchema,
      );
      // No upscaled version (404 or anything else): fall back to the original.
      if (list.ok) fromXl = true;
      else list = null;
    }
    if (!list) {
      list = await client.getJson<ImageList>(
        paths.readChapter(title, chapter),
        ReadChapterResponseSchema,
      );
    }
    if (!list.ok || list.value.images.length === 0) return { unavailable: true };

    const images = list.value.images;
    // Cached pages and the stored count describe the original, not the xl list.
    const cached = fromXl ? new Map<number, string>() : await cachedPages(db, files, title, chapter);
    if (!fromXl) setPageCount(db, title, chapter, images.length);
    const pages: PageSource[] = [];
    for (let index = 0; index < images.length; index++) {
      const hit = cached.get(index);
      if (hit) {
        pages.push({ kind: 'transient', uri: hit, index });
        continue;
      }
      const uri = client.url(images[index]);
      if (!uri) return { unavailable: true };
      pages.push({ kind: 'remote', uri, index });
    }
    return { pages };
  } catch {
    return { unavailable: true };
  }
}
