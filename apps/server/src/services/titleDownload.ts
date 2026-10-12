import { spawn } from 'child_process'

// manga-download runs download_range.py from manga-downloader (links via a
// browser container, then the images) and re-runs manga-stats at the end.
// See ~/cmd/manga-download.
const DOWNLOAD_BIN = process.env.MANGA_DOWNLOAD_BIN || '/home/dcrispim/cmd/manga-download'

// Needs the downloader's venv and Docker, neither in the container: when set,
// the run goes to scripts/upscale-worker.mjs on the host, like manga-stats.
const DOWNLOAD_WORKER_URL = process.env.DOWNLOAD_WORKER_URL
const WORKER_TOKEN = process.env.UPSCALE_WORKER_TOKEN

export type DownloadRequest = { template: string; start?: string; end?: string; gaps: boolean; update?: boolean }
export type StartResult = { ok: true } | { ok: false; status: number; error: string }

const CHAPTER = /^\d+(\.\d+)?$/

// argv for manga-download after the title. The template must look like a URL
// (so it can't be taken for an option); start/end go together.
export function downloadArgs(body: unknown): string[] | string {
  const { template, start, end, gaps, update } = (body ?? {}) as Partial<Record<keyof DownloadRequest, unknown>>
  if (typeof template !== 'string' || !/^https?:\/\/\S+$/.test(template) || !template.includes('{chapter}')) {
    return 'template inválido: precisa ser uma URL http(s) com {chapter}'
  }
  const hasRange = start !== undefined || end !== undefined
  if (hasRange) {
    if (typeof start !== 'string' || typeof end !== 'string' || !CHAPTER.test(start) || !CHAPTER.test(end)) {
      return 'início e fim devem ser capítulos (N ou N.k), juntos'
    }
    if (parseFloat(start) > parseFloat(end)) return 'início maior que o fim'
  }
  if (!hasRange && gaps !== true) return 'nada a baixar: informe início e fim ou gaps'
  return [
    template,
    ...(hasRange ? [start as string, end as string] : []),
    ...(gaps === true ? ['--gaps'] : []),
    ...(update === true ? ['--update'] : []),
  ]
}

// Downloads take minutes to hours, so this only starts the run; one per title.
const running = new Set<string>()

export async function startTitleDownload(title: string, args: string[]): Promise<StartResult> {
  if (DOWNLOAD_WORKER_URL) return startViaWorker(title, args)
  if (running.has(title)) return { ok: false, status: 409, error: 'Já há um download em andamento para este título' }
  return new Promise((resolve) => {
    const child = spawn(DOWNLOAD_BIN, [title, ...args], { stdio: ['ignore', 'inherit', 'inherit'] })
    child.on('error', (err) => {
      running.delete(title)
      resolve({ ok: false, status: 500, error: err.message })
    })
    child.on('spawn', () => {
      running.add(title)
      resolve({ ok: true })
    })
    child.on('exit', () => running.delete(title))
  })
}

async function startViaWorker(title: string, args: string[]): Promise<StartResult> {
  try {
    const resp = await fetch(DOWNLOAD_WORKER_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(WORKER_TOKEN ? { Authorization: `Bearer ${WORKER_TOKEN}` } : {}),
      },
      body: JSON.stringify({ title, args }),
    })
    if (resp.ok) return { ok: true }
    const data = (await resp.json().catch(() => null)) as { error?: string } | null
    return { ok: false, status: resp.status === 409 ? 409 : 500, error: data?.error || `download worker responded ${resp.status}` }
  } catch (err) {
    return { ok: false, status: 500, error: err instanceof Error ? err.message : String(err) }
  }
}
