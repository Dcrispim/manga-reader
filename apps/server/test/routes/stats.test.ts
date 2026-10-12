import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { makeLibrary, DEFAULT_SPEC, type LibraryResult } from '../fixtures/makeLibrary'

/* eslint-disable @typescript-eslint/no-explicit-any */
let lib: LibraryResult
let route: any
const ctx = (title: string) => ({ params: Promise.resolve({ title }) })
const req = (method = 'GET') => new Request('http://x', { method }) as any

beforeAll(async () => {
  lib = await makeLibrary(await DEFAULT_SPEC)
  process.env.MANGA_ROOT = lib.root
  // Stand-in for ~/cmd/manga-stats: writes <root>/<title>/<title>_stats.json,
  // or fails for the title "Beta".
  const bin = path.join(lib.root, '.fake-manga-stats')
  await fs.writeFile(
    bin,
    `#!/bin/sh
if [ "$1" = "Beta" ]; then echo "boom" >&2; exit 1; fi
echo '{"meta":{"title":"'"$1"'"},"gaps":[]}' > "${lib.root}/$1/$1_stats.json"
`,
    { mode: 0o755 }
  )
  process.env.MANGA_STATS_BIN = bin
  delete process.env.STATS_WORKER_URL
  route = await import('@/app/api/stats/[title]/route')
})

afterAll(async () => {
  await lib.cleanup()
})

describe('stats route', () => {
  it('GET is 404 for unknown or unsafe titles', async () => {
    expect((await route.GET(req(), ctx('Nope'))).status).toBe(404)
    expect((await route.GET(req(), ctx('../Alpha'))).status).toBe(404)
  })

  it('GET is 404 while the title has no stats json yet', async () => {
    const res = await route.GET(req(), ctx('Alpha'))
    expect(res.status).toBe(404)
  })

  it('POST runs manga-stats and answers with the fresh json', async () => {
    const res = await route.POST(req('POST'), ctx('Alpha'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ meta: { title: 'Alpha' }, gaps: [] })

    const again = await route.GET(req(), ctx('Alpha'))
    expect(again.status).toBe(200)
    expect((await again.json()).meta.title).toBe('Alpha')
  })

  it('POST surfaces manga-stats output when it fails', async () => {
    const res = await route.POST(req('POST'), ctx('Beta'))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toContain('boom')
  })
})
