#!/usr/bin/env node
// Host-side upscale worker.
//
// The app usually runs inside a Docker container, which has no GPU/Vulkan
// access and can't run manga-up itself (see ~/cmd/manga-up — it shells out
// to realesrgan-ncnn-vulkan against the host's NVIDIA GPU). This tiny HTTP
// service runs directly on the host instead, where manga-up already works,
// and the container calls it over the Docker bridge (host.docker.internal)
// instead of spawning manga-up locally.
//
// It also serves POST /stats ({ title }), running ~/cmd/manga-stats for the
// title's status tab — that one needs manga-downloader's venv, which isn't in
// the container either.
//
// Usage: node scripts/upscale-worker.mjs
// Env:
//   UPSCALE_WORKER_PORT   default 4993
//   UPSCALE_WORKER_TOKEN  shared secret; required. Requests must send
//                         "Authorization: Bearer <token>".
//   MANGA_UP_BIN          default ~/cmd/manga-up
//   MANGA_STATS_BIN       default ~/cmd/manga-stats
//   MANGA_DOWNLOAD_BIN    default ~/cmd/manga-download

import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'

const PORT = Number(process.env.UPSCALE_WORKER_PORT || 4993)
const TOKEN = process.env.UPSCALE_WORKER_TOKEN
const MANGA_UP_BIN = process.env.MANGA_UP_BIN || path.join(os.homedir(), 'cmd', 'manga-up')
const MANGA_STATS_BIN = process.env.MANGA_STATS_BIN || path.join(os.homedir(), 'cmd', 'manga-stats')
const MANGA_DOWNLOAD_BIN = process.env.MANGA_DOWNLOAD_BIN || path.join(os.homedir(), 'cmd', 'manga-download')

if (!TOKEN) {
  console.error('UPSCALE_WORKER_TOKEN must be set — refusing to start an unauthenticated worker.')
  process.exit(1)
}

// Bare directory-name components only (no separators, no ".."), so the
// $MANGA_ROOT/$title/$chapter path manga-up builds can't escape MANGA_ROOT.
const SAFE_SEGMENT = /^[^/\\]+$/

function isSafeSegment(value) {
  return typeof value === 'string' && value.length > 0 && value !== '.' && value !== '..' && SAFE_SEGMENT.test(value)
}

function runUpscale(title, chapterDir) {
  return new Promise((resolve) => {
    const child = spawn(MANGA_UP_BIN, [title, chapterDir], { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', (err) => resolve({ ok: false, error: err.message }))
    child.on('exit', (code) => {
      if (code === 0) resolve({ ok: true })
      else resolve({ ok: false, error: stderr.trim() || `manga-up exited with code ${code}` })
    })
  })
}

// stdin closed so an ambiguous-name prompt in stats_chart.py exits on EOF
// instead of hanging; its output goes back as the error on failure.
function runStats(title) {
  return new Promise((resolve) => {
    const child = spawn(MANGA_STATS_BIN, [title], { stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', (chunk) => {
      output += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      output += chunk.toString()
    })
    child.on('error', (err) => resolve({ ok: false, error: err.message }))
    child.on('exit', (code) => {
      if (code === 0) resolve({ ok: true })
      else resolve({ ok: false, error: output.trim().slice(-500) || `manga-stats exited with code ${code}` })
    })
  })
}

// Same shape the app builds (titleDownload.ts downloadArgs): the template URL,
// an optional start/end pair, then --gaps/--update. Checked again here since
// these become argv of a script on the host.
const CHAPTER = /^\d+(\.\d+)?$/
function isDownloadArgs(args) {
  if (!Array.isArray(args) || !args.every((a) => typeof a === 'string')) return false
  const [template, ...rest] = args
  if (!/^https?:\/\/\S+$/.test(template ?? '') || !template.includes('{chapter}')) return false
  const flags = rest.filter((a) => a.startsWith('--'))
  const range = rest.filter((a) => !a.startsWith('--'))
  return (
    flags.every((f) => f === '--gaps' || f === '--update') &&
    (range.length === 0 || (range.length === 2 && range.every((c) => CHAPTER.test(c)))) &&
    rest.join(' ') === [...range, ...flags].join(' ')
  )
}

const downloading = new Set()

// Downloads run for a long time, so this resolves once the process started.
function startDownload(title, args) {
  return new Promise((resolve) => {
    const child = spawn(MANGA_DOWNLOAD_BIN, [title, ...args], { stdio: ['ignore', 'inherit', 'inherit'] })
    child.on('error', (err) => {
      downloading.delete(title)
      resolve({ ok: false, error: err.message })
    })
    child.on('spawn', () => {
      downloading.add(title)
      resolve({ ok: true })
    })
    child.on('exit', (code) => {
      downloading.delete(title)
      console.log(`[upscale-worker] download ${title} exited with code ${code}`)
    })
  })
}

const ROUTES = ['/upscale', '/stats', '/download']

const server = createServer((req, res) => {
  if (req.method !== 'POST' || !ROUTES.includes(req.url)) {
    res.writeHead(404).end()
    return
  }

  if (req.headers.authorization !== `Bearer ${TOKEN}`) {
    res.writeHead(401).end()
    return
  }

  let body = ''
  req.on('data', (chunk) => {
    body += chunk
  })
  req.on('end', async () => {
    let payload
    try {
      payload = JSON.parse(body)
    } catch {
      res.writeHead(400).end('invalid JSON')
      return
    }

    if (req.url === '/stats') {
      const { title } = payload
      if (!isSafeSegment(title)) {
        res.writeHead(400).end('invalid title')
        return
      }
      console.log(`[upscale-worker] stats ${title}`)
      const result = await runStats(title)
      res.writeHead(result.ok ? 200 : 500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(result))
      return
    }

    if (req.url === '/download') {
      const { title, args } = payload
      if (!isSafeSegment(title) || !isDownloadArgs(args)) {
        res.writeHead(400).end('invalid title/args')
        return
      }
      if (downloading.has(title)) {
        res.writeHead(409, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: 'Já há um download em andamento para este título' }))
        return
      }
      console.log(`[upscale-worker] download ${title} ${args.join(' ')}`)
      const result = await startDownload(title, args)
      res.writeHead(result.ok ? 202 : 500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(result))
      return
    }

    const { title, chapterDir } = payload
    if (!isSafeSegment(title) || !isSafeSegment(chapterDir)) {
      res.writeHead(400).end('invalid title/chapterDir')
      return
    }

    console.log(`[upscale-worker] ${title}/${chapterDir}`)
    const result = await runUpscale(title, chapterDir)
    res.writeHead(result.ok ? 200 : 500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result))
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[upscale-worker] listening on 0.0.0.0:${PORT}, MANGA_UP_BIN=${MANGA_UP_BIN}, MANGA_STATS_BIN=${MANGA_STATS_BIN}, MANGA_DOWNLOAD_BIN=${MANGA_DOWNLOAD_BIN}`)
})
