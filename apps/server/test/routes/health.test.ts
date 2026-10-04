import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { makeLibrary, DEFAULT_SPEC, type LibraryResult } from '../fixtures/makeLibrary'

/* eslint-disable @typescript-eslint/no-explicit-any */
let lib: LibraryResult

beforeAll(async () => {
  lib = await makeLibrary(await DEFAULT_SPEC)
  process.env.MANGA_ROOT = lib.root
})

afterAll(async () => {
  await lib.cleanup()
})

afterEach(() => {
  // Reset module cache after each test to clear the serverId cache
  vi.resetModules()
})

describe('health endpoint', () => {
  it('returns status 200 with valid response', async () => {
    const route = await import('@/app/api/health/route')
    const res = await route.GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(typeof body.version).toBe('string')
    expect(Array.isArray(body.features)).toBe(true)
  })

  it('includes serverId and it persists across calls', async () => {
    // Use a fresh temp dir for this test
    const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'health-test-'))
    const originalMangaRoot = process.env.MANGA_ROOT
    const serverIdPath = path.join(testDir, '.server-id')
    process.env.MANGA_ROOT = testDir
    process.env.SERVER_ID_PATH = serverIdPath

    try {
      const route = await import('@/app/api/health/route')

      // First call
      const res1 = await route.GET()
      const body1 = await res1.json()
      expect(body1.serverId).toBeDefined()
      expect(typeof body1.serverId).toBe('string')
      expect(body1.serverId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)

      // Second call should return same serverId
      const res2 = await route.GET()
      const body2 = await res2.json()
      expect(body2.serverId).toBe(body1.serverId)

      // File should exist on disk
      const fileContent = await fs.readFile(serverIdPath, 'utf-8')
      expect(fileContent.trim()).toBe(body1.serverId)
    } finally {
      // Cleanup
      await fs.chmod(testDir, 0o755)
      await fs.rm(testDir, { recursive: true, force: true })
      process.env.MANGA_ROOT = originalMangaRoot
      delete process.env.SERVER_ID_PATH
    }
  })

  it('uses pre-existing server id file', async () => {
    const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'health-test-'))
    const originalMangaRoot = process.env.MANGA_ROOT
    const serverIdPath = path.join(testDir, '.server-id')
    process.env.MANGA_ROOT = testDir
    process.env.SERVER_ID_PATH = serverIdPath

    try {
      const existingId = '550e8400-e29b-41d4-a716-446655440000'
      await fs.writeFile(serverIdPath, existingId, 'utf-8')

      const route = await import('@/app/api/health/route')
      const res = await route.GET()
      const body = await res.json()
      expect(body.serverId).toBe(existingId)
    } finally {
      // Cleanup
      await fs.chmod(testDir, 0o755)
      await fs.rm(testDir, { recursive: true, force: true })
      process.env.MANGA_ROOT = originalMangaRoot
      delete process.env.SERVER_ID_PATH
    }
  })

  it('returns 200 without serverId in read-only directory', async () => {
    const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'health-test-'))
    const originalMangaRoot = process.env.MANGA_ROOT
    const serverIdPath = path.join(testDir, '.server-id')
    process.env.MANGA_ROOT = testDir
    process.env.SERVER_ID_PATH = serverIdPath

    // Make directory read-only
    await fs.chmod(testDir, 0o555)

    try {
      const route = await import('@/app/api/health/route')
      const res = await route.GET()
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.serverId).toBeUndefined()
      expect(typeof body.version).toBe('string')
      expect(Array.isArray(body.features)).toBe(true)
    } finally {
      // Cleanup - make writable first
      await fs.chmod(testDir, 0o755)
      await fs.rm(testDir, { recursive: true, force: true })
      process.env.MANGA_ROOT = originalMangaRoot
      delete process.env.SERVER_ID_PATH
    }
  })

  it('includes version 1.3.0', async () => {
    const route = await import('@/app/api/health/route')
    const res = await route.GET()
    const body = await res.json()
    expect(body.version).toBe('1.3.0')
  })

  it('advertises the catalog feature', async () => {
    const route = await import('@/app/api/health/route')
    const res = await route.GET()
    const body = await res.json()
    expect(Array.isArray(body.features)).toBe(true)
    expect(body.features).toEqual(['catalog'])
  })

  it('includes Cache-Control: no-store header', async () => {
    const route = await import('@/app/api/health/route')
    const res = await route.GET()
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })
})
