import { HealthResponseSchema } from '@manga/api-contract';

import type { Db } from '../db/types';
import { getSetting, setSetting } from '../settings/repo';

export type ServerStatus = 'unconfigured' | 'online' | 'offline' | 'mismatch';

/** Minimal slice of the net client that checkServer needs (easy to fake). */
export interface HealthClient {
  getJson: <T>(
    path: string,
    schema: typeof HealthResponseSchema,
    opts?: { timeoutMs?: number },
  ) => Promise<
    { ok: true; value: T } | { ok: false; reason: string; status?: number }
  >;
}

export const HEALTH_TIMEOUT_MS = 3000;

interface HealthValue {
  serverId?: string;
  version: string;
  features: string[];
}

export interface ServerState {
  status: ServerStatus;
  lastCheckedAt: number | null;
  features: string[];
  /** serverId reported by a mismatching server, kept so the user can adopt it. */
  pendingServerId: string | null;
}

let state: ServerState = {
  status: 'unconfigured',
  lastCheckedAt: null,
  features: [],
  pendingServerId: null,
};
const listeners = new Set<() => void>();

function setState(patch: Partial<ServerState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function getServerState(): ServerState {
  return state;
}

export function subscribeServerState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test helper: back to the initial state. */
export function resetServerState(): void {
  setState({
    status: 'unconfigured',
    lastCheckedAt: null,
    features: [],
    pendingServerId: null,
  });
}

export function hasFeature(name: string): boolean {
  return state.features.includes(name);
}

function parseFeatures(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Probe GET /api/health and update settings + the reactive store.
 * Never throws; a real request is the only source of truth (no "has Wi-Fi").
 */
export async function checkServer(
  client: HealthClient,
  db: Db,
  now: () => number = Date.now,
): Promise<ServerStatus> {
  try {
    const res = await client.getJson<HealthValue>(
      '/api/health',
      HealthResponseSchema,
      { timeoutMs: HEALTH_TIMEOUT_MS },
    );
    const at = now();

    if (!res.ok) {
      const status: ServerStatus =
        res.reason === 'unconfigured' ? 'unconfigured' : 'offline';
      // Last known features stay available while offline.
      setState({
        status,
        lastCheckedAt: at,
        features: parseFeatures(getSetting(db, 'server.features')),
        pendingServerId: null,
      });
      return status;
    }

    const { serverId, version, features } = res.value;
    const savedId = getSetting(db, 'server.id');

    if (serverId && savedId && serverId !== savedId) {
      // Different server at the same address: warn, never wipe anything.
      setState({
        status: 'mismatch',
        lastCheckedAt: at,
        pendingServerId: serverId,
      });
      return 'mismatch';
    }

    // A health without serverId is still online; just do not store an id.
    if (serverId && !savedId) setSetting(db, 'server.id', serverId);
    setSetting(db, 'server.version', version);
    setSetting(db, 'server.features', JSON.stringify(features));
    setState({
      status: 'online',
      lastCheckedAt: at,
      features,
      pendingServerId: null,
    });
    return 'online';
  } catch {
    setState({ status: 'offline', lastCheckedAt: now() });
    return 'offline';
  }
}

/** "Usar este servidor": adopt the id of the server that answered. */
export function acceptPendingServer(db: Db): void {
  const id = state.pendingServerId;
  if (!id) return;
  setSetting(db, 'server.id', id);
  setState({ pendingServerId: null });
}

export type TestResult =
  | { ok: true; version: string; ms: number; serverId: string | null }
  | { ok: false };

/**
 * Probe an address that is not saved yet (settings screen). Independent of
 * the store and of the db; never throws.
 */
export async function testAddress(
  host: string,
  port: number,
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<TestResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  const started = now();
  try {
    const response = await fetchImpl(`http://${host}:${port}/api/health`, {
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false };
    const parsed = HealthResponseSchema.safeParse(await response.json());
    if (!parsed.success) return { ok: false };
    return {
      ok: true,
      version: parsed.data.version,
      ms: now() - started,
      serverId: parsed.data.serverId ?? null,
    };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}
