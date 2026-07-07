"use client"


const HISTORY_KEY = 'chapterHistory'
const CHAPTERS_KEY = 'chapters'
export type TitleHistory =  { lastRead: number | null, history: string[] }

export function saveToHistory(title: string, chapter: string) {
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}')
  const entry = (history[title] || { lastRead: null, history: [] }) as { lastRead: number | null, history: string[] }
  const lastFive = entry.history

  // Check if the chapter already exists for the title
  if (!lastFive.includes(chapter)) {
    lastFive.push(chapter)
    if (lastFive.length > 5) {
      lastFive.shift() // Keep only the last five chapters per title
    }
  }
  history[title] = { lastRead: Date.now(), history: lastFive }
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
