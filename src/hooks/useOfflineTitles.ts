'use client'

import { useEffect, useState } from 'react'
import { listAllChapters } from '@/utils/offline/store'
import { subscribeOfflineChanged } from '@/utils/offline/events'

// Titles that currently have at least one chapter saved offline, kept in
// sync with IndexedDB via the offline-changed event bus.
export function useOfflineTitles(): Set<string> {
  const [titles, setTitles] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    const refresh = () => {
      listAllChapters()
        .then((chapters) => {
          if (!cancelled) setTitles(new Set(chapters.map((c) => c.title)))
        })
        .catch(() => {})
    }
    refresh()
    const unsubscribe = subscribeOfflineChanged(refresh)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return titles
}
