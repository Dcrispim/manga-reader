// Plain utility module (not a component) — no "use client" here. localStorage-
// touching functions (saveToHistory, getHistory, ...) are only ever called
// from client code, but getLatestChapter is pure and is also called from
// bind.ts's mergeBindData, which runs server-side in the /api/bind route.
// Marking this file "use client" turns every export into an opaque client
// reference that throws when invoked from that server context.

const HISTORY_KEY = 'chapterHistory'
const CHAPTERS_KEY = 'chapters'

// openedAt is additive: once a chapter's open timestamp is recorded it is
// never rewritten. This keeps "last read" anchored to when a chapter was
// genuinely first opened, so a stale tab reloading an old chapter (e.g. a
// backgrounded mobile tab being restored) can't masquerade as fresher
// progress than a chapter actually read later on another device.
export type TitleHistory = { lastRead: number | null, history: string[], openedAt: Record<string, number> }

function normalizeEntry(entry?: Partial<TitleHistory>): TitleHistory {
  return {
    lastRead: entry?.lastRead ?? null,
    history: entry?.history ?? [],
    openedAt: entry?.openedAt ?? {},
  }
}

// Returns the chapter with the most recent openedAt timestamp for a title,
// or null if there's no timestamp data (e.g. legacy/migrated entries).
export function getLatestChapter(entry?: Partial<TitleHistory>): string | null {
  const openedAt = entry?.openedAt
  if (!openedAt) return null

  let latestChapter: string | null = null
  let latestTime = -Infinity
  for (const [chapter, time] of Object.entries(openedAt)) {
    if (time > latestTime) {
      latestTime = time
      latestChapter = chapter
    }
  }
  return latestChapter
}

export function saveToHistory(title: string, chapter: string) {
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}')
  const entry = normalizeEntry(history[title])

  // Only stamp a chapter the first time it's opened; revisiting it later
  // (intentionally or via a stale page reload) must not bump its timestamp.
  if (!(chapter in entry.openedAt)) {
    entry.openedAt[chapter] = Date.now()
  }

  if (!entry.history.includes(chapter)) {
    entry.history.push(chapter)
    if (entry.history.length > 5) {
      entry.history.shift() // Keep only the last five chapters per title
    }
  }

  const timestamps = Object.values(entry.openedAt)
  entry.lastRead = timestamps.length ? Math.max(...timestamps) : Date.now()

  history[title] = entry
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

export function getHistory(): Record<string, TitleHistory> {
  return JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}')
}

export function setHistory(history: Record<string, TitleHistory>) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

export function getChapters(): Record<string, string> {
  return JSON.parse(localStorage.getItem(CHAPTERS_KEY) || '{}')
}

export function setChapters(chapters: Record<string, string>) {
  localStorage.setItem(CHAPTERS_KEY, JSON.stringify(chapters))
}
