import type { ServerStatus } from '../server/status';

export type CycleMode = 'foreground' | 'background';

export interface CycleOptions {
  mode: CycleMode;
  /** Total time budget in ms (background ~25 s); omit for no limit. */
  budgetMs?: number;
}

export interface CycleSummary {
  mode: CycleMode;
  ran: string[];
  failed: string[];
  durationMs: number;
}

/** Everything the cycle touches, injectable so tests run with fakes. */
export interface CycleDeps {
  now: () => number;
  isWifi: () => Promise<boolean>;
  checkServer: () => Promise<ServerStatus>;
  syncBind: () => Promise<unknown>;
  syncCatalog: () => Promise<unknown>;
  drain: (opts: { deadlineMs?: number }) => Promise<{ ran: number; skipped: boolean }>;
  enforceSpace: () => Promise<void>;
  /** One info line per cycle (diag_log scope 'cycle'). */
  log: (message: string) => void;
}

// A second cycle would double the requests, so concurrent callers share one.
let inflight: Promise<CycleSummary> | null = null;

async function execute(opts: CycleOptions, deps: CycleDeps): Promise<CycleSummary> {
  const start = deps.now();
  const ran: string[] = [];
  const failed: string[] = [];

  // Each step is isolated: one that throws must not stop the following ones.
  const step = async (name: string, fn: () => Promise<unknown>): Promise<boolean> => {
    try {
      await fn();
      ran.push(name);
      return true;
    } catch {
      failed.push(name);
      return false;
    }
  };

  let online = false;
  // In background, no Wi-Fi means no network at all (not even the health probe).
  let allowed = true;
  if (opts.mode === 'background') {
    try {
      allowed = await deps.isWifi();
    } catch {
      allowed = false;
    }
  }
  if (allowed) {
    const probe: { status: ServerStatus } = { status: 'offline' };
    const ok = await step('health', async () => {
      probe.status = await deps.checkServer();
    });
    // `mismatch` is not `online`, so it never reaches the network steps.
    online = ok && probe.status === 'online';
  }

  if (online) {
    await step('bind', deps.syncBind);
    await step('catalog', deps.syncCatalog);
    const remaining =
      opts.budgetMs === undefined ? undefined : opts.budgetMs - (deps.now() - start);
    if (remaining === undefined || remaining > 0) {
      await step('drain', () => deps.drain({ deadlineMs: remaining }));
    }
  }

  // Eviction always runs, also offline and in background.
  await step('space', deps.enforceSpace);

  const summary: CycleSummary = {
    mode: opts.mode,
    ran,
    failed,
    durationMs: deps.now() - start,
  };
  try {
    deps.log(
      `mode=${summary.mode} ${summary.durationMs}ms ran=${ran.join(',') || '-'}` +
        (failed.length ? ` failed=${failed.join(',')}` : ''),
    );
  } catch {
    // Logging must never break the cycle.
  }
  return summary;
}

/** Runs one sync cycle. Never rejects; concurrent calls share the same run. */
export function runCycle(opts: CycleOptions, deps?: CycleDeps): Promise<CycleSummary> {
  if (inflight) return inflight;
  const run = (async () => {
    const d = deps ?? (await (await import('./cycleDeps')).createCycleDeps());
    return execute(opts, d);
  })()
    .catch(
      (): CycleSummary => ({ mode: opts.mode, ran: [], failed: ['cycle'], durationMs: 0 }),
    )
    .finally(() => {
      inflight = null;
    });
  inflight = run;
  return run;
}
