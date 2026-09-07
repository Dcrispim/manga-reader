'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useImageDeform } from '@/app/read/[title]/[chapter]/image-deform'

type Props = {
  src: string
  alt?: string
  width?: number
  height?: number
}

export default function ChapterImage({ src, alt = '', width = 800, height = 1200 }: Props) {
  const [useFallback, setUseFallback] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const isOriginal = searchParams?.get('original') === 'true'
  const { horizontal, vertical } = useImageDeform()
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

  const xlSrc = src.replace(/\/([^/]+)$/, '/xl/$1')
  const imageSrc = isOriginal ? src : (useFallback ? src : xlSrc)

  const handleError = () => {
    if (!isOriginal && !useFallback) {
      setUseFallback(true)
      router.replace(`${pathname}?original=true`, { scroll: false })
    }
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
        ...(isOriginal ? { objectFit: 'contain' } : {}),
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
