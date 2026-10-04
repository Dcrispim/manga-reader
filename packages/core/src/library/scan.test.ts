import { describe, it, expect } from 'vitest'
import { memoryFs } from './memoryFs'
import { scanLibrary, scanTitle } from './scan'

const tree = () => ({
  A: { '1': { '1.jpg': 'x', '2.jpg': 'x', 'n.txt': 't' }, '566': { '1.jpg': 'x' }, '0566': { '1.jpg': 'x', '2.jpg': 'x' }, extras: { 'a.jpg': 'x' } },
  B: { '1': { '1.jpg': 'x' } },
  C: { '2': { '1.jpg': 'x' } },
  '.meta': { 'B.metadata': 'author=Z\n# c\ncategories=a, b' },
  '.thumb': {},
  '.hidden': { '1': {} },
})
const mk = () => memoryFs(tree(), '/lib', 100)

describe('scanTitle', () => {
  it('dedupes chapters, counts images, ignores non-numeric', async () => {
    const t = await scanTitle(mk(), '/lib', 'A')
    expect(t.chapters.map((c) => [c.id, c.number, c.pages])).toEqual([['1', 1, 2], ['0566', 566, 2]])
    expect(t.ignored.some((i) => i.startsWith('extras'))).toBe(true)
    expect(t.ignored.some((i) => i.startsWith('566'))).toBe(true)
  })
  it('parses metadata', async () => {
    const t = await scanTitle(mk(), '/lib', 'B')
    expect(t.metadata.author).toBe('Z')
    expect(t.metadata.categories).toEqual(['a', 'b'])
  })
})

describe('scanLibrary', () => {
  it('full scan skips dot dirs and lists all names', async () => {
    const r = await scanLibrary(mk(), '/lib')
    expect(r.titles.map((t) => t.name).sort()).toEqual(['A', 'B', 'C'])
    expect(r.allTitleNames.sort()).toEqual(['A', 'B', 'C'])
  })
  it('incremental returns only titles changed after since', async () => {
    const fs = mk()
    fs.setMtime('/lib/B', 500)
    const r = await scanLibrary(fs, '/lib', { since: 200 })
    expect(r.titles.map((t) => t.name)).toEqual(['B'])
    expect(r.allTitleNames).toHaveLength(3)
  })
  it('changed .meta brings the title back', async () => {
    const fs = mk()
    fs.setMtime('/lib/.meta/B.metadata', 900)
    const r = await scanLibrary(fs, '/lib', { since: 200 })
    expect(r.titles.map((t) => t.name)).toEqual(['B'])
    expect(r.titles[0].metaMtimeMs).toBe(900)
  })
  it('abort stops the scan', async () => {
    const ac = { aborted: false }
    const r = await scanLibrary(mk(), '/lib', {
      concurrency: 1,
      signal: ac,
      onProgress: (done) => { if (done === 1) ac.aborted = true },
    })
    expect(r.titles).toHaveLength(1)
    expect(r.allTitleNames).toHaveLength(3)
  })
  it('a failing title does not break the others', async () => {
    const fs = mk()
    fs.failOn('/lib/B')
    const r = await scanLibrary(fs, '/lib')
    expect(r.titles).toHaveLength(3)
    const b = r.titles.find((t) => t.name === 'B')!
    expect(b.chapters).toEqual([])
    expect(b.ignored[0]).toMatch(/B:/)
    expect(r.titles.find((t) => t.name === 'A')!.chapters).toHaveLength(2)
  })
  it('reports progress', async () => {
    const calls: number[] = []
    await scanLibrary(mk(), '/lib', { onProgress: (d, t) => calls.push(d * 10 + t) })
    expect(calls).toEqual([13, 23, 33])
  })
})
