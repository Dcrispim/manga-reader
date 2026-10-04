'use client'

import { useCallback, useEffect, useState } from 'react'
import { deleteChapter, isChapterSaved } from '@/utils/offline/store'
import { downloadChapterImages } from '@/utils/offline/downloader'
import { subscribeOfflineChanged } from '@/utils/offline/events'

export function useOfflineChapter(title: string, chapter: string) {
  const [isSaved, setIsSaved] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    isChapterSaved(title, chapter)
      .then(setIsSaved)
      .catch(() => setIsSaved(false))
  }, [title, chapter])

  useEffect(() => {
    refresh()
    return subscribeOfflineChanged(refresh)
  }, [refresh])

  const download = useCallback(async () => {
    setIsDownloading(true)
    setError(null)
    try {
      await downloadChapterImages(title, chapter)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao baixar capítulo')
    } finally {
      setIsDownloading(false)
    }
  }, [title, chapter])

  const remove = useCallback(async () => {
    await deleteChapter(title, chapter)
  }, [title, chapter])

  return { isSaved, isDownloading, error, download, remove }
}
