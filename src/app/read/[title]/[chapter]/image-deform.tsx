'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'config.deform.chapters'

type DeformEntry = { horizontal: number; vertical: number }
type DeformMap = Record<string, DeformEntry>

function readDeformMap(): DeformMap {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

// Only chapters that differ from the default (0/0) are kept in the map, so
// deform values never apply to a chapter the user hasn't explicitly tweaked.
function writeDeformEntry(key: string, entry: DeformEntry) {
  const map = readDeformMap()
  if (entry.horizontal === 0 && entry.vertical === 0) {
    delete map[key]
  } else {
    map[key] = entry
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

type ImageDeformContextValue = {
  horizontal: number
  vertical: number
  setHorizontal: (value: number) => void
  setVertical: (value: number) => void
}

const ImageDeformContext = createContext<ImageDeformContextValue | null>(null)

export function useImageDeform() {
  const context = useContext(ImageDeformContext)
  if (!context) {
    throw new Error('useImageDeform must be used within an ImageDeformProvider')
  }
  return context
}

export default function ImageDeformProvider({
  title,
  chapter,
  children,
}: {
  title: string
  chapter: string
  children: ReactNode
}) {
  const key = `${title}/${chapter}`

  // localStorage isn't available during SSR, so both the server and the
  // first client render start at 0 (avoids a hydration mismatch) and the
  // value persisted for this specific chapter is loaded right after mount.
  const [horizontal, setHorizontal] = useState(0)
  const [vertical, setVertical] = useState(0)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)

  useEffect(() => {
    const entry = readDeformMap()[key]
    setHorizontal(entry?.horizontal ?? 0)
    setVertical(entry?.vertical ?? 0)
    setLoadedKey(key)
  }, [key])

  useEffect(() => {
    if (loadedKey !== key) return
    writeDeformEntry(key, { horizontal, vertical })
  }, [loadedKey, key, horizontal, vertical])

  return (
    <ImageDeformContext.Provider
      value={{ horizontal, vertical, setHorizontal, setVertical }}
    >
      {children}
    </ImageDeformContext.Provider>
  )
}
