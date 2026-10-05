import type { Db } from '../db/types';
import { getSetting, setSetting } from '../settings/repo';
import type { SyncResult } from './bind';
import type { SyncOutcome } from './catalog';

// The last outcome of each sync, kept in settings so the app can say what
// happened ("nada novo", "sem conexão"...) instead of silently doing nothing.

const KEY = { catalog: 'sync.last.catalog', bind: 'sync.last.bind' } as const;

export type LastRun<T> = { at: number; outcome: T } | null;

export function recordOutcome(db: Db, kind: keyof typeof KEY, outcome: unknown, at = Date.now()): void {
  try {
    setSetting(db, KEY[kind], JSON.stringify({ at, outcome }));
  } catch {
    // Status bookkeeping must never break a sync.
  }
}

export function lastRun<T>(db: Db, kind: keyof typeof KEY): LastRun<T> {
  try {
    const raw = getSetting(db, KEY[kind]);
    return raw ? (JSON.parse(raw) as LastRun<T>) : null;
  } catch {
    return null;
  }
}

export function describeCatalog(o: SyncOutcome): { ok: boolean; text: string } {
  if ('changed' in o) {
    return { ok: true, text: o.changed === 0 ? 'nada novo' : `${o.changed} título(s) atualizado(s)` };
  }
  switch (o.skipped) {
    case 'offline':
      return { ok: false, text: 'servidor fora do ar ou outro servidor' };
    case 'no-catalog-feature':
      return { ok: false, text: 'servidor sem catálogo (versão antiga)' };
    case 'fetch-failed':
      return { ok: false, text: 'falha ao baixar o catálogo' };
    case 'write-failed':
      return { ok: false, text: 'falha ao gravar o catálogo' };
  }
}

export function describeBind(r: SyncResult): { ok: boolean; text: string } {
  if (r.status === 'synced') return { ok: true, text: r.sent ? `${r.sent} capítulo(s) enviado(s)` : 'em dia' };
  if (r.status === 'skipped') return { ok: r.why === 'no_code', text: r.why === 'no_code' ? 'sem bind' : 'sem conexão' };
  return { ok: false, text: `falhou (${r.reason})` };
}
