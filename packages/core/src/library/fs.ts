// Minimal filesystem surface the library scanner needs. Implemented by Node
// fs on the server and by SAF on the app, so the core stays I/O-free.
export type FsEntry = { name: string; isDirectory: boolean; mtimeMs: number; size: number }

export interface FsAdapter {
  list(path: string): Promise<FsEntry[]> // throws if path is missing
  stat(path: string): Promise<FsEntry | null> // null if missing
  readText(path: string): Promise<string | null> // null if missing
}

// Paths are plain strings joined with "/" (no node:path in the core).
// Empty parts are skipped and duplicate slashes at the joins are collapsed.
export const joinPath = (...parts: string[]): string =>
  parts
    .filter((p) => p !== '')
    .reduce((acc, part, i) =>
      i === 0 ? part : acc.replace(/\/+$/, '') + '/' + part.replace(/^\/+/, '')
    , '')
