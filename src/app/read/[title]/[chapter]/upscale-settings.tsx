'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'config.upscaleNextChapter'

function requestUpscale(title: string, chapter: string) {
  fetch(`/api/read/${title}/${chapter}/upscale`, { method: 'POST' }).catch(() => {})
}

type UpscaleSettingsContextValue = {
  upscaleNextChapter: boolean
  setUpscaleNextChapter: (value: boolean) => void
}

const UpscaleSettingsContext = createContext<UpscaleSettingsContextValue | null>(null)

export function useUpscaleSettings() {
  const context = useContext(UpscaleSettingsContext)
  if (!context) {
    throw new Error('useUpscaleSettings must be used within an UpscaleSettingsProvider')
  }
  return context
}

export default function UpscaleSettingsProvider({
  title,
  chapter,
  nextChapter,
  isOriginal,
  children,
}: {
  title: string
  chapter: string
  nextChapter: string | null
  isOriginal: boolean
  children: ReactNode
}) {
  // localStorage isn't available during SSR, so the first client render
  // starts disabled (avoids a hydration mismatch) and the persisted value is
  // loaded right after mount, same convention as image-deform.tsx.
  const [upscaleNextChapter, setUpscaleNextChapter] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      setUpscaleNextChapter(localStorage.getItem(STORAGE_KEY) === 'true')
    } catch {
      // ignore
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(STORAGE_KEY, String(upscaleNextChapter))
    } catch {
      // ignore
    }
  }, [loaded, upscaleNextChapter])

  // Self-heal the chapter being read: if it's being viewed in upscaled mode,
  // request its xl copy in the background (a no-op on the server if it's
  // already done, in progress, or already queued).
  useEffect(() => {
    if (chapter === '@local' || isOriginal) return
    requestUpscale(title, chapter)
  }, [title, chapter, isOriginal])

  // Prefetch: get the next chapter ready before the reader gets there.
  useEffect(() => {
    if (!loaded || !upscaleNextChapter || !nextChapter || chapter === '@local') return
    requestUpscale(title, nextChapter)
  }, [loaded, title, nextChapter, upscaleNextChapter, chapter])

  return (
    <UpscaleSettingsContext.Provider value={{ upscaleNextChapter, setUpscaleNextChapter }}>
      {children}
    </UpscaleSettingsContext.Provider>
  )
}
