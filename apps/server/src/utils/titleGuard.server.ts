import { stat } from 'fs/promises'
import path from 'path'
import { MANGA_ROOT } from '@/utils/paths.server'

/**
 * A title name that can safely become a file name under .meta / .thumb: a
 * plain folder name (no separators, no "..", not hidden) of an existing title.
 */
export async function isExistingTitle(title: string): Promise<boolean> {
  if (!title || title.startsWith('.') || /[\\/]/.test(title) || title.includes('..')) return false
  try {
    return (await stat(path.join(MANGA_ROOT, title))).isDirectory()
  } catch {
    return false
  }
}
