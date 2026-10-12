import { readFile } from 'fs/promises'
import { spawn } from 'child_process'
import path from 'path'
import { MANGA_ROOT } from '@/utils/paths.server'

// manga-stats runs stats_chart.py from manga-downloader, which writes
// <MANGA_ROOT>/<title>/<title>_stats.json (+ an HTML report). See ~/cmd/manga-stats.
const STATS_BIN = process.env.MANGA_STATS_BIN || '/home/dcrispim/cmd/manga-stats'

// Same story as upscale: the container doesn't have the downloader's venv,
// so when set, runs are dispatched to scripts/upscale-worker.mjs on the host.
const STATS_WORKER_URL = process.env.STATS_WORKER_URL
const WORKER_TOKEN = process.env.UPSCALE_WORKER_TOKEN

export type RefreshResult = { ok: true } | { ok: false; error: string }

export function statsPath(title: string): string {
  return path.join(MANGA_ROOT, title, `${title}_stats.json`)
}

export async function readTitleStats(title: string): Promise<unknown | null> {
  const raw = await readFile(statsPath(title), 'utf-8').catch(() => null)
  if (raw === null) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// One run per title at a time; a second click joins the run in flight.
const running = new Map<string, Promise<RefreshResult>>()

export function refreshTitleStats(title: string): Promise<RefreshResult> {
  const inFlight = running.get(title)
  if (inFlight) return inFlight
  const run = (STATS_WORKER_URL ? runViaWorker(title) : runLocally(title)).finally(() => running.delete(title))
  running.set(title, run)
  return run
}

async function runViaWorker(title: string): Promise<RefreshResult> {
  try {
    const resp = await fetch(STATS_WORKER_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(WORKER_TOKEN ? { Authorization: `Bearer ${WORKER_TOKEN}` } : {}),
      },
      body: JSON.stringify({ title }),
    })
    if (resp.ok) return { ok: true }
    const data = (await resp.json().catch(() => null)) as { error?: string } | null
    return { ok: false, error: data?.error || `stats worker responded ${resp.status}` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

function runLocally(title: string): Promise<RefreshResult> {
  return new Promise((resolve) => {
    // stdin closed: if the name were ambiguous, stats_chart.py's prompt hits
    // EOF and exits instead of hanging (the title is validated beforehand anyway).
    const child = spawn(STATS_BIN, [title], { stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout?.on('data', (chunk) => (output += chunk.toString()))
    child.stderr?.on('data', (chunk) => (output += chunk.toString()))
    child.on('error', (err) => resolve({ ok: false, error: err.message }))
    child.on('exit', (code) => {
      if (code === 0) resolve({ ok: true })
      else resolve({ ok: false, error: output.trim().slice(-500) || `manga-stats exited with code ${code}` })
    })
  })
}
