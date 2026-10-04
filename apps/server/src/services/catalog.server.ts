import { listTitles, scanTitle, normalizeCategory, type TitleScan } from '@manga/core'
import type { CatalogResponse, CatalogTitle } from '@manga/api-contract'
import { nodeFs } from '@/services/nodeFs.server'
import { MANGA_ROOT } from '@/utils/paths.server'

// Per-title cache so two clients asking for since=0 do not recount the pages
// of titles that did not change. The key is the concatenated mtimes of the
// title folder, its .metadata and its .thumb (the same signals the
// incremental scan relies on). Like the scanner, it cannot see pages added
// inside an existing chapter; restarting the server clears it.
const cache = new Map<string, { key: string; value: CatalogTitle }>()

const CONCURRENCY = 4

function toCatalogTitle(t: TitleScan): CatalogTitle {
  const { categories, ...rest } = t.metadata
  const chapter01 = t.chapters.find((c) => c.number === 1)
  // Version changes whenever the cover changes: curated .thumb mtime, or
  // the mtime of the chapter folder the fallback cover is taken from.
  const version = t.thumbMtimeMs ?? chapter01?.mtimeMs
  return {
    name: t.name,
    mtimeMs: t.mtimeMs,
    metadata: { ...rest, categories },
    categories: Array.from(new Set(categories.map(normalizeCategory))),
    thumb:
      version === undefined
        ? null
        : { url: `/api/read/${encodeURIComponent(t.name)}/01/thumb`, version: String(version) },
    chapters: t.chapters,
  }
}

export async function buildCatalog(since: number): Promise<CatalogResponse> {
  // Captured BEFORE scanning so a change made mid-scan shows up next time.
  const serverTime = Date.now()
  const listing = await listTitles(nodeFs, MANGA_ROOT)
  const allTitleNames = listing.map((t) => t.name)
  const todo = listing.filter(
    (t) => since <= 0 || Math.max(t.mtimeMs, t.metaMtimeMs ?? 0, t.thumbMtimeMs ?? 0) > since
  )

  const results: (CatalogTitle | undefined)[] = new Array(todo.length)
  let next = 0
  const worker = async () => {
    for (;;) {
      const i = next++
      if (i >= todo.length) return
      const t = todo[i]
      const key = `${t.mtimeMs}|${t.metaMtimeMs ?? ''}|${t.thumbMtimeMs ?? ''}`
      const hit = cache.get(t.name)
      if (hit && hit.key === key) {
        results[i] = hit.value
        continue
      }
      try {
        const scan = await scanTitle(nodeFs, MANGA_ROOT, t.name)
        const value = toCatalogTitle(scan)
        cache.set(t.name, { key, value })
        results[i] = value
      } catch (e) {
        // One broken title must not sink the whole response.
        console.error(`catalog: skipping ${t.name}:`, e)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker))

  const present = new Set(allTitleNames)
  for (const name of cache.keys()) if (!present.has(name)) cache.delete(name)

  return {
    serverTime,
    since,
    full: since <= 0,
    allTitleNames,
    titles: results.filter((t): t is CatalogTitle => t !== undefined),
  }
}
