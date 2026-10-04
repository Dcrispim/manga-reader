// Re-export: the rules live in @manga/core so server and app share them.
// Client-safe (core is I/O-free).
export { normalizeCategory } from '@manga/core'
