import { Image } from 'expo-image';

import type { Db } from '../db/types';
import { log } from '../diag/log';
import { setSetting } from '../settings/repo';
import { acceptPendingServer } from '../server/status';
import { disconnectBind } from './bind';
import { CURSOR_KEY } from './catalog';
import { runCycle } from './cycle';

async function clearImageCaches(): Promise<void> {
  try {
    await Promise.all([Image.clearMemoryCache(), Image.clearDiskCache()]);
  } catch {
    // Best effort: a stale cached image is not worth failing the switch.
  }
}

/**
 * Makes the app follow another server: adopts its id, rewinds the catalog so
 * the next sync is a full one (titles, metadata and covers come from the new
 * server, and titles it does not have go away), and disconnects the bind,
 * since bind codes live on a server. Downloads and local history stay.
 */
export async function adoptServer(db: Db, serverId: string): Promise<void> {
  setSetting(db, 'server.id', serverId);
  setSetting(db, CURSOR_KEY, '0');
  disconnectBind(db);
  log(db, 'info', 'server', `switched to server ${serverId.slice(0, 8)}; catalog will fully resync`);
  await clearImageCaches();
}

/** "Usar este servidor" on the mismatch banner. */
export async function adoptPendingServer(db: Db, pendingId: string | null): Promise<void> {
  acceptPendingServer(db);
  if (pendingId) await adoptServer(db, pendingId);
}

/** Full catalog reload from the current server (also drops cached images). */
export async function reloadCatalog(db: Db) {
  setSetting(db, CURSOR_KEY, '0');
  log(db, 'info', 'sync.catalog', 'full reload requested');
  await clearImageCaches();
  return runCycle({ mode: 'foreground' });
}
