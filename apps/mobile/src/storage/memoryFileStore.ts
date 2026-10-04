import type { FileStore } from './files';

export interface MemoryFileStoreOptions {
  /** Decides each download; default: ok with 1000 bytes. */
  downloader?: (url: string, dest: string) => { ok: boolean; bytes: number };
  freeBytes?: number;
}

export interface MemoryFileStore extends FileStore {
  /** path -> size in bytes (files only). */
  readonly files: Map<string, number>;
  /** Every download attempt, in order, successful or not. */
  readonly downloadLog: { url: string; dest: string }[];
}

// Test double for FileStore; mirrors the contract of expoFileStore
// (overwriting moves, never throws).
export function memoryFileStore(
  opts: MemoryFileStoreOptions = {},
): MemoryFileStore {
  const files = new Map<string, number>();
  const dirs = new Set<string>();
  const downloadLog: { url: string; dest: string }[] = [];
  const norm = (p: string) => p.replace(/\/+$/, '');

  return {
    documentDirectory: 'memory://doc',
    cacheDirectory: 'memory://cache',
    files,
    downloadLog,
    async download(url, dest) {
      downloadLog.push({ url, dest });
      const r = opts.downloader?.(url, dest) ?? { ok: true, bytes: 1000 };
      if (r.ok) files.set(norm(dest), r.bytes);
      return r;
    },
    async move(from, to) {
      const f = norm(from);
      const t = norm(to);
      if (files.has(f)) {
        files.set(t, files.get(f)!);
        files.delete(f);
        return true;
      }
      const prefix = `${f}/`;
      const children = [...files.keys()].filter((k) => k.startsWith(prefix));
      if (!dirs.has(f) && children.length === 0) return false;
      for (const k of children) {
        files.set(`${t}/${k.slice(prefix.length)}`, files.get(k)!);
        files.delete(k);
      }
      dirs.delete(f);
      dirs.add(t);
      return true;
    },
    async remove(path) {
      const p = norm(path);
      files.delete(p);
      dirs.delete(p);
      for (const k of [...files.keys()]) if (k.startsWith(`${p}/`)) files.delete(k);
      // Empty child directories (e.g. left by a move) go too, like a recursive delete.
      for (const d of [...dirs]) if (d.startsWith(`${p}/`)) dirs.delete(d);
      return true;
    },
    async exists(path) {
      const p = norm(path);
      return (
        files.has(p) ||
        dirs.has(p) ||
        [...files.keys()].some((k) => k.startsWith(`${p}/`))
      );
    },
    async size(path) {
      const p = norm(path);
      if (files.has(p)) return files.get(p)!;
      let total = 0;
      for (const [k, v] of files) if (k.startsWith(`${p}/`)) total += v;
      return total;
    },
    async listDir(path) {
      const prefix = `${norm(path)}/`;
      const names = new Set<string>();
      for (const k of [...files.keys(), ...dirs]) {
        if (k.startsWith(prefix)) names.add(k.slice(prefix.length).split('/')[0]);
      }
      return [...names];
    },
    async makeDir(path) {
      dirs.add(norm(path));
      return true;
    },
    async freeDiskBytes() {
      return opts.freeBytes ?? Number.MAX_SAFE_INTEGER;
    },
  };
}
