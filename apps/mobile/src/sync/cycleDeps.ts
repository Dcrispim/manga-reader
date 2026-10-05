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
import { recordOutcome } from './syncStatus';

// Kept apart from cycle.ts so the orchestrator (and its tests) never import
// the native modules; cycle.ts loads this lazily.
export function createCycleDeps(): CycleDeps {
  const client = createClient({ db });
  return {
    now: Date.now,
    isWifi: async () => (await getNetworkStateAsync()).type === NetworkStateType.WIFI,
    checkServer: () => checkServer(client, db),
    syncBind: async () => {
      const r = await syncBind({ db, client, now: Date.now(), status: getServerState().status });
      recordOutcome(db, 'bind', r);
      return r;
    },
    syncCatalog: async () => {
      const r = await syncCatalog({ db, client, files: expoFileStore });
      recordOutcome(db, 'catalog', r);
      return r;
    },
    drain: (opts) => drainQueue({ db, files: expoFileStore, client }, opts),
    enforceSpace: () => enforceSpace(db, expoFileStore, []),
    log: (message) => log(db, 'info', 'cycle', message),
  };
}
