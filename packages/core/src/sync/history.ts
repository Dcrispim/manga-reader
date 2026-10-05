// Pure reading-history logic shared by the server and the mobile app. No I/O
// here (core lint forbids it); persistence lives in each app.

// openedAt is additive: once a chapter's open timestamp is recorded it is
// never rewritten. This keeps "last read" anchored to when a chapter was
// genuinely first opened, so a stale tab reloading an old chapter (e.g. a
// backgrounded mobile tab being restored) can't masquerade as fresher
// progress than a chapter actually read later on another device.
// A chapter only counts as read (history, "continue from", bind) after it
// stayed open this long. Shared by the web reader and the app, so a quick
// peek or a mis-tap does not move anyone's progress.
export const HISTORY_MIN_OPEN_MS = 15_000

export type TitleHistory = { lastRead: number | null, history: string[], openedAt: Record<string, number> }

export function normalizeEntry(entry?: Partial<TitleHistory>): TitleHistory {
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

// Pure version of the app's "chapter opened" bookkeeping: returns a new
// history map and never mutates the input, so callers decide how to persist.
export function recordChapterOpen(
  history: Record<string, TitleHistory>,
  title: string,
  chapter: string,
  now: number
): Record<string, TitleHistory> {
  const prev = normalizeEntry(history[title])
  const entry: TitleHistory = {
    lastRead: prev.lastRead,
    history: [...prev.history],
    openedAt: { ...prev.openedAt },
  }

  // Only stamp a chapter the first time it's opened; revisiting it later
  // (intentionally or via a stale page reload) must not bump its timestamp.
  if (!(chapter in entry.openedAt)) {
    entry.openedAt[chapter] = now
  }

  if (!entry.history.includes(chapter)) {
    entry.history.push(chapter)
    if (entry.history.length > 5) {
      entry.history.shift() // Keep only the last five chapters per title
    }
  }

  const timestamps = Object.values(entry.openedAt)
  entry.lastRead = timestamps.length ? Math.max(...timestamps) : now

  return { ...history, [title]: entry }
}
