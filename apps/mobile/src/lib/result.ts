/**
 * Result type for operations that should never throw.
 * Represents either a successful value or a categorized failure.
 */
export type Result<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      reason: 'unconfigured' | 'unreachable' | 'timeout' | 'http' | 'invalid';
      status?: number;
    };
