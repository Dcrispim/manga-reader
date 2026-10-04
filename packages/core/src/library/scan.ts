import type { FsAdapter } from './fs'
import { joinPath } from './fs'
import type { AbortSignalLike } from '../abort'
import { pickChapterDirs, sortedChapterNumbers } from './chapters'
import { isImageFile } from './images'
import { EMPTY_METADATA, parseMetadataFile, type MetadataContent } from './metadata'

// Incremental scanning relies on the mtime of each title folder (plus its
// .meta/.thumb files). Creating or removing a chapter changes the title
// folder's mtime, but adding pages INSIDE an existing chapter does not, so
// an incremental scan will not notice it. This limitation is accepted by
// design (a full scan, without `since`, always picks it up).

export type ChapterScan = { id: string; number: number; pages: number; mtimeMs: number }

export type TitleScan = {
  name: string
  mtimeMs: number
  metaMtimeMs: number | null
  thumbMtimeMs: number | null
  metadata: MetadataContent
  chapters: ChapterScan[]
  // Reasons a title (or part of it) could not be read; empty when all good.
  ignored: string[]
}

export type TitleListing = {
  name: string
  mtimeMs: number
  metaMtimeMs: number | null
  thumbMtimeMs: number | null
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e))

export async function scanTitle(fs: FsAdapter, root: string, name: string): Promise<TitleScan> {
  const titlePath = joinPath(root, name)
  const [titleStat, metaStat, thumbStat] = await Promise.all([
    fs.stat(titlePath),
    fs.stat(joinPath(root, '.meta', `${name}.metadata`)),
    fs.stat(joinPath(root, '.thumb', `${name}.jpg`)),
  ])
  const ignored: string[] = []

  let metadata = EMPTY_METADATA
  try {
    const text = await fs.readText(joinPath(root, '.meta', `${name}.metadata`))
    if (text !== null) metadata = parseMetadataFile(text)
  } catch (e) {
    ignored.push(`metadata: ${errMsg(e)}`)
  }

  // List every numeric chapter dir: pages are needed anyway, and the file
  // count (all entries, like the server route) decides duplicates.
  const dirs = (await fs.list(titlePath)).filter((e) => e.isDirectory)
  const info = new Map<string, { fileCount: number; pages: number; mtimeMs: number }>()
  const entries: { name: string; fileCount: number }[] = []
  for (const dir of dirs) {
    if (Number.isNaN(parseFloat(dir.name))) {
      ignored.push(`${dir.name}: not a chapter`)
      continue
    }
    try {
      const files = await fs.list(joinPath(titlePath, dir.name))
      const pages = files.filter((f) => !f.isDirectory && isImageFile(f.name)).length
      info.set(dir.name, { fileCount: files.length, pages, mtimeMs: dir.mtimeMs })
      entries.push({ name: dir.name, fileCount: files.length })
    } catch (e) {
      ignored.push(`${dir.name}: ${errMsg(e)}`)
    }
  }

  const byNum = pickChapterDirs(entries)
  const picked = new Set(byNum.values())
  for (const e of entries) if (!picked.has(e.name)) ignored.push(`${e.name}: duplicate chapter`)

  const chapters = sortedChapterNumbers(byNum).map((number): ChapterScan => {
    const id = byNum.get(number)!
    const i = info.get(id)!
    return { id, number, pages: i.pages, mtimeMs: i.mtimeMs }
  })

  return {
    name,
    mtimeMs: titleStat?.mtimeMs ?? 0,
    metaMtimeMs: metaStat?.mtimeMs ?? null,
    thumbMtimeMs: thumbStat?.mtimeMs ?? null,
    metadata,
    chapters,
    ignored,
  }
}

// Cheap listing: one list() of the root plus two stats per title.
export async function listTitles(fs: FsAdapter, root: string): Promise<TitleListing[]> {
  const entries = await fs.list(root)
  const dirs = entries.filter((e) => e.isDirectory && !e.name.startsWith('.'))
  return Promise.all(
    dirs.map(async (d) => {
      const [meta, thumb] = await Promise.all([
        fs.stat(joinPath(root, '.meta', `${d.name}.metadata`)).catch(() => null),
        fs.stat(joinPath(root, '.thumb', `${d.name}.jpg`)).catch(() => null),
      ])
      return {
        name: d.name,
        mtimeMs: d.mtimeMs,
        metaMtimeMs: meta?.mtimeMs ?? null,
        thumbMtimeMs: thumb?.mtimeMs ?? null,
      }
    })
  )
}

export type ScanOptions = {
  since?: number
  onProgress?(done: number, total: number): void
  signal?: AbortSignalLike
  concurrency?: number
}

export type ScanResult = { titles: TitleScan[]; allTitleNames: string[]; scannedAt: number }

export async function scanLibrary(
  fs: FsAdapter,
  root: string,
  opts: ScanOptions = {}
): Promise<ScanResult> {
  const scannedAt = Date.now()
  const listing = await listTitles(fs, root)
  const allTitleNames = listing.map((t) => t.name)
  const since = opts.since ?? 0
  const todo = listing.filter(
    (t) => since <= 0 || Math.max(t.mtimeMs, t.metaMtimeMs ?? 0, t.thumbMtimeMs ?? 0) > since
  )

  const titles: TitleScan[] = new Array(todo.length)
  const done = new Array<boolean>(todo.length).fill(false)
  let next = 0
  let finished = 0
  const workers = Math.max(1, opts.concurrency ?? 4)

  const worker = async () => {
    while (!opts.signal?.aborted) {
      const i = next++
      if (i >= todo.length) return
      const t = todo[i]
      try {
        titles[i] = await scanTitle(fs, root, t.name)
      } catch (e) {
        // One broken title must not sink the scan: report it as ignored.
        titles[i] = {
          ...t,
          metadata: EMPTY_METADATA,
          chapters: [],
          ignored: [`${t.name}: ${errMsg(e)}`],
        }
      }
      done[i] = true
      opts.onProgress?.(++finished, todo.length)
    }
  }
  await Promise.all(Array.from({ length: Math.min(workers, todo.length) }, worker))

  return { titles: titles.filter((_, i) => done[i]), allTitleNames, scannedAt }
}
