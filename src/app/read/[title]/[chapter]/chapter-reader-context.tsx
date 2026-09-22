'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { saveToHistory } from '@/utils/history'
import { getChapterRecord } from '@/utils/offline/store'
import { isOffline } from '@/utils/offline/navigation'
import { getNextChapter, getPreviousChapter } from '@/utils/utils.server'

export type ChapterDisplay =
  | { source: 'network'; images: string[] }
  | { source: 'offline'; images: string[] }
  | { source: 'unavailable' }

type ChapterReaderContextValue = {
  title: string
  currentChapter: string
  display: ChapterDisplay
  nextChapter: string | null
  prevChapter: string | null
  // Switches chapters. Online, this is a real navigation (unchanged
  // app behavior). Offline, a Next.js client transition would just fail
  // silently — it's a fetch for RSC data under the hood — so this instead
  // swaps the chapter in place from IndexedDB, in the SAME already-mounted
  // page: same sidebar, same layout, only the chapter data changes.
  goToChapter: (chapter: string) => void
}

const ChapterReaderContext = createContext<ChapterReaderContextValue | null>(null)

export function useChapterReader() {
  const context = useContext(ChapterReaderContext)
  if (!context) {
    throw new Error('useChapterReader must be used within a ChapterReaderProvider')
  }
  return context
}

export default function ChapterReaderProvider({
  title,
  initialChapter,
  initialImages,
  allChapters,
  children,
}: {
  title: string
  initialChapter: string
  initialImages: string[]
  allChapters: string[]
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [currentChapter, setCurrentChapter] = useState(initialChapter)
  const [display, setDisplay] = useState<ChapterDisplay>({ source: 'network', images: initialImages })
  const objectUrlsRef = useRef<string[]>([])

  const revokeObjectUrls = () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrlsRef.current = []
  }

  const loadChapterFromIndexedDb = (chapter: string) => {
    getChapterRecord(title, chapter).then((record) => {
      revokeObjectUrls()
      if (!record) {
        setDisplay({ source: 'unavailable' })
        return
      }
      const urls = record.images.map((blob) => URL.createObjectURL(blob))
      objectUrlsRef.current = urls
      setDisplay({ source: 'offline', images: urls })
    })
  }

  // A real (online) navigation remounts page.tsx with fresh server props —
  // sync back to those whenever that happens.
  useEffect(() => {
    revokeObjectUrls()
    setCurrentChapter(initialChapter)
    setDisplay({ source: 'network', images: initialImages })
  }, [initialChapter, initialImages])

  // Offline, a chapter downloaded from the title page (a background fetch)
  // may never have been opened as a real page before, so the service
  // worker has no cached response for its exact URL — only a same-title
  // fallback (see public/sw.js), which serves a *different* chapter's
  // cached page verbatim. When that happens, the props this component was
  // handed (from that other chapter's render) won't match the actual URL —
  // detect that and load the URL's real chapter from IndexedDB instead.
  useEffect(() => {
    const match = pathname?.match(/^\/read\/[^/]+\/([^/]+)\/?$/)
    const urlChapter = match?.[1]
    if (!urlChapter || urlChapter === initialChapter) return
    setCurrentChapter(urlChapter)
    loadChapterFromIndexedDb(urlChapter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, initialChapter])

  useEffect(() => () => revokeObjectUrls(), [])

  const numericChapters = allChapters.map((c) => parseFloat(c))
  const nextChapterNum = getNextChapter(currentChapter, numericChapters)
  const prevChapterNum = getPreviousChapter(currentChapter, numericChapters)

  const goToChapter = (chapter: string) => {
    const href = `/read/${title}/${chapter}`

    if (!isOffline()) {
      router.push(href)
      return
    }

    window.history.pushState(null, '', href)
    saveToHistory(title, chapter)
    setCurrentChapter(chapter)
    loadChapterFromIndexedDb(chapter)
  }

  return (
    <ChapterReaderContext.Provider
      value={{
        title,
        currentChapter,
        display,
        nextChapter: nextChapterNum === '' ? null : nextChapterNum.toString(),
        prevChapter: prevChapterNum === '' ? null : prevChapterNum.toString(),
        goToChapter,
      }}
    >
      {children}
    </ChapterReaderContext.Provider>
  )
}
