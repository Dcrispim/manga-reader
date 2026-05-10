'use client'

import Image from 'next/image'
import { useState } from 'react'

type Props = {
  src: string
  alt?: string
  width?: number
  height?: number
}

import { useSearchParams } from 'next/navigation'

export default function ChapterImage({ src, alt = '', width = 800, height = 1200 }: Props) {
  const [useFallback, setUseFallback] = useState(false)
  const searchParams = useSearchParams();
  const isOriginal = searchParams?.get('original') === 'true';

  // Infere o caminho da versão xl, inserindo `/xl` antes do índice
  const xlSrc = src.replace(/\/([^/]+)$/, '/xl/$1')

  // Se original=true, usa o src original, senão tenta xl
  const imageSrc = isOriginal ? src : (useFallback ? src : xlSrc);

  return (
    <Image
      src={imageSrc}
      alt={alt || "Página do capítulo"}
      width={width}
      height={height}
      onError={() => setUseFallback(true)}
      style={isOriginal ? { objectFit: 'contain' } : {}}
    />
  )
}
