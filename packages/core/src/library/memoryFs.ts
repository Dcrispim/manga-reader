import type { FsAdapter, FsEntry } from './fs'
import { joinPath } from './fs'

// A tree literal: string = file content, object = directory. Optional
// per-path mtimes (keys are "/"-joined paths relative to the tree root).
export type MemoryTree = { [name: string]: string | MemoryTree }

// In-memory FsAdapter for tests. Paths are absolute-style ("/lib/A/1/1.jpg").
export class MemoryFs implements FsAdapter {
  private nodes = new Map<string, { isDirectory: boolean; content: string; mtimeMs: number }>()
  private failing = new Set<string>()

  constructor(tree: MemoryTree, root = '/lib', defaultMtime = 1) {
    this.nodes.set(root, { isDirectory: true, content: '', mtimeMs: defaultMtime })
    this.add(root, tree, defaultMtime)
  }

  private add(base: string, tree: MemoryTree, mtime: number) {
    for (const [name, value] of Object.entries(tree)) {
      const p = joinPath(base, name)
      if (typeof value === 'string') {
        this.nodes.set(p, { isDirectory: false, content: value, mtimeMs: mtime })
      } else {
        this.nodes.set(p, { isDirectory: true, content: '', mtimeMs: mtime })
        this.add(p, value, mtime)
      }
    }
  }

  setMtime(path: string, mtimeMs: number) {
    const n = this.nodes.get(path)
    if (!n) throw new Error(`no such path: ${path}`)
    n.mtimeMs = mtimeMs
  }

  // Makes list/stat/readText throw for this path (simulates a read error).
  failOn(path: string) {
    this.failing.add(path)
  }

  private entry(path: string): FsEntry | null {
    const n = this.nodes.get(path)
    if (!n) return null
    const name = path.slice(path.lastIndexOf('/') + 1)
    return { name, isDirectory: n.isDirectory, mtimeMs: n.mtimeMs, size: n.content.length }
  }

  async list(path: string): Promise<FsEntry[]> {
    if (this.failing.has(path)) throw new Error(`EIO: ${path}`)
    const n = this.nodes.get(path)
    if (!n || !n.isDirectory) throw new Error(`ENOENT: ${path}`)
    const prefix = path.replace(/\/+$/, '') + '/'
    const out: FsEntry[] = []
    for (const key of this.nodes.keys()) {
      if (key.startsWith(prefix) && !key.slice(prefix.length).includes('/')) {
        out.push(this.entry(key)!)
      }
    }
    return out
  }

  async stat(path: string): Promise<FsEntry | null> {
    if (this.failing.has(path)) throw new Error(`EIO: ${path}`)
    return this.entry(path)
  }

  async readText(path: string): Promise<string | null> {
    if (this.failing.has(path)) throw new Error(`EIO: ${path}`)
    const n = this.nodes.get(path)
    return n && !n.isDirectory ? n.content : null
  }
}

export const memoryFs = (tree: MemoryTree, root?: string, defaultMtime?: number) =>
  new MemoryFs(tree, root, defaultMtime)
