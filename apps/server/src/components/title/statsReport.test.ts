import { describe, it, expect } from 'vitest'
import { normalizeStats, type RawStats } from './statsReport'

// Trimmed copy of a file from the oldest manga-stats generation still in the
// library (April): no views, `threshold`, no belowThresholdGlobal, gaps
// without link info, Windows paths.
const OLDEST = {
  meta: { title: 'mushoku', generatedAtIso: '2026-04-28T00:40:00+00:00', basePath: 'D:\\manga', chaptersPerChart: 100, titleDirAbs: 'D:\\manga\\mushoku' },
  summary: { chapterCount: 3, imageCountTotal: 68, mean: 22.6, std: 8.1, threshold: 14.5 },
  chapters: [
    { chapterNumber: 1, chapterName: '1', imageCount: 37 },
    { chapterNumber: 24.1, chapterName: '24.1', imageCount: 8 },
    { chapterNumber: 25, chapterName: '25', imageCount: 23 },
  ],
  groups: [{ start: 0, endExclusive: 100, items: [{ chapterNumber: 1, imageCount: 37 }] }],
  gaps: [{ start: 27, end: 27, missingCount: 1 }],
  belowThreshold: [{ chapterName: '24.1', imageCount: 8, chapterDirAbs: 'D:\\manga\\mushoku\\24.1' }],
}

describe('normalizeStats', () => {
  it('fills the fields the oldest generation lacks', () => {
    const s = normalizeStats(OLDEST)
    expect(s.legacy).toBe(true)
    expect(s.summary.globalThreshold).toBe(14.5)
    expect(s.belowThresholdGlobal).toEqual([{ chapterName: '24.1', imageCount: 8 }])
    expect(s.gaps).toEqual([{ start: 27, end: 27, missingCount: 1, withLinks: [], withoutLinksCount: 1 }])
    expect(Number.isNaN(s.groups[0].items[0].localThreshold)).toBe(true)
  })

  it('keeps current files as they are', () => {
    const s = normalizeStats({
      ...OLDEST,
      summary: { chapterCount: 3, imageCountTotal: 68, mean: 22.6, std: 8.1, globalThreshold: 14.5 },
      gaps: [{ start: 27, end: 28, missingCount: 2, withLinks: [28], withoutLinksCount: 1 }],
      belowThresholdGlobal: [],
      views: { images: { unit: 'img' } },
    } as unknown as RawStats)
    expect(s.legacy).toBe(false)
    expect(s.belowThresholdGlobal).toEqual([])
    expect(s.gaps[0].withLinks).toEqual([28])
  })

  it('survives an empty object', () => {
    const s = normalizeStats({})
    expect(s.groups).toEqual([])
    expect(s.gaps).toEqual([])
    expect(s.belowThreshold).toEqual([])
  })
})
