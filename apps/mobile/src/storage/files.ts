import { Directory, File, Paths } from 'expo-file-system';

/**
 * Minimal filesystem surface used by the sync engines (catalog covers,
 * downloads, transient cache). Paths are file:// URIs. Every method is
 * async and never throws: failures come back as false / 0 / [].
 */
export interface FileStore {
  /** App-private document directory (no trailing slash). */
  readonly documentDirectory: string;
  download(url: string, dest: string): Promise<{ ok: boolean; bytes: number }>;
  /** Moves a file or directory, overwriting the destination. */
  move(from: string, to: string): Promise<boolean>;
  remove(path: string): Promise<boolean>;
  exists(path: string): Promise<boolean>;
  /** Size in bytes of a file, or the recursive size of a directory; 0 if missing. */
  size(path: string): Promise<number>;
  /** Names (not paths) of the direct children of a directory. */
  listDir(path: string): Promise<string[]>;
  /** Creates a directory and its parents; ok if it already exists. */
  makeDir(path: string): Promise<boolean>;
  freeDiskBytes(): Promise<number>;
}

export const expoFileStore: FileStore = {
  get documentDirectory() {
    return Paths.document.uri.replace(/\/+$/, '');
  },
  async download(url, dest) {
    try {
      const file = await File.downloadFileAsync(url, new File(dest), {
        idempotent: true,
      });
      return { ok: true, bytes: file.size };
    } catch {
      return { ok: false, bytes: 0 };
    }
  },
  async move(from, to) {
    try {
      const src = new File(from);
      if (src.exists) {
        await src.move(new File(to), { overwrite: true });
        return true;
      }
      const dir = new Directory(from);
      if (!dir.exists) return false;
      await dir.move(new Directory(to), { overwrite: true });
      return true;
    } catch {
      return false;
    }
  },
  async remove(path) {
    try {
      const file = new File(path);
      if (file.exists) {
        file.delete();
        return true;
      }
      const dir = new Directory(path);
      if (dir.exists) dir.delete();
      return true;
    } catch {
      return false;
    }
  },
  async exists(path) {
    try {
      return new File(path).exists || new Directory(path).exists;
    } catch {
      return false;
    }
  },
  async size(path) {
    try {
      const file = new File(path);
      if (file.exists) return file.size;
      return new Directory(path).size ?? 0;
    } catch {
      return 0;
    }
  },
  async listDir(path) {
    try {
      return new Directory(path).list().map((e) => e.name);
    } catch {
      return [];
    }
  },
  async makeDir(path) {
    try {
      new Directory(path).create({ intermediates: true, idempotent: true });
      return true;
    } catch {
      return false;
    }
  },
  async freeDiskBytes() {
    try {
      return Paths.availableDiskSpace;
    } catch {
      return 0;
    }
  },
};
