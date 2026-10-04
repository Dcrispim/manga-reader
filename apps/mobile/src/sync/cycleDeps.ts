import { getNetworkStateAsync, NetworkStateType } from 'expo-network';

import { db } from '../db/client';
import { log } from '../diag/log';
import { drainQueue } from '../jobs/drain';
import { createClient } from '../net/client';
import { checkServer, getServerState } from '../server/status';
import { enforceSpace } from '../storage/downloads';
import { expoFileStore } from '../storage/files';
import { syncBind } from './bind';
import { syncCatalog } from './catalog';
import type { CycleDeps } from './cycle';

// Kept apart from cycle.ts so the orchestrator (and its tests) never import
// the native modules; cycle.ts loads this lazily.
export function createCycleDeps(): CycleDeps {
  const client = createClient({ db });
  return {
    now: Date.now,
    isWifi: async () => (await getNetworkStateAsync()).type === NetworkStateType.WIFI,
    checkServer: () => checkServer(client, db),
    syncBind: () =>
      syncBind({ db, client, now: Date.now(), status: getServerState().status }),
    syncCatalog: () => syncCatalog({ db, client, files: expoFileStore }),
    drain: (opts) => drainQueue({ db, files: expoFileStore, client }, opts),
    enforceSpace: () => enforceSpace(db, expoFileStore, []),
    log: (message) => log(db, 'info', 'cycle', message),
  };
}
