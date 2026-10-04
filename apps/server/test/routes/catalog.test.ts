import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { CatalogResponseSchema } from '@manga/api-contract'
import { makeLibrary, DEFAULT_SPEC, type LibraryResult } from '../fixtures/makeLibrary'

let lib: LibraryResult
let GET: (req: Request) => Promise<Response>

const call = async (qs = '') => {
  const res = await GET(new Request(`http://localhost/api/catalog${qs}`))
  return { res, body: await res.json() }
}

beforeAll(async () => {
  lib = await makeLibrary(await DEFAULT_SPEC)
  process.env.MANGA_ROOT = lib.root
  GET = (await import('@/app/api/catalog/route')).GET
})

afterAll(async () => {
  await lib.cleanup()
})

describe('catalog endpoint', () => {
  let serverTime = 0

  it('since=0 returns every visible title and validates against the schema', async () => {
    const { res, body } = await call('?since=0')
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    const parsed = CatalogResponseSchema.parse(body)
    serverTime = parsed.serverTime
    expect(parsed.full).toBe(true)
    expect(parsed.allTitleNames.sort()).toEqual(['Alpha', 'Beta'])
    expect(parsed.titles.map((t) => t.name).sort()).toEqual(['Alpha', 'Beta'])

    const alpha = parsed.titles.find((t) => t.name === 'Alpha')!
    const ch = alpha.chapters.find((c) => c.id === '0566')
    expect(ch?.pages).toBe(4)
    expect(alpha.chapters.some((c) => c.id === '566')).toBe(false)
    expect(alpha.thumb?.url).toBe('/api/read/Alpha/01/thumb')

    const beta = parsed.titles.find((t) => t.name === 'Beta')!
    expect(beta.categories).toEqual(['Ação', 'Comédia'])
    expect(beta.thumb?.version).toMatch(/^\d/)
  })

  it('missing or invalid since behaves like 0', async () => {
    expect((await call()).body.titles).toHaveLength(2)
    expect((await call('?since=abc')).body.full).toBe(true)
  })

  it('since=serverTime returns no titles but the full name list', async () => {
    const { body } = await call(`?since=${serverTime}`)
    expect(body.full).toBe(false)
    expect(body.titles).toEqual([])
    expect([...body.allTitleNames].sort()).toEqual(['Alpha', 'Beta'])
  })

  it('a new chapter folder in Beta makes only Beta come back', async () => {
    const since = Date.now()
    const dir = path.join(lib.root, 'Beta', '3')
    await fs.mkdir(dir)
    await fs.writeFile(path.join(dir, '0.jpg'), 'x')
    const future = new Date(since + 5000)
    await fs.utimes(path.join(lib.root, 'Beta'), future, future)
    const { body } = await call(`?since=${since}`)
    expect(body.titles.map((t: { name: string }) => t.name)).toEqual(['Beta'])
    expect(body.titles[0].chapters.map((c: { id: string }) => c.id)).toContain('3')
  })

  it('editing the .metadata of Beta makes Beta come back', async () => {
    const since = Date.now() + 10_000
    const metaPath = path.join(lib.root, '.meta', 'Beta.metadata')
    await fs.writeFile(metaPath, 'categories=drama\nauthors=Outro')
    const future = new Date(since + 5000)
    await fs.utimes(metaPath, future, future)
    const { body } = await call(`?since=${since}`)
    expect(body.titles.map((t: { name: string }) => t.name)).toEqual(['Beta'])
    expect(body.titles[0].categories).toEqual(['Drama'])
  })

  it('a removed title disappears from allTitleNames', async () => {
    await fs.rm(path.join(lib.root, 'Alpha'), { recursive: true })
    const { body } = await call(`?since=${Date.now()}`)
    expect(body.allTitleNames).toEqual(['Beta'])
    const full = await call()
    expect(full.body.titles.map((t: { name: string }) => t.name)).toEqual(['Beta'])
  })
})
