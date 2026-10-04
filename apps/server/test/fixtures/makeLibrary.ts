import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import sharp from 'sharp'

export interface LibrarySpec {
  titles: TitleSpec[]
}

export interface TitleSpec {
  name: string
  chapters: ChapterSpec[]
  thumb?: Buffer
  metadata?: string
}

export interface ChapterSpec {
  number: string | number
  pages: PageSpec[]
  extraFiles?: { name: string; content: string }[]
}

export interface PageSpec {
  index: number
  extension?: 'jpg' | 'png'
}

export interface LibraryResult {
  root: string
  xlRoot: string
  cleanup(): Promise<void>
}

/**
 * Generate a minimal valid JPEG buffer with a specific color.
 * Used to create unique images based on page index.
 */
async function generateImage(colorIndex: number): Promise<Buffer> {
  // Derive color from index: each page gets a different hue
  const hue = (colorIndex * 30) % 360
  const rgb = hslToRgb(hue, 50, 50)

  return sharp({
    create: {
      width: 1,
      height: 1,
      channels: 3,
      background: { r: rgb.r, g: rgb.g, b: rgb.b },
    },
  })
    .jpeg()
    .toBuffer()
}

function hslToRgb(
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } {
  s /= 100
  l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))

  return {
    r: Math.round(f(0) * 255),
    g: Math.round(f(8) * 255),
    b: Math.round(f(4) * 255),
  }
}

/**
 * Generate a minimal valid thumbnail JPEG (2×3 px with fixed color).
 */
async function generateThumbnail(): Promise<Buffer> {
  return sharp({
    create: {
      width: 2,
      height: 3,
      channels: 3,
      background: { r: 100, g: 150, b: 200 },
    },
  })
    .jpeg()
    .toBuffer()
}

export async function makeLibrary(spec: LibrarySpec): Promise<LibraryResult> {
  const tmpDir = os.tmpdir()
  const root = await fs.mkdtemp(path.join(tmpDir, 'manga-test-'))
  const xlRoot = await fs.mkdtemp(path.join(tmpDir, 'manga-test-xl-'))

  try {
    // Create all titles
    for (const title of spec.titles) {
      if (title.name.startsWith('.')) {
        // Hidden directories are still created but should be ignored by parser
        const titlePath = path.join(root, title.name)
        await fs.mkdir(titlePath, { recursive: true })
        continue
      }

      const titlePath = path.join(root, title.name)
      await fs.mkdir(titlePath, { recursive: true })

      // Create chapters
      for (const chapter of title.chapters) {
        const chapterNum = String(chapter.number)
        const chapterPath = path.join(titlePath, chapterNum)
        await fs.mkdir(chapterPath, { recursive: true })

        // Create pages
        for (const page of chapter.pages) {
          // Use specified extension or default to jpg
          const ext = page.extension || 'jpg'
          const imageName = `${page.index}.${ext}`
          const imagePath = path.join(chapterPath, imageName)

          const imageBuffer = await generateImage(page.index)
          await fs.writeFile(imagePath, imageBuffer)
        }

        // Create extra files if specified
        if (chapter.extraFiles) {
          for (const file of chapter.extraFiles) {
            const filePath = path.join(chapterPath, file.name)
            await fs.writeFile(filePath, file.content)
          }
        }
      }

      // Create thumbnail if provided
      if (title.thumb) {
        const thumbDir = path.join(root, '.thumb')
        await fs.mkdir(thumbDir, { recursive: true })
        await fs.writeFile(path.join(thumbDir, `${title.name}.jpg`), title.thumb)
      }

      // Create metadata if provided
      if (title.metadata) {
        const metaDir = path.join(root, '.meta')
        await fs.mkdir(metaDir, { recursive: true })
        await fs.writeFile(path.join(metaDir, `${title.name}.metadata`), title.metadata)
      }
    }

    return {
      root,
      xlRoot,
      cleanup: async () => {
        await fs.rm(root, { recursive: true, force: true })
        await fs.rm(xlRoot, { recursive: true, force: true })
      },
    }
  } catch (error) {
    // Clean up on error
    await fs.rm(root, { recursive: true, force: true })
    await fs.rm(xlRoot, { recursive: true, force: true })
    throw error
  }
}

// Default specification as per requirements
let cachedDefaultSpec: LibrarySpec | null = null

async function buildDefaultSpec(): Promise<LibrarySpec> {
  if (cachedDefaultSpec) {
    return cachedDefaultSpec
  }

  const betaThumb = await generateThumbnail()

  cachedDefaultSpec = {
    titles: [
      {
        name: 'Alpha',
        chapters: [
          {
            number: '1',
            pages: [
              { index: 1, extension: 'jpg' },
              { index: 2, extension: 'jpg' },
              { index: 10, extension: 'jpg' },
            ],
            extraFiles: [{ name: 'notes.txt', content: 'Chapter notes' }],
          },
          {
            number: '2',
            pages: [{ index: 0, extension: 'png' }, { index: 1, extension: 'png' }],
          },
          {
            number: '566',
            pages: [{ index: 0 }, { index: 1 }],
          },
          {
            number: '0566',
            pages: [{ index: 0 }, { index: 1 }, { index: 2 }, { index: 3 }],
          },
          // extras folder (non-numeric, should be ignored by parser)
          {
            number: 'extras',
            pages: [],
          },
        ],
      },
      {
        name: 'Beta',
        thumb: betaThumb,
        chapters: [
          {
            number: '01',
            pages: [{ index: 0 }, { index: 1 }],
          },
          {
            number: '1.5',
            pages: [{ index: 0 }, { index: 1 }],
          },
        ],
        metadata:
          'categories=action, Comedy\nauthors=Fulano\nsinopse=Texto\n# This is a comment\ndescription=a=b',
      },
      {
        name: '.hidden',
        chapters: [
          {
            number: '1',
            pages: [{ index: 0 }],
          },
        ],
      },
    ],
  }

  return cachedDefaultSpec
}

export const DEFAULT_SPEC = buildDefaultSpec()
