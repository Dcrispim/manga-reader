import { randomUUID } from 'crypto'
import { writeFile, readFile } from 'fs/promises'
import { SERVER_ID_PATH } from '@/utils/paths.server'

let cachedServerId: string | undefined = undefined

/**
 * Get or generate a persistent server ID.
 *
 * Reads from SERVER_ID_PATH if it exists. If not, generates a new UUID
 * and attempts to write it with 'wx' flag (fail if exists, to avoid race conditions).
 * If the write fails (e.g., read-only filesystem), returns undefined.
 * On first successful read, caches the result in memory for subsequent calls.
 */
export async function getServerId(): Promise<string | undefined> {
  // Return cached value if available
  if (cachedServerId !== undefined) {
    return cachedServerId
  }

  try {
    // Try to read existing file
    const existing = await readFile(SERVER_ID_PATH, 'utf-8')
    cachedServerId = existing.trim()
    return cachedServerId
  } catch {
    // File doesn't exist, try to create it
  }

  // Generate new UUID
  const newId = randomUUID()

  try {
    // Write with 'wx' flag: fail if file already exists (atomic against race conditions)
    await writeFile(SERVER_ID_PATH, newId, { flag: 'wx' })
    cachedServerId = newId
    return cachedServerId
  } catch {
    // Write failed (likely read-only filesystem or race condition).
    // Try to read in case another process won the race
    try {
      const existing = await readFile(SERVER_ID_PATH, 'utf-8')
      cachedServerId = existing.trim()
      return cachedServerId
    } catch {
      // Still can't read, return undefined (graceful degradation for read-only mounts)
      return undefined
    }
  }
}
