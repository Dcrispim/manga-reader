import { useCallback, useState } from 'react';

import { runCycle } from './cycle';

/** Pull-to-refresh: runs one foreground sync cycle while the spinner shows. */
export function usePullRefresh() {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void runCycle({ mode: 'foreground' }).finally(() => setRefreshing(false));
  }, []);
  return { refreshing, onRefresh };
}
