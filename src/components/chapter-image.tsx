'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useImageDeform } from '@/app/read/[title]/[chapter]/image-deform'
import { useChapterReader } from '@/app/read/[title]/[chapter]/chapter-reader-context'
import { getChapterRecordCached } from '@/utils/offline/store'

type Props = {
  src: string
  alt?: string
  width?: number
  height?: number
  index: number
}

export default function ChapterImage({ src, alt = '', width = 800, height = 1200, index }: Props) {
  const [useFallback, setUseFallback] = useState(false)
  const [offlineSrc, setOfflineSrc] = useState<string | null>(null)
  const [offlineLookupFailed, setOfflineLookupFailed] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const isOriginal = searchParams?.get('original') === 'true'
  const { horizontal, vertical } = useImageDeform()
  const { title, currentChapter } = useChapterReader()
  const imgRef = useRef<HTMLImageElement>(null)
  const [renderedHeight, setRenderedHeight] = useState(0)

  // Vertical deform is a paint-only transform, so it doesn't shrink/grow the
  // image's layout box. Measure the box and compensate with a margin so the
  // next image slides up/down to stay flush instead of leaving a gap.
  useEffect(() => {
    const el = imgRef.current
    if (!el) return

    // offsetHeight reflects the untransformed layout box; getBoundingClientRect()
    // would include the scaleY() below and feed back into its own compensation.
    const updateHeight = () => setRenderedHeight(el.offsetHeight)
    updateHeight()

    const observer = new ResizeObserver(updateHeight)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // A different src means a different page (chapter switch, etc.) — don't
  // carry a previous page's failure state into it.
  useEffect(() => {
    setUseFallback(false)
    setOfflineSrc(null)
    setOfflineLookupFailed(false)
  }, [src])

  useEffect(() => {
    return () => {
      if (offlineSrc) URL.revokeObjectURL(offlineSrc)
    }
  }, [offlineSrc])

  const xlSrc = src.replace(/\/([^/]+)$/, '/xl/$1')
  const networkSrc = isOriginal ? src : (useFallback ? src : xlSrc)
  const imageSrc = offlineSrc || networkSrc

  const handleError = () => {
    if (offlineSrc) return // already showing the offline copy — nothing else to try

    if (!isOriginal && !useFallback) {
      setUseFallback(true)
      router.replace(`${pathname}?original=true`, { scroll: false })
      return
    }

    // Both the xl and original network URLs failed (offline, missing file,
    // unreachable server, ...) — this is exactly what a chapter download is
    // for: fall back to the copy saved in IndexedDB, if there is one.
    if (currentChapter === '@local') return
    getChapterRecordCached(title, currentChapter).then((record) => {
      const blob = record?.images[index]
      if (!blob) {
        setOfflineLookupFailed(true)
        return
      }
      setOfflineSrc(URL.createObjectURL(blob))
    })
  }

  if (offlineLookupFailed) {
    return (
      <div
        className="flex items-center justify-center bg-muted/40 text-muted-foreground text-xs text-center px-4"
        style={{ width, height: Math.min(height, 240) }}
      >
        Página {index + 1} indisponível offline
      </div>
    )
  }

  return (
    <Image
      ref={imgRef}
      src={imageSrc}
      alt={alt || 'Página do capítulo'}
      width={width}
      height={height}
      onError={handleError}
      style={{
        ...(isOriginal || offlineSrc ? { objectFit: 'contain' } : {}),
        ...((horizontal || vertical)
          ? {
            transform: `scaleX(${1 + horizontal / 100}) scaleY(${1 + vertical / 100})`,
            transformOrigin: 'top left',
            marginBottom: `${renderedHeight * (vertical / 100)}px`,
          }
          : {}),
      }}
    />
  )
}
