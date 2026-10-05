import { File } from 'expo-file-system';

import type { Db } from '../db/types';
import { getServerBase } from '../settings/repo';

// The server routes behind the metadata editor (web and app share them):
// GET/PUT /api/metadata/:title(/raw) and PUT /api/thumb/:title.

export type Entry = [string, string];
export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: string };

const TIMEOUT_MS = 15_000;

async function call<T>(db: Db, path: string, init: RequestInit): Promise<ApiResult<T>> {
  const base = getServerBase(db);
  if (!base) return { ok: false, error: 'Servidor não configurado.' };
  try {
    const res = await fetch(`${base}${path}`, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!res.ok) return { ok: false, error: body?.error ?? `Erro ${res.status} do servidor.` };
    return { ok: true, value: body as T };
  } catch {
    return { ok: false, error: 'Não foi possível falar com o servidor.' };
  }
}

const enc = encodeURIComponent;

export function loadEntries(db: Db, title: string): Promise<ApiResult<{ entries: Entry[] }>> {
  return call(db, `/api/metadata/${enc(title)}/raw`, { method: 'GET' });
}

export function saveEntries(db: Db, title: string, entries: Entry[]): Promise<ApiResult<unknown>> {
  return call(db, `/api/metadata/${enc(title)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries }),
  });
}

/** Uploads a local JPEG (already cropped) as the title's curated cover. */
export async function uploadThumb(db: Db, title: string, jpegUri: string): Promise<ApiResult<unknown>> {
  const bytes = await new File(jpegUri).bytes();
  return call(db, `/api/thumb/${enc(title)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: bytes.buffer as ArrayBuffer,
  });
}
