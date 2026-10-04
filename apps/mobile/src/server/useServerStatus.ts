import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { db } from '../db/client';
import { createClient } from '../net/client';
import {
  checkServer,
  getServerState,
  subscribeServerState,
  type ServerState,
} from './status';

const REVALIDATE_MS = 30_000;

let client: ReturnType<typeof createClient> | null = null;

/** Re-check the saved server now (used by the hook and after saving). */
export function refreshServer(): Promise<unknown> {
  client ??= createClient({ db });
  return checkServer(client, db);
}

/**
 * Reads the server store; revalidates when the app returns to the foreground
 * and every 30 s while it stays there.
 */
export function useServerStatus(): ServerState {
  const snapshot = useSyncExternalStore(subscribeServerState, getServerState);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      void refreshServer();
      timer ??= setInterval(() => void refreshServer(), REVALIDATE_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    if (AppState.currentState === 'active') start();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') start();
      else stop();
    });
    return () => {
      stop();
      sub.remove();
    };
  }, []);

  return snapshot;
}
