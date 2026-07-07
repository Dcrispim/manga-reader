'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

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
      src={imageSrc}
      alt={alt || 'Página do capítulo'}
      width={width}
      height={height}
      onError={handleError}
      style={isOriginal ? { objectFit: 'contain' } : {}}
    />
  )
}
