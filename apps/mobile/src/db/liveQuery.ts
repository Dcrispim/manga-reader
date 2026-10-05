import { getTableName, is } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect, useState } from 'react';

// Delay that groups a burst of change events into one re-run.
const COALESCE_MS = 150;

type LiveQuery<T> = PromiseLike<T> & { config?: { table?: unknown } };

/**
 * Like drizzle's useLiveQuery, but coalesced. expo-sqlite fires one change
 * event per ROW, and drizzle re-runs the query on every event: a catalog sync
 * writing 20k chapter rows re-ran each screen query 20k times, which is what
 * made it take over a minute. Here a burst of events re-runs the query once.
 */
export function useLiveQuery<T>(query: LiveQuery<T>, deps: unknown[] = []): { data: T | undefined } {
  const [data, setData] = useState<T | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = () => {
      query.then(
        (rows) => {
          if (alive) setData(rows);
        },
        () => {
          // Keep the last good rows; the next change retries.
        },
      );
    };
    run();
    const table = query.config?.table;
    const name = is(table, SQLiteTable) ? getTableName(table) : null;
    const listener = name
      ? addDatabaseChangeListener(({ tableName }) => {
          if (tableName !== name || timer) return;
          timer = setTimeout(() => {
            timer = null;
            run();
          }, COALESCE_MS);
        })
      : null;
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      listener?.remove();
    };
    // The query is rebuilt on every render; deps say when it really changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data };
}
