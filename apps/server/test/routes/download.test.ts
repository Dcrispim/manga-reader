import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { makeLibrary, DEFAULT_SPEC, type LibraryResult } from '../fixtures/makeLibrary'

/* eslint-disable @typescript-eslint/no-explicit-any */
let lib: LibraryResult
let route: any
let argsFile: string
const TPL = 'https://example.com/manga/alpha/capitulo/{chapter}'
const ctx = (title: string) => ({ params: Promise.resolve({ title }) })
const post = (body: unknown) => new Request('http://x', { method: 'POST', body: JSON.stringify(body) }) as any

async function recordedArgs() {
  for (let i = 0; i < 50; i++) {
    const raw = await fs.readFile(argsFile, 'utf-8').catch(() => '')
    if (raw) return raw.trim().split('\n')
    await new Promise((r) => setTimeout(r, 20))
  }
  throw new Error('fake manga-download never ran')
}

beforeAll(async () => {
  lib = await makeLibrary(await DEFAULT_SPEC)
  process.env.MANGA_ROOT = lib.root
  // Stand-in for ~/cmd/manga-download: records its argv, one per line.
  argsFile = path.join(lib.root, '.download-args')
  const bin = path.join(lib.root, '.fake-manga-download')
  await fs.writeFile(bin, `#!/bin/sh\nprintf '%s\\n' "$@" > "${argsFile}"\n`, { mode: 0o755 })
  process.env.MANGA_DOWNLOAD_BIN = bin
  delete process.env.DOWNLOAD_WORKER_URL
  route = await import('@/app/api/download/[title]/route')
})

afterAll(async () => {
  await lib.cleanup()
})

describe('download route', () => {
  it('is 404 for unknown or unsafe titles', async () => {
    expect((await route.POST(post({ template: TPL, gaps: true }), ctx('Nope'))).status).toBe(404)
    expect((await route.POST(post({ template: TPL, gaps: true }), ctx('../Alpha'))).status).toBe(404)
  })

  it('rejects bad bodies', async () => {
    for (const body of [
      { template: 'example.com/{chapter}', gaps: true },
      { template: 'https://example.com/cap', gaps: true },
      { template: TPL },
      { template: TPL, start: '94' },
      { template: TPL, start: '10', end: '5' },
      { template: TPL, start: '1;rm', end: '5' },
    ]) {
      expect((await route.POST(post(body), ctx('Alpha'))).status).toBe(400)
    }
  })

  it('runs manga-download with the range and --gaps', async () => {
    await fs.rm(argsFile, { force: true })
    const res = await route.POST(post({ template: TPL, start: '94', end: '106', gaps: true }), ctx('Alpha'))
    expect(res.status).toBe(202)
    expect(await recordedArgs()).toEqual(['Alpha', TPL, '94', '106', '--gaps'])
  })

  it('runs manga-download with only --gaps, and --update to overwrite', async () => {
    await fs.rm(argsFile, { force: true })
    const res = await route.POST(post({ template: TPL, gaps: true, update: true }), ctx('Beta'))
    expect(res.status).toBe(202)
    expect(await recordedArgs()).toEqual(['Beta', TPL, '--gaps', '--update'])
  })
})
