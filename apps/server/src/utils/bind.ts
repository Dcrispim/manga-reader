import { getLatestChapter, type TitleHistory } from '@/utils/history'

export const BIND_CODE_KEY = 'bindCode'
export const BIND_LAST_SYNC_KEY = 'bindLastSync'

export interface BindPayload {
  history: Record<string, TitleHistory>
  chapters: Record<string, string>
}

export interface BindData extends BindPayload {
  code: string
  createdAt: number
  updatedAt: number
}

export function getLastSync(): number {
  return Number(localStorage.getItem(BIND_LAST_SYNC_KEY) || 0)
}

export function setLastSync(timestamp: number) {
  localStorage.setItem(BIND_LAST_SYNC_KEY, String(timestamp))
}

// Builds a payload containing only what changed since the last sync, so a
// device never re-broadcasts (and risks re-dating) chapters it already
// reported before. The current `chapters` pointer is always included since
// it's tiny and the server re-derives the real "continue from" chapter from
// openedAt anyway.
export function buildDeltaPayload(full: BindPayload, since: number): BindPayload {
  const history: Record<string, TitleHistory> = {}

  for (const [title, entry] of Object.entries(full.history)) {
    const openedAt = Object.fromEntries(
      Object.entries(entry.openedAt || {}).filter(([, time]) => time > since)
    )
    if (Object.keys(openedAt).length === 0) continue

    history[title] = {
      lastRead: entry.lastRead,
      history: entry.history,
      openedAt,
    }
  }

  return { history, chapters: full.chapters }
}

// Merges two reading-progress snapshots. Per-chapter open timestamps are
// unioned (additive) rather than replaced, and both "last read" and the
// "continue from" chapter are re-derived from that merged timestamp map —
// never trusted from whichever side merely reported most recently.
export function mergeBindData(local: BindPayload, remote: BindPayload): BindPayload {
  const titles = new Set([...Object.keys(local.history), ...Object.keys(remote.history)])
  const history: Record<string, TitleHistory> = {}
  const chapters: Record<string, string> = { ...local.chapters }

  for (const title of titles) {
    const l = local.history[title]
    const r = remote.history[title]

    const openedAt: Record<string, number> = { ...(l?.openedAt || {}) }
    for (const [chapter, time] of Object.entries(r?.openedAt || {})) {
      openedAt[chapter] = Math.max(openedAt[chapter] ?? 0, time)
    }

    const mergedChapterList = Array.from(new Set([...(l?.history || []), ...(r?.history || [])]))
    // Order chronologically by open date (when known) before capping, so the
    // kept entries are the genuinely most-recent ones, not just the last
    // ones concatenated.
    mergedChapterList.sort((a, b) => (openedAt[a] ?? 0) - (openedAt[b] ?? 0))

    const timestamps = Object.values(openedAt)
    const lastRead = timestamps.length
      ? Math.max(...timestamps)
      : Math.max(l?.lastRead ?? 0, r?.lastRead ?? 0) || null

    history[title] = {
      lastRead,
      history: mergedChapterList.slice(-5),
      openedAt,
    }

    const latestChapter = getLatestChapter({ openedAt })
    if (latestChapter) {
      chapters[title] = latestChapter
    } else if ((r?.lastRead ?? 0) > (l?.lastRead ?? 0) && remote.chapters[title]) {
      // Legacy fallback for entries without per-chapter timestamps.
      chapters[title] = remote.chapters[title]
    }
  }

  return { history, chapters }
}
