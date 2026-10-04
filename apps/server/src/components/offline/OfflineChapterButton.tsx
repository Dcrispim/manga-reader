'use client'

import { Download, Loader2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOfflineChapter } from '@/hooks/useOfflineChapter'

export default function OfflineChapterButton({
  title,
  chapter,
  className,
}: {
  title: string
  chapter: string
  className?: string
}) {
  const { isSaved, isDownloading, error, download, remove } = useOfflineChapter(title, chapter)

  const label = isSaved ? 'Remover download offline' : 'Baixar capítulo para offline'

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (isDownloading) return
        if (isSaved) remove()
        else download()
      }}
      disabled={isDownloading}
      title={error || label}
      aria-label={label}
      className={cn(
        'inline-flex items-center justify-center w-7 h-7 rounded-full transition-colors',
        isSaved
          ? 'text-primary hover:text-destructive hover:bg-destructive/10'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent',
        error && 'text-destructive',
        className
      )}
    >
      {isDownloading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isSaved ? (
        <Trash2 className="w-4 h-4" />
      ) : (
        <Download className="w-4 h-4" />
      )}
    </button>
  )
}
