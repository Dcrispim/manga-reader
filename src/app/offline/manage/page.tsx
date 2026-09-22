'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  deleteAllChapters,
  deleteChapter,
  deleteTitle,
  listAllChapters,
} from '@/utils/offline/store'
import { listCachedTitles } from '@/utils/offline/titleCache'
import { subscribeOfflineChanged } from '@/utils/offline/events'
import type { OfflineChapterMeta, OfflineTitleRecord } from '@/utils/offline/types'

const CONFIRM_TIMEOUT_MS = 4000

// A press-again-to-confirm pattern instead of window.confirm(): native confirm()
// blocks the main thread, which freezes this page (and any browser automation
// driving it) until dismissed — a plain in-app "confirm" state avoids that.
function useArmedConfirm() {
  const [armedId, setArmedId] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const trigger = useCallback(
    (id: string, action: () => void) => {
      if (armedId === id) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        setArmedId(null)
        action()
        return
      }
      setArmedId(id)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setArmedId(null), CONFIRM_TIMEOUT_MS)
    },
    [armedId]
  )

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }, [])

  return { armedId, trigger }
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(ms: number) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms))
}

export default function OfflineManagePage() {
  const [chapters, setChapters] = useState<OfflineChapterMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [titleInfo, setTitleInfo] = useState<Record<string, OfflineTitleRecord>>({})
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({})
  const { armedId, trigger } = useArmedConfirm()

  const refresh = useCallback(() => {
    listAllChapters()
      .then((list) => setChapters(list.sort((a, b) => b.savedAt - a.savedAt)))
      .finally(() => setLoading(false))
    listCachedTitles().then((list) => {
      const map: Record<string, OfflineTitleRecord> = {}
      list.forEach((t) => {
        map[t.id] = t
      })
      setTitleInfo(map)
    })
  }, [])

  useEffect(() => {
    refresh()
    return subscribeOfflineChanged(refresh)
  }, [refresh])

  // Cached covers are stored as Blobs (offline-first also means the cover
  // shown here survives being offline) — turn them into object URLs for
  // display, and clean those up whenever the underlying set changes.
  useEffect(() => {
    const urls: Record<string, string> = {}
    Object.values(titleInfo).forEach((info) => {
      if (info.thumb) urls[info.id] = URL.createObjectURL(info.thumb)
    })
    setThumbUrls(urls)
    return () => {
      Object.values(urls).forEach((url) => URL.revokeObjectURL(url))
    }
  }, [titleInfo])

  const byTitle = chapters.reduce<Record<string, OfflineChapterMeta[]>>((acc, chap) => {
    ;(acc[chap.title] ??= []).push(chap)
    return acc
  }, {})

  const totalSize = chapters.reduce((sum, c) => sum + c.sizeBytes, 0)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-[720px] mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6 gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Biblioteca
          </Link>
          {chapters.length > 0 && (
            <button
              type="button"
              onClick={() => trigger('all', deleteAllChapters)}
              className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                armedId === 'all'
                  ? 'bg-destructive text-destructive-foreground animate-pulse'
                  : 'bg-destructive/80 text-destructive-foreground hover:bg-destructive'
              )}
            >
              <Trash2 className="w-3.5 h-3.5" /> {armedId === 'all' ? 'Confirmar remoção?' : 'Remover tudo'}
            </button>
          )}
        </div>

        <h1 className="text-2xl font-bold mb-1">Arquivos locais</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {chapters.length} capítulo{chapters.length === 1 ? '' : 's'} salvo{chapters.length === 1 ? '' : 's'} ·{' '}
          {formatSize(totalSize)}
        </p>

        {loading && <p className="text-sm text-muted-foreground italic">Carregando...</p>}
        {!loading && chapters.length === 0 && (
          <p className="text-sm text-muted-foreground italic">Nenhum capítulo salvo offline.</p>
        )}

        <div className="flex flex-col gap-4">
          {Object.entries(byTitle).map(([title, list]) => (
            <section key={title} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-10 h-14 rounded overflow-hidden bg-muted flex-none border border-border">
                    {thumbUrls[title] && (
                      <Image src={thumbUrls[title]} alt={title} fill className="object-cover" sizes="40px" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-semibold capitalize truncate">{title.replaceAll('-', ' ')}</h2>
                    {titleInfo[title]?.metadata.author && (
                      <p className="text-xs text-muted-foreground truncate">{titleInfo[title].metadata.author}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {list.length} capítulo{list.length === 1 ? '' : 's'} ·{' '}
                      {formatSize(list.reduce((s, c) => s + c.sizeBytes, 0))}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => trigger(`title:${title}`, () => deleteTitle(title))}
                  aria-label={
                    armedId === `title:${title}`
                      ? `Confirmar remoção de todos os capítulos de ${title}`
                      : `Remover todos os capítulos de ${title}`
                  }
                  title={armedId === `title:${title}` ? 'Clique novamente para confirmar' : undefined}
                  className={cn(
                    'inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors flex-none',
                    armedId === `title:${title}`
                      ? 'text-destructive-foreground bg-destructive animate-pulse'
                      : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                  )}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <ul className="divide-y divide-border/60">
                {list
                  .sort((a, b) => parseFloat(b.chapter) - parseFloat(a.chapter))
                  .map((chap) => (
                    <li key={chap.id} className="flex items-center justify-between px-4 py-2 text-sm gap-3">
                      <span className="truncate">
                        Cap. {chap.chapter}{' '}
                        <span className="text-xs text-muted-foreground">
                          · {formatSize(chap.sizeBytes)} · {formatDate(chap.savedAt)}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteChapter(chap.title, chap.chapter)}
                        className="text-muted-foreground hover:text-destructive transition-colors flex-none"
                        aria-label={`Remover capítulo ${chap.chapter}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
