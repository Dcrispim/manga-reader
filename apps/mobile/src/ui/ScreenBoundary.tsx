import { usePathname, useRouter } from 'expo-router';
import type { ReactNode } from 'react';

import { db } from '../db/client';
import { log } from '../diag/log';
import { ErrorBoundary } from './ErrorBoundary';

/** Route-level wrapper: resets on navigation, logs to diag_log, goes back or home. */
export function ScreenBoundary({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <ErrorBoundary
      key={pathname}
      onError={(e) => log(db, 'error', 'ui.screen', `${pathname}: ${e.message}`)}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    >
      {children}
    </ErrorBoundary>
  );
}
