/**
 * List of enabled features for the current server.
 * The app uses this to decide degraded-mode behavior when a feature is unavailable.
 * "catalog": GET /api/catalog?since= is available.
 */
export const FEATURES: string[] = ["catalog"]
