import { useLiveQuery } from '../db/liveQuery';
import { useMemo } from 'react';

import { db } from '../db/client';
import {
  buildCatalog,
  categoriesOf,
  continueReading,
  downloadedTitles,
  q,
} from './queries';

/** Whole catalog, kept fresh by live queries on titles and chapter_sources. */
export function useCatalog() {
  const { data: rows } = useLiveQuery(q.titles(db));
  const { data: counts } = useLiveQuery(q.chapterCounts(db));
  return useMemo(() => buildCatalog(rows ?? [], counts ?? []), [rows, counts]);
}

export function useCategories() {
  const catalog = useCatalog();
  return useMemo(() => ({ catalog, map: categoriesOf(catalog) }), [catalog]);
}

export function useHomeLists() {
  const catalog = useCatalog();
  const { data: hist } = useLiveQuery(q.history(db));
  const { data: dls } = useLiveQuery(q.downloads(db));
  return useMemo(() => {
    const known = new Set(catalog.map((t) => t.name));
    return {
      catalog,
      continueItems: continueReading(hist ?? [], known),
      downloaded: downloadedTitles(dls ?? [], known),
    };
  }, [catalog, hist, dls]);
}
