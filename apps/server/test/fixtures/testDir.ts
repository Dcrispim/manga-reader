import fs from 'fs/promises'
import path from 'path'
import os from 'os'

/**
 * Get the base directory for test files.
 * Uses MANGA_TEST_DIR environment variable if set, otherwise falls back to os.tmpdir().
 * Ensures the directory exists before returning.
 */
export async function testBaseDir(): Promise<string> {
  const baseDir = process.env.MANGA_TEST_DIR || os.tmpdir()
  await fs.mkdir(baseDir, { recursive: true })
  return baseDir
}

/**
 * Create a temporary directory for a test under the test base directory.
 * Returns the path and should be cleaned up manually by the caller.
 */
export async function makeTestDir(prefix: string): Promise<string> {
  const baseDir = await testBaseDir()
  return fs.mkdtemp(path.join(baseDir, prefix))
}
