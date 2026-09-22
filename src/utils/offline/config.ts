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

export function getAutoDownloadNext(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(AUTO_DOWNLOAD_NEXT_KEY) === 'true'
}

export function setAutoDownloadNext(value: boolean) {
  localStorage.setItem(AUTO_DOWNLOAD_NEXT_KEY, value ? 'true' : 'false')
}

export function getDownloadHighRes(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(DOWNLOAD_HIGH_RES_KEY) === 'true'
}

export function setDownloadHighRes(value: boolean) {
  localStorage.setItem(DOWNLOAD_HIGH_RES_KEY, value ? 'true' : 'false')
}
