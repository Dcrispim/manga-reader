import { describe, it, expect } from 'vitest'
import { getLatestChapter, type TitleHistory } from './history'

describe('history.ts', () => {
  describe('getLatestChapter', () => {
    it('should return null for empty openedAt', () => {
      const entry: TitleHistory = {
        lastRead: null,
        history: [],
        openedAt: {},
      }

      const result = getLatestChapter(entry)

      expect(result).toBeNull()
    })

    it('should return null when entry is undefined', () => {
      const result = getLatestChapter(undefined)

      expect(result).toBeNull()
    })

    it('should return null when openedAt is undefined', () => {
      const entry: Partial<TitleHistory> = {
        lastRead: 1000,
        history: ['1'],
        // openedAt is undefined
      }

      const result = getLatestChapter(entry)

      expect(result).toBeNull()
    })

    it('should return the chapter with highest timestamp', () => {
      const entry: TitleHistory = {
        lastRead: 3000,
        history: ['1', '2', '3'],
        openedAt: { '1': 1000, '2': 3000, '3': 2000 },
      }

      const result = getLatestChapter(entry)

      expect(result).toBe('2')
    })

    it('should return the first chapter when all have same timestamp', () => {
      const entry: TitleHistory = {
        lastRead: 1000,
        history: ['1', '2', '3'],
        openedAt: { '1': 1000, '2': 1000, '3': 1000 },
      }

      const result = getLatestChapter(entry)

      // When there's a tie, the current implementation returns the first one found
      // (due to Object.entries iteration order, which is insertion order in modern JS)
      expect(result).toBe('1')
    })

    it('should handle single chapter', () => {
      const entry: TitleHistory = {
        lastRead: 5000,
        history: ['42'],
        openedAt: { '42': 5000 },
      }

      const result = getLatestChapter(entry)

      expect(result).toBe('42')
    })

    it('should handle numeric string chapter names', () => {
      const entry: TitleHistory = {
        lastRead: 300,
        history: ['001', '002', '003'],
        openedAt: { '001': 100, '002': 300, '003': 200 },
      }

      const result = getLatestChapter(entry)

      expect(result).toBe('002')
    })

    it('should ignore history array and only use openedAt timestamps', () => {
      const entry: TitleHistory = {
        lastRead: 3000,
        history: ['5', '4', '3', '2', '1'], // Most recent first in history array
        openedAt: { '1': 3000, '2': 1000, '3': 1000, '4': 2000, '5': 2000 },
      }

      const result = getLatestChapter(entry)

      // Should return '1' because it has the highest timestamp (3000),
      // not '5' which is first in the history array
      expect(result).toBe('1')
    })
  })
})
