import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { makeLibrary, DEFAULT_SPEC, type LibraryResult } from '../fixtures/makeLibrary'

/* eslint-disable @typescript-eslint/no-explicit-any */
let lib: LibraryResult
let bind: any
let bindCode: any
const ctx = (code: string) => ({ params: Promise.resolve({ code }) })
const post = (body: unknown) =>
  new Request('http://x', { method: 'POST', body: JSON.stringify(body) }) as any
const FIXED_NOW = 1_700_000_000_000

beforeAll(async () => {
  lib = await makeLibrary(await DEFAULT_SPEC)
  process.env.MANGA_ROOT = lib.root
  process.env.MANGA_XL_ROOT = lib.xlRoot
  bind = await import('@/app/api/bind/route')
  bindCode = await import('@/app/api/bind/[code]/route')
  // Date.now() ends up in createdAt/updatedAt: freeze it so snapshots are stable
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(FIXED_NOW)
})

afterAll(async () => {
  vi.useRealTimers()
  await lib.cleanup()
})

describe('bind routes', () => {
  let code = ''

  it('POST /api/bind creates <root>/.binds/<CODE>.json', async () => {
    const res = await bind.POST(post({ history: {}, chapters: { Alpha: '1' } }))
    const body = await res.json()
    code = body.code
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
    const onDisk = JSON.parse(await fs.readFile(path.join(lib.root, '.binds', `${code}.json`), 'utf-8'))
    expect(onDisk).toEqual(body)
    expect({ ...body, code: '<CODE>' }).toMatchSnapshot()
  })

  it('GET /api/bind/[code] reads the file (case/punctuation-insensitive)', async () => {
    const res = await bindCode.GET(new Request('http://x') as any, ctx(code))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.code).toBe(code)
    const lower = await bindCode.GET(new Request('http://x') as any, ctx(code.toLowerCase().slice(0, 3) + '-' + code.slice(3)))
    expect(lower.status).toBe(200)
  })

  it('POST /api/bind/[code] merges into the existing bind', async () => {
    vi.setSystemTime(FIXED_NOW + 1000)
    const res = await bindCode.POST(
      post({
        history: { Alpha: { lastRead: 5000, history: ['1', '2'], openedAt: { '1': 4000, '2': 5000 } } },
        chapters: { Beta: '01' },
      }),
      ctx(code)
    )
    const body = await res.json()
    expect(body.createdAt).toBe(FIXED_NOW)
    expect(body.updatedAt).toBe(FIXED_NOW + 1000)
    expect({ ...body, code: '<CODE>' }).toMatchSnapshot()
  })

  it('POST /api/bind/[code] recreates a missing bind under the normalized code', async () => {
    // characterization: current behavior — unknown codes are created, not rejected
    const res = await bindCode.POST(post({ history: {}, chapters: { X: '1' } }), ctx('zzz-999'))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchSnapshot()
  })

  it('GET unknown code returns 404', async () => {
    const res = await bindCode.GET(new Request('http://x') as any, ctx('NOPE22'))
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchSnapshot()
  })
})
