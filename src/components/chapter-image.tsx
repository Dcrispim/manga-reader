'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useImageDeform } from '@/app/read/[title]/[chapter]/image-deform'
import { useChapterReader } from '@/app/read/[title]/[chapter]/chapter-reader-context'
import { getChapterRecordCached } from '@/utils/offline/store'

// /api/read/<title>/<chapter>/xl/<page>[/<slice>] — see the xl list route.
const XL_SRC_RE = /\/xl\/(\d+)(?:\/(\d+))?$/

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
    // An extra slice unmounts its <img> while falling back (see below), so
    // re-attach to whichever element is there once that settles.
  }, [useFallback])

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

  // src already comes from the right list (xl or original) — an xl src may
  // be one slice of a page, so `index` isn't necessarily the page number.
  const xlMatch = src.match(XL_SRC_RE)
  const pageIndex = xlMatch ? Number(xlMatch[1]) : index
  const originalSrc = xlMatch ? `${src.slice(0, xlMatch.index)}/${xlMatch[1]}` : src
  // Past the xl copy, the first slice of a page stands in for the whole
  // page; the other slices step aside instead of repeating it.
  const isExtraSlice = xlMatch?.[2] !== undefined && Number(xlMatch[2]) > 0

  const networkSrc = useFallback ? originalSrc : src
  const imageSrc = offlineSrc || networkSrc

  const handleError = () => {
    if (offlineSrc) return // already showing the offline copy — nothing else to try

    if (!isOriginal && !useFallback) {
      setUseFallback(true)
      router.replace(`${pathname}?original=true`, { scroll: false })
      return
    }

    if (isExtraSlice) return

    // Both the xl and original network URLs failed (offline, missing file,
    // unreachable server, ...) — this is exactly what a chapter download is
    // for: fall back to the copy saved in IndexedDB, if there is one.
    if (currentChapter === '@local') return
    getChapterRecordCached(title, currentChapter).then((record) => {
      const blob = record?.images[pageIndex]
      if (!blob) {
        setOfflineLookupFailed(true)
        return
      }
      setOfflineSrc(URL.createObjectURL(blob))
    })
  }

  if (isExtraSlice && useFallback) return null

  if (offlineLookupFailed) {
    return (
      <div
        className="flex items-center justify-center bg-muted/40 text-muted-foreground text-xs text-center px-4"
        style={{ width, height: Math.min(height, 240) }}
      >
        Página {pageIndex + 1} indisponível offline
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
