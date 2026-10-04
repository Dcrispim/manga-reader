import { BindDataSchema, paths } from '@manga/api-contract';
import {
  buildDeltaPayload,
  mergeBindData,
  type BindData,
  type BindPayload,
  type TitleHistory,
} from '@manga/core';

import type { Db } from '../db/types';
import {
  applyMerged,
  latestChapter,
  markSynced,
  pendingPairs,
  toTitleHistories,
} from '../history/repo';
import { log } from '../diag/log';
import { getServerState, type ServerStatus } from '../server/status';
import { getSetting, setSetting } from '../settings/repo';

/** Minimal slice of the net client the bind engine needs (easy to fake). */
export interface BindClient {
  getJson: <T>(
    path: string,
    schema: typeof BindDataSchema,
  ) => Promise<
    { ok: true; value: T } | { ok: false; reason: string; status?: number }
  >;
  postJson: <T>(
    path: string,
    body: unknown,
    schema: typeof BindDataSchema,
  ) => Promise<
    { ok: true; value: T } | { ok: false; reason: string; status?: number }
  >;
}

export type ConnectResult =
  | { ok: true; code: string }
  | { ok: false; reason: 'not_found' | 'unreachable' };

export type SyncResult =
  | { status: 'skipped'; why: 'no_code' | 'not_online' }
  | { status: 'synced'; sent: number }
  | { status: 'failed'; reason: string };

const norm = (code: string): string =>
  code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

export function getBindCode(db: Db): string | null {
  return getSetting(db, 'bind.code') || null;
}

function getLastSync(db: Db): number {
  const n = Number(getSetting(db, 'bind.lastSync'));
  return Number.isFinite(n) ? n : 0;
}

function getPointers(db: Db): Record<string, string> {
  try {
    const v: unknown = JSON.parse(getSetting(db, 'bind.chapters') ?? '{}');
    return v && typeof v === 'object' ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Local snapshot: history from the table, "continue from" pointers derived. */
function localPayload(db: Db): BindPayload {
  const hist = toTitleHistories(db);
  const chapters = { ...getPointers(db) };
  for (const title of Object.keys(hist)) {
    const c = latestChapter(db, title);
    if (c) chapters[title] = c;
  }
  return { history: hist, chapters };
}

/** Merges a server answer into the local db and settings. */
function absorb(db: Db, remote: BindPayload): void {
  const merged = mergeBindData(localPayload(db), remote);
  applyMerged(db, merged);
  setSetting(db, 'bind.chapters', JSON.stringify(merged.chapters));
}

/** Creates a new bind on the server from the whole local history. */
export async function createBind(
  db: Db,
  client: BindClient,
  now: number,
): Promise<ConnectResult> {
  try {
    const full = localPayload(db);
    const res = await client.postJson<BindData>(
      paths.bindCreate(),
      full,
      BindDataSchema,
    );
    if (!res.ok) return { ok: false, reason: 'unreachable' };
    absorb(db, res.value);
    const sent: Record<string, string[]> = {};
    for (const [t, e] of Object.entries(full.history)) {
      sent[t] = Object.keys(e.openedAt);
    }
    markSynced(db, sent);
    setSetting(db, 'bind.code', res.value.code);
    setSetting(db, 'bind.lastSync', String(now));
    return { ok: true, code: res.value.code };
  } catch (err) {
    log(db, 'error', 'sync.bind', `createBind failed: ${String(err)}`);
    return { ok: false, reason: 'unreachable' };
  }
}

/** Joins an existing bind; an unknown code is a normal result, not an error. */
export async function connectBind(
  db: Db,
  client: BindClient,
  code: string,
): Promise<ConnectResult> {
  try {
    const clean = norm(code);
    const res = await client.getJson<BindData>(
      paths.bindGet(clean),
      BindDataSchema,
    );
    if (!res.ok) {
      return {
        ok: false,
        reason: res.reason === 'http' && res.status === 404 ? 'not_found' : 'unreachable',
      };
    }
    absorb(db, res.value);
    setSetting(db, 'bind.code', res.value.code || clean);
    // Local rows stay pending and lastSync restarts at 0, so the next sync
    // pushes the whole local history to the newly joined bind.
    setSetting(db, 'bind.lastSync', '0');
    return { ok: true, code: res.value.code || clean };
  } catch (err) {
    log(db, 'error', 'sync.bind', `connectBind failed: ${String(err)}`);
    return { ok: false, reason: 'unreachable' };
  }
}

interface SyncOptions {
  db: Db;
  client: BindClient;
  now: number;
  /** Override for tests; defaults to the reactive server store. */
  status?: ServerStatus;
}

/**
 * One sync cycle. lastSync is captured before the send, and nothing is marked
 * unless every step succeeded; a retry resends the same delta, which is safe
 * because the merge is idempotent. Never throws.
 */
export async function syncBind(opts: SyncOptions): Promise<SyncResult> {
  const { db, client, now } = opts;
  try {
    const code = getBindCode(db);
    if (!code) return { status: 'skipped', why: 'no_code' };
    if ((opts.status ?? getServerState().status) !== 'online') {
      return { status: 'skipped', why: 'not_online' };
    }

    const full = localPayload(db);
    const delta = buildDeltaPayload(full, getLastSync(db));
    // Rows still pending are always resent, even if older than lastSync
    // (e.g. a failed cycle followed by a clock quirk).
    const sent: Record<string, string[]> = {};
    for (const [title, entry] of Object.entries(delta.history)) {
      sent[title] = Object.keys(entry.openedAt);
    }
    for (const [title, chapters] of Object.entries(pendingPairs(db))) {
      const target: TitleHistory = (delta.history[title] ??= {
        lastRead: full.history[title]?.lastRead ?? null,
        history: full.history[title]?.history ?? [],
        openedAt: {},
      });
      for (const [chapter, at] of Object.entries(chapters)) {
        target.openedAt[chapter] = at;
        const list = (sent[title] ??= []);
        if (!list.includes(chapter)) list.push(chapter);
      }
    }

    const res = await client.postJson<BindData>(
      paths.bindUpdate(code),
      delta,
      BindDataSchema,
    );
    if (!res.ok) return { status: 'failed', reason: res.reason };

    absorb(db, res.value);
    markSynced(db, sent);
    setSetting(db, 'bind.lastSync', String(now));
    return {
      status: 'synced',
      sent: Object.values(sent).reduce((n, c) => n + c.length, 0),
    };
  } catch (err) {
    log(db, 'error', 'sync.bind', `syncBind failed: ${String(err)}`);
    return { status: 'failed', reason: 'error' };
  }
}

/** Removes the code only; the local history stays. */
export function disconnectBind(db: Db): void {
  setSetting(db, 'bind.code', '');
  setSetting(db, 'bind.lastSync', '0');
}
