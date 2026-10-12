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

import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'

const PORT = Number(process.env.UPSCALE_WORKER_PORT || 4993)
const TOKEN = process.env.UPSCALE_WORKER_TOKEN
const MANGA_UP_BIN = process.env.MANGA_UP_BIN || path.join(os.homedir(), 'cmd', 'manga-up')
const MANGA_STATS_BIN = process.env.MANGA_STATS_BIN || path.join(os.homedir(), 'cmd', 'manga-stats')

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

const server = createServer((req, res) => {
  if (req.method !== 'POST' || (req.url !== '/upscale' && req.url !== '/stats')) {
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
  console.log(`[upscale-worker] listening on 0.0.0.0:${PORT}, MANGA_UP_BIN=${MANGA_UP_BIN}, MANGA_STATS_BIN=${MANGA_STATS_BIN}`)
})
