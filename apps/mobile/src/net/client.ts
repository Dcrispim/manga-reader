import type { ZodSchema } from 'zod';

import { log, trimLog } from '../diag/log';
import type { Db } from '../db/types';
import type { Result } from '../lib/result';
import { getServerBase } from '../settings/repo';

interface ClientOptions {
  db: Db;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

interface RequestOptions {
  timeoutMs?: number;
}

/**
 * Create a never-throwing HTTP client.
 * All requests return a Result type, never throwing exceptions.
 * Every failure is logged to diag_log with scope='net'.
 */
export function createClient(options: ClientOptions) {
  const { db, fetchImpl = fetch, now = Date.now } = options;

  function logFailure(
    level: 'warn' | 'error',
    message: string,
  ): void {
    log(db, level, 'net', message);
    trimLog(db);
  }

  /**
   * Perform a GET request and parse JSON with schema validation.
   */
  async function getJson<T>(
    path: string,
    schema: ZodSchema,
    opts: RequestOptions = {},
  ): Promise<Result<T>> {
    const base = getServerBase(db);
    if (!base) {
      logFailure('warn', 'Server not configured');
      return { ok: false, reason: 'unconfigured' };
    }

    const fullUrl = `${base}${path}`;
    const controller = new AbortController();
    const timeoutMs = opts.timeoutMs ?? 8000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(fullUrl, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Check HTTP status
      if (!response.ok) {
        logFailure(
          'warn',
          `HTTP ${response.status} from ${path}`,
        );
        return {
          ok: false,
          reason: 'http',
          status: response.status,
        };
      }

      // Try to parse JSON
      let json: unknown;
      try {
        json = await response.json();
      } catch {
        logFailure('warn', `Invalid JSON from ${path}`);
        return { ok: false, reason: 'invalid' };
      }

      // Validate with schema
      const parseResult = schema.safeParse(json);
      if (!parseResult.success) {
        logFailure(
          'warn',
          `Schema validation failed from ${path}: ${parseResult.error.message}`,
        );
        return { ok: false, reason: 'invalid' };
      }

      return { ok: true, value: parseResult.data as T };
    } catch (err) {
      clearTimeout(timeoutId);

      // Check if it's a timeout
      if (err instanceof Error && err.name === 'AbortError') {
        logFailure('warn', `Timeout on ${path}`);
        return { ok: false, reason: 'timeout' };
      }

      // Network error or other fetch failure
      logFailure(
        'warn',
        `Network error on ${path}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { ok: false, reason: 'unreachable' };
    }
  }

  /**
   * Perform a POST request with JSON body and schema validation.
   */
  async function postJson<T>(
    path: string,
    body: unknown,
    schema: ZodSchema,
    opts: RequestOptions = {},
  ): Promise<Result<T>> {
    const base = getServerBase(db);
    if (!base) {
      logFailure('warn', 'Server not configured');
      return { ok: false, reason: 'unconfigured' };
    }

    const fullUrl = `${base}${path}`;
    const controller = new AbortController();
    const timeoutMs = opts.timeoutMs ?? 8000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(fullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Check HTTP status
      if (!response.ok) {
        logFailure(
          'warn',
          `HTTP ${response.status} from ${path}`,
        );
        return {
          ok: false,
          reason: 'http',
          status: response.status,
        };
      }

      // Try to parse JSON
      let json: unknown;
      try {
        json = await response.json();
      } catch {
        logFailure('warn', `Invalid JSON from ${path}`);
        return { ok: false, reason: 'invalid' };
      }

      // Validate with schema
      const parseResult = schema.safeParse(json);
      if (!parseResult.success) {
        logFailure(
          'warn',
          `Schema validation failed from ${path}: ${parseResult.error.message}`,
        );
        return { ok: false, reason: 'invalid' };
      }

      return { ok: true, value: parseResult.data as T };
    } catch (err) {
      clearTimeout(timeoutId);

      // Check if it's a timeout
      if (err instanceof Error && err.name === 'AbortError') {
        logFailure('warn', `Timeout on ${path}`);
        return { ok: false, reason: 'timeout' };
      }

      // Network error or other fetch failure
      logFailure(
        'warn',
        `Network error on ${path}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { ok: false, reason: 'unreachable' };
    }
  }

  /**
   * Build an absolute URL for an image from a relative path.
   * Returns null if the server is not configured or the path is invalid.
   */
  function url(pathOrRelative: string): string | null {
    try {
      const base = getServerBase(db);
      if (!base) {
        return null;
      }

      const fullPath = pathOrRelative.startsWith('/')
        ? pathOrRelative
        : `/${pathOrRelative}`;
      return `${base}${fullPath}`;
    } catch {
      return null;
    }
  }

  return { getJson, postJson, url };
}
