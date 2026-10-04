import { describe, it, expect } from 'vitest'
import { buildDeltaPayload, mergeBindData, type BindPayload } from './bind'
import { getLatestChapter } from './history'

// Deterministic PRNG for property-based tests (Mulberry32)
function createSeededRandom(seed: number) {
  return function () {
    seed = (seed + 0x6d2b79f5) >>> 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomInt(random: () => number, min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min
}

function randomString(random: () => number, len: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < len; i++) {
    result += chars.charAt(randomInt(random, 0, chars.length - 1))
  }
  return result
}

function generateRandomPayload(
  random: () => number,
  titleCount: number = 3,
  chaptersPerTitle: number = 5,
): BindPayload {
  const history: Record<string, any> = {}
  const chapters: Record<string, string> = {}

  for (let i = 0; i < titleCount; i++) {
    const title = randomString(random, 4)
    const openedAt: Record<string, number> = {}

    for (let j = 0; j < chaptersPerTitle; j++) {
      const chapter = String(randomInt(random, 1, 100))
      if (!(chapter in openedAt)) {
        openedAt[chapter] = randomInt(random, 1000000, 9999999)
      }
    }

    const latestChapter = getLatestChapter({ openedAt })
    if (latestChapter) {
      chapters[title] = latestChapter
    }

    const historyArray = Object.keys(openedAt).slice(0, 5)
    history[title] = {
      lastRead: Math.max(...Object.values(openedAt)),
      history: historyArray,
      openedAt,
    }
  }

  return { history, chapters }
}

describe('bind.ts', () => {
  describe('mergeBindData', () => {
    it('should union disjoint titles', () => {
      const local: BindPayload = {
        history: {
          manga1: {
            lastRead: 1000,
            history: ['1'],
            openedAt: { '1': 1000 },
          },
        },
        chapters: { manga1: '1' },
      }

      const remote: BindPayload = {
        history: {
          manga2: {
            lastRead: 2000,
            history: ['2'],
            openedAt: { '2': 2000 },
          },
        },
        chapters: { manga2: '2' },
      }

      const result = mergeBindData(local, remote)

      expect(result.history).toHaveProperty('manga1')
      expect(result.history).toHaveProperty('manga2')
      expect(result.history.manga1.openedAt).toEqual({ '1': 1000 })
      expect(result.history.manga2.openedAt).toEqual({ '2': 2000 })
    })

    it('should take max of timestamps for same chapter', () => {
      const local: BindPayload = {
        history: {
          manga: {
            lastRead: 1000,
            history: ['1'],
            openedAt: { '1': 1000 },
          },
        },
        chapters: { manga: '1' },
      }

      const remote: BindPayload = {
        history: {
          manga: {
            lastRead: 2000,
            history: ['1'],
            openedAt: { '1': 2000 },
          },
        },
        chapters: { manga: '1' },
      }

      const result = mergeBindData(local, remote)

      expect(result.history.manga.openedAt['1']).toBe(2000)
      expect(result.history.manga.lastRead).toBe(2000)
    })

    it('should keep only 5 most recent chapters by openedAt', () => {
      const local: BindPayload = {
        history: {
          manga: {
            lastRead: 5000,
            history: ['1', '2'],
            openedAt: { '1': 1000, '2': 2000 },
          },
        },
        chapters: { manga: '2' },
      }

      const remote: BindPayload = {
        history: {
          manga: {
            lastRead: 8000,
            history: ['3', '4', '5', '6'],
            openedAt: { '3': 3000, '4': 4000, '5': 5000, '6': 6000 },
          },
        },
        chapters: { manga: '6' },
      }

      const result = mergeBindData(local, remote)

      expect(result.history.manga.history).toHaveLength(5)
      expect(result.history.manga.history).toEqual(['2', '3', '4', '5', '6'])
    })

    it('should set chapters to the latest chapter by openedAt', () => {
      const local: BindPayload = {
        history: {
          manga: {
            lastRead: 2000,
            history: ['1', '2'],
            openedAt: { '1': 1000, '2': 2000 },
          },
        },
        chapters: { manga: '2' },
      }

      const remote: BindPayload = {
        history: {
          manga: {
            lastRead: 3000,
            history: ['3'],
            openedAt: { '3': 3000 },
          },
        },
        chapters: { manga: '3' },
      }

      const result = mergeBindData(local, remote)

      expect(result.chapters.manga).toBe('3')
    })

    it('should handle legacy fallback when no openedAt timestamps', () => {
      const local: BindPayload = {
        history: {
          manga: {
            lastRead: 1000,
            history: [],
            openedAt: {},
          },
        },
        chapters: { manga: '1' },
      }

      const remote: BindPayload = {
        history: {
          manga: {
            lastRead: 2000,
            history: [],
            openedAt: {},
          },
        },
        chapters: { manga: '2' },
      }

      const result = mergeBindData(local, remote)

      // Since remote.lastRead (2000) > local.lastRead (1000) and no openedAt,
      // chapters[manga] should be the legacy fallback from remote
      expect(result.chapters.manga).toBe('2')
    })

    it('should preserve local chapters when remote has no data for title', () => {
      const local: BindPayload = {
        history: {
          manga: {
            lastRead: 1000,
            history: ['1'],
            openedAt: { '1': 1000 },
          },
        },
        chapters: { manga: '1' },
      }

      const remote: BindPayload = {
        history: {},
        chapters: {},
      }

      const result = mergeBindData(local, remote)

      expect(result.chapters.manga).toBe('1')
    })

    // Property test: idempotency
    it('should be idempotent: merge(a, a) has same openedAt and lastRead as a', () => {
      const random = createSeededRandom(42)

      for (let i = 0; i < 100; i++) {
        const a = generateRandomPayload(random)

        const merged = mergeBindData(a, a)

        // Check that openedAt is identical
        for (const title of Object.keys(a.history)) {
          expect(merged.history[title]?.openedAt).toEqual(a.history[title]?.openedAt)
          expect(merged.history[title]?.lastRead).toBe(a.history[title]?.lastRead)
          // Note: history array order may change after merge due to sorting by openedAt,
          // but the set of chapters should be the same
          expect(new Set(merged.history[title]?.history)).toEqual(
            new Set(a.history[title]?.history),
          )
        }
      }
    })

    // Property test: commutativity of openedAt and lastRead
    it('should have commutative openedAt and lastRead: merge(a,b) ≈ merge(b,a)', () => {
      const random = createSeededRandom(123)

      for (let i = 0; i < 100; i++) {
        const a = generateRandomPayload(random)
        const b = generateRandomPayload(random)

        const ab = mergeBindData(a, b)
        const ba = mergeBindData(b, a)

        // Check that openedAt is the same (regardless of order)
        const titleSet = new Set([
          ...Object.keys(ab.history),
          ...Object.keys(ba.history),
        ])

        for (const title of titleSet) {
          expect(ab.history[title]?.openedAt).toEqual(ba.history[title]?.openedAt)
          expect(ab.history[title]?.lastRead).toBe(ba.history[title]?.lastRead)
        }

        // Note: chapters field may differ due to legacy fallback logic
        // (documented: the field is tied to which side has higher lastRead,
        // so order can matter). This is acceptable per the spec.
      }
    })

    // Property test: associativity of openedAt
    it('should have associative openedAt: merge(merge(a,b),c) ≈ merge(a,merge(b,c))', () => {
      const random = createSeededRandom(456)

      for (let i = 0; i < 100; i++) {
        const a = generateRandomPayload(random)
        const b = generateRandomPayload(random)
        const c = generateRandomPayload(random)

        const abc = mergeBindData(mergeBindData(a, b), c)
        const acb = mergeBindData(a, mergeBindData(b, c))

        const titleSet = new Set([
          ...Object.keys(abc.history),
          ...Object.keys(acb.history),
        ])

        for (const title of titleSet) {
          expect(abc.history[title]?.openedAt).toEqual(acb.history[title]?.openedAt)
          expect(abc.history[title]?.lastRead).toBe(acb.history[title]?.lastRead)
        }
      }
    })
  })

  describe('buildDeltaPayload', () => {
    it('should include only timestamps greater than since', () => {
      const payload: BindPayload = {
        history: {
          manga: {
            lastRead: 3000,
            history: ['1', '2', '3'],
            openedAt: { '1': 1000, '2': 2000, '3': 3000 },
          },
        },
        chapters: { manga: '3' },
      }

      const delta = buildDeltaPayload(payload, 1500)

      expect(delta.history.manga.openedAt).toEqual({ '2': 2000, '3': 3000 })
    })

    it('should exclude titles with no timestamps after since', () => {
      const payload: BindPayload = {
        history: {
          manga1: {
            lastRead: 1000,
            history: ['1'],
            openedAt: { '1': 1000 },
          },
          manga2: {
            lastRead: 3000,
            history: ['2', '3'],
            openedAt: { '2': 2000, '3': 3000 },
          },
        },
        chapters: { manga1: '1', manga2: '3' },
      }

      const delta = buildDeltaPayload(payload, 1500)

      expect(delta.history).not.toHaveProperty('manga1')
      expect(delta.history).toHaveProperty('manga2')
    })

    it('should always include the full chapters map', () => {
      const payload: BindPayload = {
        history: {
          manga: {
            lastRead: 1000,
            history: ['1'],
            openedAt: { '1': 1000 },
          },
        },
        chapters: { manga: '1', other: 'x' },
      }

      const delta = buildDeltaPayload(payload, 2000)

      expect(delta.chapters).toEqual({ manga: '1', other: 'x' })
    })

    it('should handle empty payload', () => {
      const payload: BindPayload = {
        history: {},
        chapters: {},
      }

      const delta = buildDeltaPayload(payload, 1000)

      expect(delta).toEqual({ history: {}, chapters: {} })
    })
  })
})
