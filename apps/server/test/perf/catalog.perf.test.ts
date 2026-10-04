import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

// Heavy: ~1.2M empty files. Only runs with PERF=1. Set PERF_DIR to a
// directory on a real disk (tmpfs has an inode limit); defaults to os.tmpdir().
const TITLES = 200
const CHAPTERS = 400
const PAGES = 15

describe.skipIf(!process.env.PERF)('catalog performance (200x400x15)', () => {
  let root = ''

  beforeAll(async () => {
    const base = process.env.PERF_DIR || os.tmpdir()
    await fs.mkdir(base, { recursive: true })
    root = await fs.mkdtemp(path.join(base, 'catalog-perf-'))
    const t0 = Date.now()
    for (let t = 0; t < TITLES; t++) {
      const title = path.join(root, `Title ${String(t).padStart(3, '0')}`)
      await fs.mkdir(title)
      for (let c = 1; c <= CHAPTERS; c++) {
        const dir = path.join(title, String(c))
        await fs.mkdir(dir)
        await Promise.all(
          Array.from({ length: PAGES }, (_, p) => fs.writeFile(path.join(dir, `${p + 1}.jpg`), ''))
        )
      }
    }
    console.log(`library generated in ${Date.now() - t0} ms at ${root}`)
    process.env.MANGA_ROOT = root
  }, 1_800_000)

  afterAll(async () => {
    if (root) await fs.rm(root, { recursive: true, force: true })
  }, 1_800_000)

  it('meets the time goals', async () => {
    const { buildCatalog } = await import('@/services/catalog.server')

    let t = performance.now()
    const full = await buildCatalog(0)
    const fullMs = performance.now() - t
    expect(full.titles).toHaveLength(TITLES)
    expect(full.titles[0].chapters).toHaveLength(CHAPTERS)
    expect(full.titles[0].chapters[0].pages).toBe(PAGES)

    t = performance.now()
    const inc = await buildCatalog(full.serverTime)
    const incMs = performance.now() - t
    expect(inc.titles).toHaveLength(0)
    expect(inc.allTitleNames).toHaveLength(TITLES)

    const json = JSON.stringify(full)
    const { gzipSync } = await import('zlib')
    console.log(
      `PERF full=${fullMs.toFixed(0)} ms incremental=${incMs.toFixed(0)} ms ` +
        `json=${json.length} B gzip=${gzipSync(json).length} B`
    )
    expect(incMs).toBeLessThan(300)
    expect(fullMs).toBeLessThan(60_000)
  }, 1_800_000)
})
