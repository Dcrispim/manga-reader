import { runCycle, type CycleDeps } from '../cycle';
import type { ServerStatus } from '../../server/status';

function fakes(over: Partial<CycleDeps> & { status?: ServerStatus } = {}) {
  const calls: string[] = [];
  const logs: string[] = [];
  const { status = 'online', ...rest } = over;
  let t = 0;
  const deps: CycleDeps = {
    now: () => t,
    isWifi: async () => true,
    checkServer: async () => {
      calls.push('health');
      return status;
    },
    syncBind: async () => void calls.push('bind'),
    syncCatalog: async () => void calls.push('catalog'),
    drain: async () => {
      calls.push('drain');
      return { ran: 0, skipped: false };
    },
    enforceSpace: async () => void calls.push('space'),
    log: (m) => void logs.push(m),
    ...rest,
  };
  return { deps, calls, logs, tick: (n: number) => (t += n) };
}

describe('runCycle', () => {
  it('runs every step in order when online', async () => {
    const f = fakes();
    await runCycle({ mode: 'foreground' }, f.deps);
    expect(f.calls).toEqual(['health', 'bind', 'catalog', 'drain', 'space']);
  });

  it('only enforces space when offline', async () => {
    const f = fakes({ status: 'offline' });
    await runCycle({ mode: 'foreground' }, f.deps);
    expect(f.calls).toEqual(['health', 'space']);
  });

  it('only enforces space in background without Wi-Fi', async () => {
    const f = fakes({ isWifi: async () => false });
    await runCycle({ mode: 'background', budgetMs: 25000 }, f.deps);
    expect(f.calls).toEqual(['space']);
  });

  it('does nothing but enforce space on mismatch', async () => {
    const f = fakes({ status: 'mismatch' });
    await runCycle({ mode: 'background', budgetMs: 25000 }, f.deps);
    expect(f.calls).toEqual(['health', 'space']);
  });

  it('keeps going when a step throws', async () => {
    const f = fakes({
      syncBind: async () => {
        throw new Error('boom');
      },
    });
    const s = await runCycle({ mode: 'foreground' }, f.deps);
    expect(f.calls).toEqual(['health', 'catalog', 'drain', 'space']);
    expect(s.failed).toEqual(['bind']);
  });

  it('shares one run between simultaneous calls', async () => {
    const f = fakes();
    const [a, b] = [runCycle({ mode: 'foreground' }, f.deps), runCycle({ mode: 'foreground' }, f.deps)];
    expect(a).toBe(b);
    await a;
    expect(f.calls.filter((c) => c === 'health')).toHaveLength(1);
    // The lock is released afterwards.
    await runCycle({ mode: 'foreground' }, f.deps);
    expect(f.calls.filter((c) => c === 'health')).toHaveLength(2);
  });

  it('passes the remaining budget to the drain', async () => {
    const drain = jest.fn(async () => ({ ran: 0, skipped: false }));
    const f = fakes({ drain });
    f.deps.syncCatalog = async () => void f.tick(5000);
    await runCycle({ mode: 'background', budgetMs: 25000 }, f.deps);
    expect(drain).toHaveBeenCalledWith({ deadlineMs: 20000 });
  });

  it('skips the drain when the budget is spent and passes no deadline in foreground', async () => {
    const drain = jest.fn(async () => ({ ran: 0, skipped: false }));
    const f = fakes({ drain });
    f.deps.syncCatalog = async () => void f.tick(30000);
    await runCycle({ mode: 'background', budgetMs: 25000 }, f.deps);
    expect(drain).not.toHaveBeenCalled();
    await runCycle({ mode: 'foreground' }, f.deps);
    expect(drain).toHaveBeenCalledWith({ deadlineMs: undefined });
  });

  it('logs one line with mode and what ran', async () => {
    const f = fakes();
    await runCycle({ mode: 'background', budgetMs: 25000 }, f.deps);
    expect(f.logs).toHaveLength(1);
    expect(f.logs[0]).toContain('mode=background');
    expect(f.logs[0]).toContain('ran=health,bind,catalog,drain,space');
  });
});
