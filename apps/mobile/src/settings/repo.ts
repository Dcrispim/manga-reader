import { eq } from 'drizzle-orm';

import { settings } from '../db/schema';
import type { Db } from '../db/types';

export const DEFAULTS = {
  'server.host': 'localhost',
  'server.port': '3993',
} as const;

/**
 * Get a setting value by key.
 * Returns null if not set (ignores defaults for explicit unconfigured check).
 */
export function getSetting(db: Db, key: string): string | null {
  try {
    const row = db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, key))
      .get();

    return row?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Set a setting value by key.
 * Never throws.
 */
export function setSetting(db: Db, key: string, value: string): void {
  try {
    db.insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } })
      .run();
  } catch {
    // Silently ignore setting errors
  }
}

/**
 * Get the server base URL (http://host:port) from settings.
 * Returns null if not configured.
 */
export function getServerBase(db: Db): string | null {
  try {
    const host = getSetting(db, 'server.host');
    const portStr = getSetting(db, 'server.port');

    if (!host || !portStr) {
      return null;
    }

    const port = parseInt(portStr, 10);
    if (isNaN(port)) {
      return null;
    }

    return `http://${host}:${port}`;
  } catch {
    return null;
  }
}
