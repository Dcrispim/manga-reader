import { eq } from 'drizzle-orm';

import { diagLog } from '../db/schema';
import type { Db } from '../db/types';

const MAX_MESSAGE_LENGTH = 500;

/**
 * Log a diagnostic message. Never throws.
 * Messages longer than 500 characters are truncated.
 */
export function log(
  db: Db,
  level: string,
  scope: string,
  message: string,
): void {
  try {
    const truncated =
      message.length > MAX_MESSAGE_LENGTH
        ? message.slice(0, MAX_MESSAGE_LENGTH)
        : message;

    db.insert(diagLog)
      .values({
        at: Date.now(),
        level,
        scope,
        message: truncated,
      })
      .run();
  } catch {
    // Silently ignore logging errors
  }
}

/**
 * Trim diag_log to keep only the most recent `max` entries.
 * Deletes oldest entries if the total exceeds max.
 * Never throws.
 */
export function trimLog(db: Db, max: number = 5000): void {
  try {
    const allEntries = db.select().from(diagLog).all();
    const count = allEntries.length;

    if (count <= max) {
      return; // No trimming needed
    }

    // Collect IDs of entries to delete
    const toDelete = count - max;
    const idsToDelete: number[] = [];
    for (let i = 0; i < toDelete; i++) {
      if (allEntries[i]?.id !== undefined) {
        idsToDelete.push(allEntries[i].id as number);
      }
    }

    // Delete entries one by one
    for (const id of idsToDelete) {
      db.delete(diagLog)
        .where(eq(diagLog.id, id))
        .run();
    }
  } catch {
    // Silently ignore trimming errors
  }
}
