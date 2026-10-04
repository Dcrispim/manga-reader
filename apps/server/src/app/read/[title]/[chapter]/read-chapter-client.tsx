'use client'

import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'
import ZoomHandler from '@/components/ZoomHandler'
import HandleKeyboardNavigation from './handle-keyboard'
import { useChapterReader } from './chapter-reader-context'
import { getAutoDownloadNext } from '@/utils/offline/config'
import { isChapterSaved } from '@/utils/offline/store'
import { downloadChapterImages } from '@/utils/offline/downloader'

// Replaces just the scroll/reading area when the current chapter has no
// data to show — the sidebar (chapter grid, next/prev, config) stays
// mounted and interactive right next to it, exactly like the rest of the
// reader, so switching to another downloaded chapter is a click away.
function ChapterUnavailable({ chapter }: { chapter: string }) {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center gap-3 text-center px-6 bg-background">
      <WifiOff className="w-8 h-8 text-muted-foreground" />
      <p className="text-foreground font-medium">Capítulo {chapter} não está disponível offline.</p>
      <p className="text-sm text-muted-foreground max-w-sm">
        Baixe este capítulo enquanto estiver online, ou escolha outro capítulo já baixado ao lado.
      </p>
    </div>
  )
}

export default function ReadChapterClient({
  title,
  isOriginal,
}: {
  title: string
  isOriginal: boolean
}) {
  const { currentChapter, prevChapter, nextChapter, display } = useChapterReader()

  const [zoom, setZoom] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseFloat(localStorage.getItem('config.zoom') || '1') || 1
    }
    return 1
  })

  useEffect(() => {
    localStorage.setItem('config.zoom', zoom.toString())
  }, [zoom])

  useEffect(() => {
    if (!nextChapter || currentChapter === '@local') return
    if (!getAutoDownloadNext()) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return

    let cancelled = false
    isChapterSaved(title, nextChapter).then((saved) => {
      if (saved || cancelled) return
      downloadChapterImages(title, nextChapter).catch(() => {})
    })
    return () => {
      cancelled = true
    }
  }, [title, nextChapter, currentChapter])

  return (
    <>
      <HandleKeyboardNavigation
        prevChapter={prevChapter}
        title={title}
        currentChapter={currentChapter}
        setZoom={setZoom}
      />
      {display.source === 'unavailable' ? (
        <ChapterUnavailable chapter={currentChapter} />
      ) : (
        <ZoomHandler
          images={{ images: display.images }}
          title={title}
          currentChapter={currentChapter}
          zoom={zoom}
          setZoom={setZoom}
          isOriginal={display.source === 'offline' ? true : isOriginal}
          hideOriginalToggle={display.source === 'offline'}
        />
      )}
    </>
  )
}
