const MAX_PER_TITLE_KEY = 'offline.maxPerTitle'
const MAX_GLOBAL_KEY = 'offline.maxGlobal'
const AUTO_DOWNLOAD_NEXT_KEY = 'config.autoDownloadNext'
const DOWNLOAD_HIGH_RES_KEY = 'offline.downloadHighRes'

export const DEFAULT_MAX_PER_TITLE = 5
export const DEFAULT_MAX_GLOBAL = 100

function readNumber(key: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback
  const raw = localStorage.getItem(key)
  const value = raw ? parseInt(raw, 10) : NaN
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export function getMaxPerTitle(): number {
  return readNumber(MAX_PER_TITLE_KEY, DEFAULT_MAX_PER_TITLE)
}

export function setMaxPerTitle(value: number) {
  localStorage.setItem(MAX_PER_TITLE_KEY, String(Math.max(1, Math.floor(value))))
}

export function getMaxGlobal(): number {
  return readNumber(MAX_GLOBAL_KEY, DEFAULT_MAX_GLOBAL)
}

export function setMaxGlobal(value: number) {
  localStorage.setItem(MAX_GLOBAL_KEY, String(Math.max(1, Math.floor(value))))
}

// How many chapters after the open one get saved for offline reading
// (0 = off). Same setting and default as the app ('downloads.ahead').
const DOWNLOAD_AHEAD_KEY = 'offline.downloadAhead'
export const DEFAULT_DOWNLOAD_AHEAD = 1
export const MAX_DOWNLOAD_AHEAD = 10

export function getDownloadAhead(): number {
  if (typeof window === 'undefined') return 0
  const raw = localStorage.getItem(DOWNLOAD_AHEAD_KEY)
  if (raw === null) {
    // Before this setting there was an on/off switch; an explicit "off" stays off.
    return localStorage.getItem(AUTO_DOWNLOAD_NEXT_KEY) === 'false' ? 0 : DEFAULT_DOWNLOAD_AHEAD
  }
  const value = parseInt(raw, 10)
  return Number.isFinite(value) ? Math.min(MAX_DOWNLOAD_AHEAD, Math.max(0, value)) : DEFAULT_DOWNLOAD_AHEAD
}

export function setDownloadAhead(value: number) {
  const n = Math.min(MAX_DOWNLOAD_AHEAD, Math.max(0, Math.floor(value) || 0))
  localStorage.setItem(DOWNLOAD_AHEAD_KEY, String(n))
}

export function getDownloadHighRes(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(DOWNLOAD_HIGH_RES_KEY) === 'true'
}

export function setDownloadHighRes(value: boolean) {
  localStorage.setItem(DOWNLOAD_HIGH_RES_KEY, value ? 'true' : 'false')
}
