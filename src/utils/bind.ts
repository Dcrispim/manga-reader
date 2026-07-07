import type { TitleHistory } from '@/utils/history'

export const BIND_CODE_KEY = 'bindCode'

export interface BindPayload {
  history: Record<string, TitleHistory>
  chapters: Record<string, string>
}

export interface BindData extends BindPayload {
  code: string
  createdAt: number
  updatedAt: number
}

// Merges two reading-progress snapshots, keeping the most recently read
// chapter per title and the union of the last-visited chapters.
export function mergeBindData(local: BindPayload, remote: BindPayload): BindPayload {
  const titles = new Set([...Object.keys(local.history), ...Object.keys(remote.history)])
  const history: Record<string, TitleHistory> = {}
  const chapters: Record<string, string> = { ...local.chapters }

  for (const title of titles) {
    const l = local.history[title]
    const r = remote.history[title]

    if (l && r) {
      history[title] = {
        lastRead: Math.max(l.lastRead ?? 0, r.lastRead ?? 0),
        history: Array.from(new Set([...l.history, ...r.history])).slice(-5),
      }
      if ((r.lastRead ?? 0) > (l.lastRead ?? 0) && remote.chapters[title]) {
        chapters[title] = remote.chapters[title]
      }
    } else if (r) {
      history[title] = r
      if (remote.chapters[title]) chapters[title] = remote.chapters[title]
    } else if (l) {
      history[title] = l
    }
  }

  return { history, chapters }
}
