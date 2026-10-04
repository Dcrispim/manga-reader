import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { scanLibrary } from '@manga/core'
import { nodeFs } from '@/services/nodeFs.server'
import { makeLibrary, DEFAULT_SPEC, type LibraryResult } from './fixtures/makeLibrary'

let lib: LibraryResult
beforeAll(async () => {
  lib = await makeLibrary(await DEFAULT_SPEC)
  process.env.MANGA_ROOT = lib.root
  process.env.MANGA_XL_ROOT = lib.xlRoot
})
afterAll(async () => {
  await lib.cleanup()
})

describe('nodeFs + scanLibrary', () => {
  it('matches /api/read/Alpha chapter ids and order', async () => {
    const route = await import('@/app/api/read/[title]/route')
    const res = await route.GET(new Request('http://x'), { params: Promise.resolve({ title: 'Alpha' }) })
    const body = await res.json()

    const { titles, allTitleNames } = await scanLibrary(nodeFs, lib.root)
    const alpha = titles.find((t) => t.name === 'Alpha')!
    expect(alpha.chapters.map((c) => c.id)).toEqual(body.chapters)
    expect(allTitleNames).toContain('Beta')
    expect(allTitleNames).not.toContain('.hidden')
  })

  it('incremental scan with a future since returns no titles', async () => {
    const r = await scanLibrary(nodeFs, lib.root, { since: Date.now() + 60_000 })
    expect(r.titles).toEqual([])
    expect(r.allTitleNames.length).toBeGreaterThan(0)
  })
})
