import { readdir, stat, readFile } from "fs/promises";
import path from "path";
import type { FsAdapter, FsEntry } from "@manga/core";

const toEntry = (name: string, s: { isDirectory(): boolean; mtimeMs: number; size: number }): FsEntry => ({
  name,
  isDirectory: s.isDirectory(),
  mtimeMs: s.mtimeMs,
  size: s.size,
});

// Node implementation of the core's FsAdapter. Entries whose stat fails
// (vanished mid-listing) are dropped instead of failing the whole list.
export const nodeFs: FsAdapter = {
  async list(p) {
    const names = await readdir(p);
    const out = await Promise.all(
      names.map(async (n) => {
        try {
          return toEntry(n, await stat(path.join(p, n)));
        } catch {
          return null;
        }
      })
    );
    return out.filter((e): e is FsEntry => e !== null);
  },
  async stat(p) {
    try {
      return toEntry(path.basename(p), await stat(p));
    } catch {
      return null;
    }
  },
  async readText(p) {
    try {
      return await readFile(p, "utf8");
    } catch {
      return null;
    }
  },
};
