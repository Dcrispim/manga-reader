// Plain utility module (not a component) — no "use client" here. localStorage-
// touching functions (saveToHistory, getHistory, ...) are only ever called
// from client code, but getLatestChapter is pure and is also called from
// bind.ts's mergeBindData, which runs server-side in the /api/bind route.
// Marking this file "use client" turns every export into an opaque client
// reference that throws when invoked from that server context.

import { recordChapterOpen, type TitleHistory } from '@manga/core'

const HISTORY_KEY = 'chapterHistory'
const CHAPTERS_KEY = 'chapters'

export { getLatestChapter, normalizeEntry, type TitleHistory } from '@manga/core'

export function saveToHistory(title: string, chapter: string) {
  setHistory(recordChapterOpen(getHistory(), title, chapter, Date.now()))
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
