import { readdir, readFile, rename, rm, stat, writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import mime from 'mime'
import sharp from 'sharp'
import { resolveChapterDir } from '@/utils/chapterDir.server'
import { MANGA_ROOT, MANGA_XL_ROOT } from '@/utils/paths.server'

// Upscaled pages are big enough that browsers struggle to decode/paint a
// whole one at once, so each xl page is also cut into horizontal strips
// that the reader stacks back together. Strips (rather than a grid) keep
// the vertical-scroll layout unchanged: they're just more images in the
// same column. Once a page is sliced its full file is deleted (it'd double
// the chapter's size on disk); joinSlices rebuilds it on demand for what
// still needs a whole page, like the offline high-res download.
export const SLICES_PER_PAGE = 4

// Slices sit right next to their page in the xl chapter dir, named
// <page>.slice-<n>.<ext> (e.g. 0003.jpg -> 0003.slice-0.jpg ... slice-3), so
// evicting/re-upscaling a chapter takes them with it. Anything that counts or
// lists a chapter's pages must go through listSortedImages, which folds the
// slices back into their page.
const SLICE_FILE_RE = /\.slice-\d+(\.[^.]+)$/

export function isSliceFile(file: string): boolean {
  return SLICE_FILE_RE.test(file)
}

const JPEG_QUALITY = 92

// A chapter's pages by file name, in reading order. A sliced page whose full
// file is gone still counts, under the name it had (0003.slice-*.jpg ->
// 0003.jpg) — pass that to slicePath/hasSlices/readPage.
export async function listSortedImages(dir: string): Promise<string[]> {
  const files = await readdir(dir).catch(() => [] as string[])
  const pages = new Set(
    files
      .filter((file) => mime.getType(file)?.startsWith('image/'))
      .map((file) => file.replace(SLICE_FILE_RE, '$1'))
  )
  return [...pages]
    .sort((a, b) => {
      const nameA = path.parse(a).name
      const nameB = path.parse(b).name

      const numA = /^\d+$/.test(nameA) ? parseInt(nameA, 10) : Infinity
      const numB = /^\d+$/.test(nameB) ? parseInt(nameB, 10) : Infinity

      return numA - numB || nameA.localeCompare(nameB)
    })
}

export function slicePath(chapterPath: string, file: string, slice: number): string {
  const { name, ext } = path.parse(file)
  return path.join(chapterPath, `${name}.slice-${slice}${ext}`)
}

export async function hasSlices(chapterPath: string, file: string): Promise<boolean> {
  const found = await Promise.all(
    Array.from({ length: SLICES_PER_PAGE }, (_, n) =>
      stat(slicePath(chapterPath, file, n)).then(() => true, () => false)
    )
  )
  return found.every(Boolean)
}

// The page as a single image: its full file if it's still there, otherwise
// stitched back together from its slices.
export async function readPage(chapterPath: string, file: string): Promise<Buffer> {
  try {
    return await readFile(path.join(chapterPath, file))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    return joinSlices(chapterPath, file)
  }
}

async function joinSlices(chapterPath: string, file: string): Promise<Buffer> {
  const parts = await Promise.all(
    Array.from({ length: SLICES_PER_PAGE }, (_, n) => readFile(slicePath(chapterPath, file, n)))
  )
  const metas = await Promise.all(parts.map((part) => sharp(part).metadata()))
  const width = metas[0].width!
  const height = metas.reduce((sum, meta) => sum + meta.height!, 0)

  let top = 0
  const layers = parts.map((input, i) => {
    const layer = { input, left: 0, top }
    top += metas[i].height!
    return layer
  })

  const canvas = sharp({ create: { width, height, channels: 3, background: '#ffffff' } }).composite(layers)
  const format = metas[0].format
  return format === 'jpeg' || !format
    ? canvas.jpeg({ quality: JPEG_QUALITY }).toBuffer()
    : canvas.toFormat(format).toBuffer()
}

async function slicePage(chapterPath: string, file: string): Promise<void> {
  const input = await readFile(path.join(chapterPath, file))
  const { width, height, format } = await sharp(input).metadata()
  if (!width || !height || height < SLICES_PER_PAGE) {
    throw new Error(`can't slice ${file}: ${width}x${height}`)
  }

  const sliceHeight = Math.floor(height / SLICES_PER_PAGE)
  for (let n = 0; n < SLICES_PER_PAGE; n++) {
    const top = n * sliceHeight
    // The last strip absorbs the rounding remainder.
    const extractHeight = n === SLICES_PER_PAGE - 1 ? height - top : sliceHeight

    let pipeline = sharp(input).extract({ left: 0, top, width, height: extractHeight })
    if (format === 'jpeg') pipeline = pipeline.jpeg({ quality: JPEG_QUALITY })
    const buffer = await pipeline.toBuffer()

    // Written aside and renamed in, so an interrupted run never leaves a
    // truncated strip that hasSlices() would take as complete. Unique per
    // write, so a concurrent run (another process) can't rename ours away.
    const target = slicePath(chapterPath, file, n)
    const partial = `${target}.${randomUUID()}.partial`
    await writeFile(partial, buffer)
    await rename(partial, target)
  }

  // Only now that every slice is safely in place.
  await rm(path.join(chapterPath, file), { force: true })
}

async function sliceMissingPages(chapterPath: string): Promise<void> {
  // One bad page shouldn't keep the rest of the chapter whole-page only.
  const failures: string[] = []
  for (const file of await listSortedImages(chapterPath)) {
    if (await hasSlices(chapterPath, file)) {
      // Sliced before full pages were being deleted (or interrupted right
      // before the delete) — finish the job.
      await rm(path.join(chapterPath, file), { force: true })
      continue
    }
    try {
      await slicePage(chapterPath, file)
    } catch (err) {
      failures.push(`${file}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  if (failures.length > 0) {
    throw new Error(`couldn't slice ${failures.length} page(s) in ${chapterPath}\n${failures.join('\n')}`)
  }
}

// One run per chapter at a time — the reader page, the xl list route and
// the upscale job can all ask for the same chapter. Kept on globalThis
// because Next bundles each route/page separately, each with its own copy
// of this module; a module-level Map wouldn't be shared between them.
interface InFlightRun {
  promise: Promise<void>
  startedAt: number
}
const globalForSlices = globalThis as typeof globalThis & {
  __xlSlicesInFlight?: Map<string, InFlightRun>
}
const inFlight = (globalForSlices.__xlSlicesInFlight ??= new Map<string, InFlightRun>())

// A whole chapter takes well under a minute; a run older than this is
// assumed stuck (e.g. orphaned by a dev-server reload, since the map above
// outlives module reloads) and no longer blocks new attempts.
const STALE_RUN_MS = 10 * 60 * 1000

// Idempotent: only pages without a complete set of slices are processed.
export function ensureChapterSlices(chapterPath: string): Promise<void> {
  const running = inFlight.get(chapterPath)
  if (running && Date.now() - running.startedAt < STALE_RUN_MS) return running.promise

  const run: InFlightRun = { startedAt: Date.now(), promise: Promise.resolve() }
  run.promise = sliceMissingPages(chapterPath).finally(() => {
    if (inFlight.get(chapterPath) === run) inFlight.delete(chapterPath)
  })
  inFlight.set(chapterPath, run)
  return run.promise
}

// Before (re-)upscaling a chapter: its pages are about to be rewritten, so
// any existing slices would be stale.
export async function clearChapterSlices(chapterPath: string): Promise<void> {
  await inFlight.get(chapterPath)?.promise.catch(() => {})
  const files = await readdir(chapterPath).catch(() => [] as string[])
  await Promise.all(
    files.filter(isSliceFile).map((file) => rm(path.join(chapterPath, file), { force: true }))
  )
}

// The upscaled counterpart of /api/read/<title>/<chapter>'s list: each page
// whose xl copy has been sliced comes back as its slice URLs
// (xl/<index>/<slice>), stacked in reading order. Anything not upscaled or
// not sliced yet falls back to xl/<index>, which itself falls back to the
// original page when there's no xl copy. Null if the chapter doesn't exist.
//
// Called directly by the reader page (not over HTTP), so it never depends
// on which server NEXT_PUBLIC_API_URL happens to point at.
export async function getXlChapterImages(title: string, chapter: string): Promise<string[] | null> {
  const chapterNumber = parseFloat(chapter)
  const pageUrl = (i: number) => `/api/read/${title}/${chapterNumber}/xl/${i}`

  const smallTitle = path.join(MANGA_ROOT, title)
  const smallDir = await resolveChapterDir(smallTitle, chapterNumber)
  if (!smallDir) return null
  const smallFiles = await listSortedImages(path.join(smallTitle, smallDir))

  const xlTitle = path.join(MANGA_XL_ROOT, title)
  const xlDir = await resolveChapterDir(xlTitle, chapterNumber)
  const xlPath = xlDir ? path.join(xlTitle, xlDir) : null
  const xlFiles = xlPath ? await listSortedImages(xlPath) : []

  // Not (fully) upscaled yet — same per-page URLs the reader always used.
  if (!xlPath || smallFiles.length === 0 || xlFiles.length < smallFiles.length) {
    return smallFiles.map((_, i) => pageUrl(i))
  }

  const sliced = await Promise.all(xlFiles.map((file) => hasSlices(xlPath, file)))
  // A page still on disk whole is either unsliced or sliced but not yet
  // deleted (e.g. sliced before full pages were being removed).
  const onDisk = new Set(await readdir(xlPath).catch(() => [] as string[]))
  if (sliced.some((done) => !done) || xlFiles.some((file) => onDisk.has(file))) {
    // Unsliced pages are served whole this time; the next load gets slices.
    void ensureChapterSlices(xlPath).catch((err) => {
      console.error(`[xl] slicing ${xlPath} failed:`, err)
    })
  }

  return xlFiles.flatMap((_, i) =>
    sliced[i]
      ? Array.from({ length: SLICES_PER_PAGE }, (_, n) => `${pageUrl(i)}/${n}`)
      : [pageUrl(i)]
  )
}
