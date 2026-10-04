import { DEFAULT_LIMITS } from '@manga/core';

import type { Db } from '../db/types';
import { getOpenChapterId } from '../reader/openChapter';
import { enforceSpace } from '../storage/downloads';
import type { FileStore } from '../storage/files';
import { enforceTransientNow } from '../storage/transient';
import { getSetting, setSetting } from './repo';

const MB = 1_000_000;

export type LimitKey =
  | 'space.maxPerTitle'
  | 'space.maxGlobal'
  | 'space.maxBytes'
  | 'space.minFreeBytes'
  | 'space.transientMaxBytes';

export interface LimitField {
  key: LimitKey;
  label: string;
  /** 'count' is typed as is; 'mb' is typed in MB and stored in bytes. */
  unit: 'count' | 'mb';
  min: number;
  max: number;
  fallback: number;
}

// Minimums keep the app useful (at least one chapter, a few pages' worth of
// bytes); maximums only reject typos.
export const LIMIT_FIELDS: LimitField[] = [
  { key: 'space.maxPerTitle', label: 'Capítulos por título', unit: 'count', min: 1, max: 1000, fallback: DEFAULT_LIMITS.maxPerTitle },
  { key: 'space.maxGlobal', label: 'Capítulos no total', unit: 'count', min: 1, max: 100_000, fallback: DEFAULT_LIMITS.maxGlobal },
  { key: 'space.maxBytes', label: 'Tamanho máximo dos downloads (MB)', unit: 'mb', min: 100 * MB, max: 1_000_000 * MB, fallback: DEFAULT_LIMITS.maxBytes },
  { key: 'space.minFreeBytes', label: 'Espaço livre mínimo no disco (MB)', unit: 'mb', min: 100 * MB, max: 1_000_000 * MB, fallback: DEFAULT_LIMITS.minFreeBytes },
  { key: 'space.transientMaxBytes', label: 'Cache de leitura (MB)', unit: 'mb', min: 50 * MB, max: 100_000 * MB, fallback: DEFAULT_LIMITS.transientMaxBytes },
];

export function fieldOf(key: LimitKey): LimitField {
  return LIMIT_FIELDS.find((f) => f.key === key)!;
}

export type LimitParse = { ok: true; value: number } | { ok: false; error: string };

/** Validates what the user typed; returns the value as stored (count or bytes). */
export function parseLimit(key: LimitKey, text: string): LimitParse {
  const f = fieldOf(key);
  const t = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return { ok: false, error: 'Informe um número.' };
  const n = Number(t);
  const value = f.unit === 'mb' ? Math.round(n * MB) : n;
  if (f.unit === 'count' && !Number.isInteger(value)) {
    return { ok: false, error: 'Informe um número inteiro.' };
  }
  if (value < f.min) {
    const shown = f.unit === 'mb' ? `${f.min / MB} MB` : String(f.min);
    return { ok: false, error: `O mínimo é ${shown}.` };
  }
  if (value > f.max) return { ok: false, error: 'Valor alto demais.' };
  return { ok: true, value };
}

/** Current stored value, or the default when unset/corrupt. */
export function getLimit(db: Db, key: LimitKey): number {
  const f = fieldOf(key);
  const raw = getSetting(db, key);
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : f.fallback;
}

/** Text shown in the editor for a stored value. */
export function limitToText(key: LimitKey, value: number): string {
  return fieldOf(key).unit === 'mb' ? String(Math.round(value / MB)) : String(value);
}

/**
 * Saves a limit. Lowering one applies eviction right away (downloads for the
 * chapter limits and the byte cap, the LRU for the transient cache), sparing
 * the open chapter. Raising or keeping it only stores the value.
 */
export async function applyLimit(
  db: Db,
  files: FileStore,
  key: LimitKey,
  value: number,
): Promise<void> {
  const before = getLimit(db, key);
  setSetting(db, key, String(value));
  if (value >= before) return;
  if (key === 'space.transientMaxBytes') {
    await enforceTransientNow(db, files);
  } else if (key !== 'space.minFreeBytes') {
    const open = getOpenChapterId();
    await enforceSpace(db, files, open ? [open] : []);
  }
}

