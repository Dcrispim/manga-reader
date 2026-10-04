import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { readdir, rm, stat } from 'fs/promises'
import { spawn } from 'child_process'
import path from 'path'
import { resolveChapterDir } from '@/utils/chapterDir.server'
import { clearChapterSlices, ensureChapterSlices, listSortedImages } from '@/services/xlSlices'

// Upscaled pages are much larger than the originals, so xl copies are kept
// per title on a rolling basis rather than indefinitely — once a title
// would have more than this many chapters upscaled or in flight, the
// least-recently-finished one is evicted to make room.
const CHAPTER_BUFFER_PER_TITLE = 10

const MANGA_ROOT = '/mnt/d/manga'
const XL_ROOT = '/mnt/d/manga-xl'
// manga-up mirrors <MANGA_ROOT>/<relative path> into <XL_ROOT>/<relative path>
// via realesrgan-ncnn-vulkan (anime model). See ~/cmd/manga-up.
const UPSCALE_BIN = process.env.MANGA_UP_BIN || '/home/dcrispim/cmd/manga-up'

// The container this app normally runs in has no GPU/Vulkan access, so it
// can't run manga-up itself. When set, jobs are dispatched over HTTP to
// scripts/upscale-worker.mjs running on the host instead of spawning
// manga-up locally. See that script for the other half of this.
const UPSCALE_WORKER_URL = process.env.UPSCALE_WORKER_URL
const UPSCALE_WORKER_TOKEN = process.env.UPSCALE_WORKER_TOKEN

// Lives alongside the other app-managed dot-directories (.search, .thumb,
// .binds) inside the library mount, not in the repo.
const STATE_DIR = path.join(MANGA_ROOT, '.upscale')
const DB_PATH = path.join(STATE_DIR, 'queue.db')

export type UpscaleStatus = 'pending' | 'processing' | 'done' | 'error'

interface UpscaleJobRow {
  key: string
  title: string
  chapter_dir: string
  status: UpscaleStatus
  requested_at: number
  started_at: number | null
  finished_at: number | null
  error: string | null
}

let db: Database.Database | null = null

function getDb(): Database.Database {
  if (db) return db

  mkdirSync(STATE_DIR, { recursive: true })
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS upscale_jobs (
      key TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      chapter_dir TEXT NOT NULL,
      status TEXT NOT NULL,
      requested_at INTEGER NOT NULL,
      started_at INTEGER,
      finished_at INTEGER,
      error TEXT
    )
  `)

  // Nothing is actually running yet in this fresh process, so any job left
  // "processing" from a previous run got interrupted (crash/restart) and
  // would otherwise report as in-progress forever without anyone re-running it.
  db.prepare(`UPDATE upscale_jobs SET status = 'pending' WHERE status = 'processing'`).run()

  return db
}

const jobKey = (title: string, chapterDir: string) => `${title}/${chapterDir}`

// Pages, not files: in an xl dir a sliced page is only its slices.
async function countImages(dir: string): Promise<number> {
  return (await listSortedImages(dir)).length
}

function getJobRow(title: string, chapterDir: string): UpscaleJobRow | undefined {
  return getDb()
    .prepare('SELECT * FROM upscale_jobs WHERE key = ?')
    .get(jobKey(title, chapterDir)) as UpscaleJobRow | undefined
}

function upsertPending(key: string, title: string, chapterDir: string) {
  getDb()
    .prepare(
      `INSERT INTO upscale_jobs (key, title, chapter_dir, status, requested_at)
       VALUES (@key, @title, @chapterDir, 'pending', @now)
       ON CONFLICT(key) DO UPDATE SET
         status = 'pending', requested_at = @now, started_at = NULL, finished_at = NULL, error = NULL`
    )
    .run({ key, title, chapterDir, now: Date.now() })
}

function upsertDone(key: string, title: string, chapterDir: string) {
  getDb()
    .prepare(
      `INSERT INTO upscale_jobs (key, title, chapter_dir, status, requested_at, started_at, finished_at)
       VALUES (@key, @title, @chapterDir, 'done', @now, @now, @now)
       ON CONFLICT(key) DO UPDATE SET
         status = 'done', finished_at = @now, error = NULL`
    )
    .run({ key, title, chapterDir, now: Date.now() })
}

function markProcessing(key: string) {
  getDb()
    .prepare(`UPDATE upscale_jobs SET status = 'processing', started_at = @now WHERE key = @key`)
    .run({ key, now: Date.now() })
}

function markDone(key: string) {
  getDb()
    .prepare(`UPDATE upscale_jobs SET status = 'done', finished_at = @now, error = NULL WHERE key = @key`)
    .run({ key, now: Date.now() })
}

function markError(key: string, message: string) {
  getDb()
    .prepare(`UPDATE upscale_jobs SET status = 'error', finished_at = @now, error = @message WHERE key = @key`)
    .run({ key, now: Date.now(), message: message.slice(0, 2000) })
}

interface QueuedJob {
  key: string
  title: string
  chapterDir: string
}

// The upscaler is GPU-bound: at most one job runs at a time, and at most one
// more waits behind it. A newer request replaces whatever was waiting
// (rather than queueing up) — if you've already moved on to chapter 102,
// chapter 101 finishing later doesn't help, so 103 bumps 102 out instead of
// piling up behind it. The currently-running job is never interrupted.
let currentJob: QueuedJob | null = null
let waitingJob: QueuedJob | null = null

function enqueue(job: QueuedJob) {
  if (currentJob?.key === job.key) return

  if (currentJob === null) {
    startJob(job)
    return
  }

  if (waitingJob && waitingJob.key !== job.key) {
    discardWaitingJob(waitingJob)
  }
  waitingJob = job
}

function startJob(job: QueuedJob) {
  currentJob = job
  void runJob(job).then(() => {
    currentJob = null
    if (waitingJob) {
      const next = waitingJob
      waitingJob = null
      startJob(next)
    }
  })
}

// The waiting job never got a chance to run, so undo its pending row —
// otherwise a status check would keep reporting it as queued when it isn't.
function discardWaitingJob(job: QueuedJob) {
  getDb().prepare('DELETE FROM upscale_jobs WHERE key = ?').run(job.key)
}

async function runJob(job: QueuedJob): Promise<void> {
  markProcessing(job.key)
  const { destDir } = chapterPaths(job.title, job.chapterDir)
  await clearChapterSlices(destDir)

  const ok = await (UPSCALE_WORKER_URL ? runJobViaWorker(job) : runJobLocally(job))
  if (!ok) return

  // manga-up can exit 0 without having written its pages (e.g. the disk
  // refusing writes) — only call it done if the xl copy is really there.
  const { sourceCount, destCount } = await chapterImageCounts(job.title, job.chapterDir)
  if (sourceCount === 0 || destCount < sourceCount) {
    markError(job.key, `upscale finished but only ${destCount} of ${sourceCount} pages exist in ${destDir}`)
    return
  }

  // Slicing runs here, in the app, for both dispatch modes — it's CPU-only
  // and the xl dir is mounted here. A failure isn't fatal: the upscale
  // itself succeeded, and the xl list route serves whole pages for anything
  // unsliced (retrying the slicing in the background).
  try {
    await ensureChapterSlices(destDir)
  } catch (err) {
    console.error(`[upscale] slicing ${job.key} failed:`, err)
  }
  markDone(job.key)
}

// Resolves true once the xl pages are written; on failure the job is
// already marked as errored.
async function runJobViaWorker(job: QueuedJob): Promise<boolean> {
  try {
    const resp = await fetch(UPSCALE_WORKER_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(UPSCALE_WORKER_TOKEN ? { Authorization: `Bearer ${UPSCALE_WORKER_TOKEN}` } : {}),
      },
      body: JSON.stringify({ title: job.title, chapterDir: job.chapterDir }),
    })
    if (resp.ok) return true
    const data = (await resp.json().catch(() => null)) as { error?: string } | null
    markError(job.key, data?.error || `upscale worker responded ${resp.status}`)
  } catch (err) {
    markError(job.key, err instanceof Error ? err.message : String(err))
  }
  return false
}

function runJobLocally(job: QueuedJob): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(UPSCALE_BIN, [job.title, job.chapterDir], { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', (err) => {
      markError(job.key, err.message)
      resolve(false)
    })
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(true)
        return
      }
      markError(job.key, stderr.trim() || `manga-up exited with code ${code}`)
      resolve(false)
    })
  })
}

function chapterPaths(title: string, chapterDir: string) {
  return {
    sourceDir: path.join(MANGA_ROOT, title, chapterDir),
    destDir: path.join(XL_ROOT, title, chapterDir),
  }
}

async function chapterImageCounts(title: string, chapterDir: string) {
  const { sourceDir, destDir } = chapterPaths(title, chapterDir)
  const [sourceCount, destCount] = await Promise.all([countImages(sourceDir), countImages(destDir)])
  return { sourceCount, destCount }
}

async function isChapterUpscaled(title: string, chapterDir: string): Promise<boolean> {
  const { sourceCount, destCount } = await chapterImageCounts(title, chapterDir)
  return sourceCount > 0 && destCount >= sourceCount
}

// Whether this process actually has the job running or waiting. A
// pending/processing row without that is left over from a previous process
// (restart/crash) and would otherwise never run.
const isQueued = (key: string) => currentJob?.key === key || waitingJob?.key === key

async function listXlChapterDirs(title: string): Promise<string[]> {
  const titlePath = path.join(XL_ROOT, title)
  const names = await readdir(titlePath).catch(() => [] as string[])
  const dirs = await Promise.all(
    names.map(async (name) => {
      const info = await stat(path.join(titlePath, name)).catch(() => null)
      return info?.isDirectory() ? name : null
    })
  )
  return dirs.filter((name): name is string => name !== null)
}

// mtime rather than the DB's finished_at, so this still works for xl copies
// that predate a DB row (produced manually, or before this endpoint existed).
async function oldestXlChapterDir(title: string, excluding: string): Promise<string | null> {
  const dirs = (await listXlChapterDirs(title)).filter((dir) => dir !== excluding)
  if (dirs.length === 0) return null

  const withMtime = await Promise.all(
    dirs.map(async (dir) => {
      const info = await stat(path.join(XL_ROOT, title, dir)).catch(() => null)
      return { dir, mtimeMs: info?.mtimeMs ?? 0 }
    })
  )
  withMtime.sort((a, b) => a.mtimeMs - b.mtimeMs)
  return withMtime[0].dir
}

async function evictChapter(title: string, chapterDir: string): Promise<void> {
  await rm(path.join(XL_ROOT, title, chapterDir), { recursive: true, force: true })
  getDb().prepare('DELETE FROM upscale_jobs WHERE key = ?').run(jobKey(title, chapterDir))
}

// Keeps at most CHAPTER_BUFFER_PER_TITLE chapters of a title upscaled or
// in flight at once, evicting the least-recently-finished one(s) as needed
// to make room for the chapter about to be enqueued.
async function enforceTitleBuffer(title: string, incomingChapterDir: string): Promise<void> {
  const inProgress = getDb()
    .prepare(`SELECT COUNT(*) as count FROM upscale_jobs WHERE title = @title AND status IN ('pending', 'processing')`)
    .get({ title }) as { count: number }

  let total = (await listXlChapterDirs(title)).length + inProgress.count + 1
  while (total > CHAPTER_BUFFER_PER_TITLE) {
    const oldest = await oldestXlChapterDir(title, incomingChapterDir)
    if (!oldest) break
    await evictChapter(title, oldest)
    total--
  }
}

async function resolveChapter(
  title: string,
  chapter: string
): Promise<{ chapterDir: string } | { error: string }> {
  const titlePath = path.join(MANGA_ROOT, title)
  const chapterDir = await resolveChapterDir(titlePath, parseFloat(chapter))
  if (!chapterDir) return { error: 'Capítulo não encontrado' }
  return { chapterDir }
}

export interface UpscaleResult {
  status: UpscaleStatus
  alreadyUpscaled?: boolean
}

export async function requestChapterUpscale(
  title: string,
  chapter: string
): Promise<UpscaleResult | { error: string }> {
  const resolved = await resolveChapter(title, chapter)
  if ('error' in resolved) return resolved
  const { chapterDir } = resolved
  const key = jobKey(title, chapterDir)

  const existing = getJobRow(title, chapterDir)
  if ((existing?.status === 'processing' || existing?.status === 'pending') && isQueued(key)) {
    return { status: existing.status }
  }
  const { destDir } = chapterPaths(title, chapterDir)

  // The files, not the row, decide whether it's done: a "done" row may have
  // lost its xl copy (or never really got one), and the xl copy may exist
  // without a row (produced manually, or before this endpoint existed).
  // Either way, done chapters may predate slicing (or have had it fail) —
  // get their slices ready now, e.g. while the next chapter is prefetched.
  if (await isChapterUpscaled(title, chapterDir)) {
    const alreadyUpscaled = existing?.status !== 'done'
    if (alreadyUpscaled) upsertDone(key, title, chapterDir)
    void ensureChapterSlices(destDir).catch(() => {})
    return alreadyUpscaled ? { status: 'done', alreadyUpscaled } : { status: 'done' }
  }

  await enforceTitleBuffer(title, chapterDir)

  upsertPending(key, title, chapterDir)
  enqueue({ key, title, chapterDir })
  return { status: 'pending' }
}

export async function getChapterUpscaleStatus(
  title: string,
  chapter: string
): Promise<{ status: UpscaleStatus | null } | { error: string }> {
  const resolved = await resolveChapter(title, chapter)
  if ('error' in resolved) return resolved
  const { chapterDir } = resolved

  const key = jobKey(title, chapterDir)
  const existing = getJobRow(title, chapterDir)
  if (existing?.status === 'error') return { status: 'error' }
  if ((existing?.status === 'processing' || existing?.status === 'pending') && isQueued(key)) {
    return { status: existing.status }
  }

  // Same as requestChapterUpscale: a stale row (done without its files, or
  // queued in a previous process) reports as not requested, so the next
  // POST runs it again.
  if (await isChapterUpscaled(title, chapterDir)) {
    if (existing?.status !== 'done') upsertDone(key, title, chapterDir)
    return { status: 'done' }
  }

  return { status: null }
}
