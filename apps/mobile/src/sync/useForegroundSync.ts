import { useEffect } from 'react';
import { AppState } from 'react-native';

import { db } from '../db/client';
import { startForegroundDrain } from '../jobs/drain';
import { recoverInterrupted } from '../jobs/repo';
import { createClient } from '../net/client';
import { getServerState, subscribeServerState } from '../server/status';
import { expoFileStore } from '../storage/files';
import { registerSyncTask } from './backgroundTask';
import { runCycle } from './cycle';

const sync = () => void runCycle({ mode: 'foreground' });

/**
 * Foreground triggers: app open, back to `active`, server turning `online`.
 * Also arms the periodic background task and the enqueue-driven drain.
 */
export function useForegroundSync(): void {
  useEffect(() => {
    // Jobs left `running` by a killed process go back to the queue first.
    recoverInterrupted(db);
    const stopDrain = startForegroundDrain({
      db,
      files: expoFileStore,
      client: createClient({ db }),
    });
    void registerSyncTask();
    sync();

    let last = getServerState().status;
    const unsubscribe = subscribeServerState(() => {
      const status = getServerState().status;
      if (status === 'online' && last !== 'online') sync();
      last = status;
    });
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') sync();
    });
    return () => {
      stopDrain();
      unsubscribe();
      appState.remove();
    };
  }, []);
}
