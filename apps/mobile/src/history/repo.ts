import { and, eq } from 'drizzle-orm';
import {
  getLatestChapter,
  type BindPayload,
  type TitleHistory,
} from '@manga/core';

import { history } from '../db/schema';
import type { Db } from '../db/types';

const KEEP_RECENT = 5;

/**
 * Same semantics as core's recordChapterOpen: the timestamp is written only
 * on the first open, so reopening never changes opened_at. Returns true when
 * a new row was inserted.
 */
export function recordOpen(
  db: Db,
  title: string,
  chapter: string,
  now: number,
): boolean {
  const res = db
    .insert(history)
    .values({ title, chapter, openedAt: now, pending: 1 })
    .onConflictDoNothing()
    .run();
  return res.changes > 0;
}

/**
 * Derives the core view from the table: openedAt per title, history = the
 * 5 most recently opened chapters (oldest first, like core), lastRead = max.
 */
export function toTitleHistories(db: Db): Record<string, TitleHistory> {
  const rows = db.select().from(history).all();
  const out: Record<string, TitleHistory> = {};
  for (const r of rows) {
    const entry = (out[r.title] ??= { lastRead: null, history: [], openedAt: {} });
    entry.openedAt[r.chapter] = r.openedAt;
  }
  for (const entry of Object.values(out)) {
    const sorted = Object.entries(entry.openedAt).sort(
      (a, b) => a[1] - b[1] || a[0].localeCompare(b[0]),
    );
    entry.history = sorted.slice(-KEEP_RECENT).map(([c]) => c);
    entry.lastRead = sorted.length ? sorted[sorted.length - 1][1] : null;
  }
  return out;
}

/**
 * Writes a merged snapshot back. Unknown chapters are inserted as already
 * synced (pending=0) so what other devices read counts as read here; an
 * existing row only ever moves to a later opened_at (the merge's max).
 */
export function applyMerged(db: Db, merged: BindPayload): void {
  const current = db.select().from(history).all();
  const known = new Map(current.map((r) => [`${r.title}\u0000${r.chapter}`, r]));
  db.transaction((tx) => {
    for (const [title, entry] of Object.entries(merged.history)) {
      for (const [chapter, openedAt] of Object.entries(entry.openedAt)) {
        const row = known.get(`${title}\u0000${chapter}`);
        if (!row) {
          tx.insert(history)
            .values({ title, chapter, openedAt, pending: 0 })
            .onConflictDoNothing()
            .run();
        } else if (openedAt > row.openedAt) {
          tx.update(history)
            .set({ openedAt })
            .where(and(eq(history.title, title), eq(history.chapter, chapter)))
            .run();
        }
      }
    }
  });
}

export function isRead(db: Db, title: string, chapter: string): boolean {
  const row = db
    .select({ c: history.chapter })
    .from(history)
    .where(and(eq(history.title, title), eq(history.chapter, chapter)))
    .get();
  return row !== undefined;
}

export function latestChapter(db: Db, title: string): string | null {
  return getLatestChapter(toTitleHistories(db)[title]);
}

/** Marks the given (title -> chapters) pairs as sent. */
export function markSynced(
  db: Db,
  sent: Record<string, string[]>,
): void {
  db.transaction((tx) => {
    for (const [title, chapters] of Object.entries(sent)) {
      for (const chapter of chapters) {
        tx.update(history)
          .set({ pending: 0 })
          .where(and(eq(history.title, title), eq(history.chapter, chapter)))
          .run();
      }
    }
  });
}

export function pendingPairs(db: Db): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const r of db.select().from(history).where(eq(history.pending, 1)).all()) {
    (out[r.title] ??= {})[r.chapter] = r.openedAt;
  }
  return out;
}
