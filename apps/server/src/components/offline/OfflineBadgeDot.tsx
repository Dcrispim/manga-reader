'use client'

import { useOfflineChapter } from '@/hooks/useOfflineChapter'

// A non-interactive indicator used inside chapter grids where the chapter
// number is already a link — an interactive download control can't be
// nested inside that anchor, so this only reflects saved state.
export default function OfflineBadgeDot({ title, chapter }: { title: string; chapter: string }) {
  const { isSaved } = useOfflineChapter(title, chapter)
  if (!isSaved) return null
  return (
    <span
      aria-label="Disponível offline"
      className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-primary pointer-events-none"
    />
  )
}
