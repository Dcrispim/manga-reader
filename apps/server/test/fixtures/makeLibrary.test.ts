import { describe, it, expect } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { makeLibrary, DEFAULT_SPEC } from './makeLibrary'

describe('makeLibrary fixture', () => {
  it('should create a library with the default spec and clean up correctly', async () => {
    const spec = await DEFAULT_SPEC
    const library = await makeLibrary(spec)

    try {
      // Verify root and xlRoot exist
      const rootStats = await fs.stat(library.root)
      const xlRootStats = await fs.stat(library.xlRoot)

      expect(rootStats.isDirectory()).toBe(true)
      expect(xlRootStats.isDirectory()).toBe(true)

      // Verify Alpha title exists with chapters
      const alphaPath = path.join(library.root, 'Alpha')
      const alphaStats = await fs.stat(alphaPath)
      expect(alphaStats.isDirectory()).toBe(true)

      // Verify Alpha chapters
      const chapter1Path = path.join(alphaPath, '1')
      const chapter1Stats = await fs.stat(chapter1Path)
      expect(chapter1Stats.isDirectory()).toBe(true)

      // Verify pages in chapter 1 (should have 1.jpg, 2.jpg, 10.jpg)
      const chapter1Files = await fs.readdir(chapter1Path)
      expect(chapter1Files).toContain('1.jpg')
      expect(chapter1Files).toContain('2.jpg')
      expect(chapter1Files).toContain('10.jpg')
      expect(chapter1Files).toContain('notes.txt')

      // Verify chapter 2 exists with PNG pages
      const chapter2Path = path.join(alphaPath, '2')
      const chapter2Stats = await fs.stat(chapter2Path)
      expect(chapter2Stats.isDirectory()).toBe(true)

      const chapter2Files = await fs.readdir(chapter2Path)
      expect(chapter2Files).toContain('0.png')
      expect(chapter2Files).toContain('1.png')

      // Verify chapters 566 and 0566 both exist
      const chapter566Path = path.join(alphaPath, '566')
      const chapter0566Path = path.join(alphaPath, '0566')
      const chapter566Stats = await fs.stat(chapter566Path)
      const chapter0566Stats = await fs.stat(chapter0566Path)
      expect(chapter566Stats.isDirectory()).toBe(true)
      expect(chapter0566Stats.isDirectory()).toBe(true)

      // Verify Beta title exists
      const betaPath = path.join(library.root, 'Beta')
      const betaStats = await fs.stat(betaPath)
      expect(betaStats.isDirectory()).toBe(true)

      // Verify Beta chapters
      const betaChapter01Path = path.join(betaPath, '01')
      const betaChapter15Path = path.join(betaPath, '1.5')
      const betaChapter01Stats = await fs.stat(betaChapter01Path)
      const betaChapter15Stats = await fs.stat(betaChapter15Path)
      expect(betaChapter01Stats.isDirectory()).toBe(true)
      expect(betaChapter15Stats.isDirectory()).toBe(true)

      // Verify metadata file
      const betaMetaPath = path.join(library.root, '.meta', 'Beta.metadata')
      const metaContent = await fs.readFile(betaMetaPath, 'utf-8')
      expect(metaContent).toContain('categories=action, Comedy')
      expect(metaContent).toContain('authors=Fulano')
      expect(metaContent).toContain('sinopse=Texto')
      expect(metaContent).toContain('# This is a comment')
      expect(metaContent).toContain('description=a=b')

      // Verify Beta has a thumbnail
      const betaThumbPath = path.join(library.root, '.thumb', 'Beta.jpg')
      const betaThumbStats = await fs.stat(betaThumbPath)
      expect(betaThumbStats.isFile()).toBe(true)

      // Verify Alpha does NOT have a thumbnail
      const alphaThumPath = path.join(library.root, '.thumb', 'Alpha.jpg')
      let alphaThumbExists = false
      try {
        await fs.stat(alphaThumPath)
        alphaThumbExists = true
      } catch (err) {
        // Expected - Alpha should not have a thumbnail
      }
      expect(alphaThumbExists).toBe(false)

      // Verify .hidden directory exists but is not processed
      const hiddenPath = path.join(library.root, '.hidden')
      const hiddenStats = await fs.stat(hiddenPath)
      expect(hiddenStats.isDirectory()).toBe(true)
    } finally {
      // Clean up
      await library.cleanup()
    }

    // Verify cleanup actually removed directories
    let rootExists = false
    let xlRootExists = false

    try {
      await fs.stat(library.root)
      rootExists = true
    } catch (err) {
      // Expected - directory should not exist
    }

    try {
      await fs.stat(library.xlRoot)
      xlRootExists = true
    } catch (err) {
      // Expected - directory should not exist
    }

    expect(rootExists).toBe(false)
    expect(xlRootExists).toBe(false)
  })
})
