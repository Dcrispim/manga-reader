import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { makeLibrary, DEFAULT_SPEC, type LibraryResult } from '../fixtures/makeLibrary'

// services/metadata.ts uses React's cache(), which only exists in the Next runtime.
vi.mock('react', async (orig) => ({
  ...((await orig()) as object),
  cache: (fn: unknown) => fn,
}))

// All handlers are characterized as they behave today; oddities are recorded, not fixed.
/* eslint-disable @typescript-eslint/no-explicit-any */
let lib: LibraryResult
const r: Record<string, any> = {}
const ctx = (p: Record<string, string>) => ({ params: Promise.resolve(p) })
const req = () => new Request('http://x')

beforeAll(async () => {
  lib = await makeLibrary(await DEFAULT_SPEC)
  process.env.MANGA_ROOT = lib.root
  process.env.MANGA_XL_ROOT = lib.xlRoot
  r.list = await import('@/app/api/list/route')
  r.title = await import('@/app/api/read/[title]/route')
  r.chapter = await import('@/app/api/read/[title]/[chapter]/route')
  r.page = await import('@/app/api/read/[title]/[chapter]/[index]/route')
  r.thumb = await import('@/app/api/read/[title]/[chapter]/thumb/route')
  r.meta = await import('@/app/api/metadata/[title]/route')
  r.cats = await import('@/app/api/categories/route')
  r.cat = await import('@/app/api/categories/[categoryId]/route')
})

afterAll(async () => {
  await lib.cleanup()
})

describe('GET /api/list', () => {
  it('lists visible titles only', async () => {
    const res = await r.list.GET()
    const body = await res.json()
    const names = body.map((t: any) => t.name)
    expect(names).toContain('Alpha')
    expect(names).toContain('Beta')
    expect(names).not.toContain('.hidden')
    // directory order is not guaranteed; sort before snapshotting
    expect(res.status).toBe(200)
    expect([...body].sort((a: any, b: any) => a.name.localeCompare(b.name))).toMatchSnapshot()
  })
})

describe('GET /api/read/[title]', () => {
  it('dedupes 566/0566 keeping 0566 and ignores non-numeric folders', async () => {
    const res = await r.title.GET(req(), ctx({ title: 'Alpha' }))
    const body = await res.json()
    expect(body.chapters).toEqual(['1', '2', '0566'])
    expect(body.chapters).not.toContain('extras')
    expect(Object.keys(body.modified).sort()).toEqual([...body.chapters].sort())
    // mtimes vary per run: normalize them
    const normalized = { ...body, modified: Object.fromEntries(Object.keys(body.modified).sort().map((k) => [k, typeof body.modified[k]])) }
    expect(normalized).toMatchSnapshot()
  })
})

describe('GET /api/read/[title]/[chapter]', () => {
  it('lists Alpha/1 images in numeric order, ignoring notes.txt', async () => {
    const res = await r.chapter.GET(req(), ctx({ title: 'Alpha', chapter: '1' }))
    const body = await res.json()
    expect(body.images).toEqual(['/api/read/Alpha/1/0', '/api/read/Alpha/1/1', '/api/read/Alpha/1/2'])
    expect(body).toMatchSnapshot()
  })

  it('Alpha/566 resolves to the 0566 folder (4 images)', async () => {
    const res = await r.chapter.GET(req(), ctx({ title: 'Alpha', chapter: '566' }))
    const body = await res.json()
    expect(body.images).toHaveLength(4)
    expect(body).toMatchSnapshot()
  })

  it('returns 404 for a missing chapter', async () => {
    const res = await r.chapter.GET(req(), ctx({ title: 'Alpha', chapter: '999' }))
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchSnapshot()
  })
})

describe('GET /api/read/[title]/[chapter]/[index]', () => {
  it('serves the file bytes in sorted order (1.jpg, 2.jpg, 10.jpg)', async () => {
    const dir = path.join(lib.root, 'Alpha', '1')
    for (const [i, file] of ['1.jpg', '2.jpg', '10.jpg'].entries()) {
      const res = await r.page.GET(req(), ctx({ title: 'Alpha', chapter: '1', index: String(i) }))
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toMatch(/^image\//)
      const body = Buffer.from(await res.arrayBuffer())
      expect(body.equals(await fs.readFile(path.join(dir, file)))).toBe(true)
    }
  })

  it('returns 404 for a missing chapter and 400 for an out-of-range index', async () => {
    const miss = await r.page.GET(req(), ctx({ title: 'Alpha', chapter: '999', index: '0' }))
    expect(miss.status).toBe(404)
    const oob = await r.page.GET(req(), ctx({ title: 'Alpha', chapter: '1', index: '3' }))
    expect(oob.status).toBe(400)
    expect({ miss: miss.status, oob: oob.status, oobBody: await oob.json() }).toMatchSnapshot()
  })
})

describe('GET /api/read/[title]/[chapter]/thumb', () => {
  it('returns the curated .thumb for Beta', async () => {
    const res = await r.thumb.GET(req(), ctx({ title: 'Beta', chapter: '1' }))
    const body = Buffer.from(await res.arrayBuffer())
    expect(body.equals(await fs.readFile(path.join(lib.root, '.thumb', 'Beta.jpg')))).toBe(true)
    expect({ status: res.status, contentType: res.headers.get('content-type') }).toMatchSnapshot()
  })

  it('falls back to the first page of the chapter for Alpha', async () => {
    // characterization: current behavior — fallback is the first image of the requested chapter
    const res = await r.thumb.GET(req(), ctx({ title: 'Alpha', chapter: '1' }))
    expect({ status: res.status, contentType: res.headers.get('content-type') }).toMatchSnapshot()
  })

  it('404s when there is no curated thumb and the chapter is missing', async () => {
    // characterization: current behavior
    const res = await r.thumb.GET(req(), ctx({ title: 'Alpha', chapter: '999' }))
    expect(res.status).toBe(404)
  })
})

describe('GET /api/metadata/[title]', () => {
  it('Beta: parsed metadata and curated thumb', async () => {
    const res = await r.meta.GET(req(), ctx({ title: 'Beta' }))
    const body = await res.json()
    // characterization: current behavior — categories are not normalized
    // characterization: current behavior — the fixture has both `sinopse=Texto` and
    // `description=a=b`; the later line wins, so the plan's expected 'Texto' does not hold.
    expect(body.description).toBe('a=b')
    expect(body.thumbSource).toBe('curated')
    expect(body.author).toBeDefined()
    expect(body).toMatchSnapshot()
  })

  it('Alpha: empty metadata and cropped thumb', async () => {
    const res = await r.meta.GET(req(), ctx({ title: 'Alpha' }))
    const body = await res.json()
    expect(body.thumbSource).toBe('crop')
    expect(body).toMatchSnapshot()
  })
})

describe('categories', () => {
  it('GET /api/categories', async () => {
    const res = await r.cats.GET()
    expect(await res.json()).toMatchSnapshot()
  })

  it('GET /api/categories/[categoryId]', async () => {
    const out: Record<string, unknown> = {}
    for (const id of ['action', 'Action', 'comedy', 'nonexistent']) {
      const res = await r.cat.GET(req(), ctx({ categoryId: id }))
      out[id] = await res.json()
    }
    expect(out).toMatchSnapshot()
  })
})
