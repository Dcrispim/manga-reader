'use client'

import { useEffect, useState } from 'react'
import ZoomHandler from '@/components/ZoomHandler'
import HandleKeyboardNavigation from './handle-keyboard'

export default function ReadChapterClient({
  images,
  title,
  prevChapter,
  currentChapter,
  isOriginal,
}: {
  images: { images: string[] }
  title: string
  prevChapter: string | null
  currentChapter: string
  isOriginal: boolean
}) {
  const [zoom, setZoom] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseFloat(localStorage.getItem('config.zoom') || '1') || 1
    }
    return 1
  })

  useEffect(() => {
    localStorage.setItem('config.zoom', zoom.toString())
  }, [zoom])

  return (
    <>
      <HandleKeyboardNavigation
        prevChapter={prevChapter}
        title={title}
        currentChapter={currentChapter}
        setZoom={setZoom}
      />
      <ZoomHandler
        images={images}
        title={title}
        currentChapter={currentChapter}
        zoom={zoom}
        setZoom={setZoom}
        isOriginal={isOriginal}
      />
    </>
  )
}
