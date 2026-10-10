'use client'
import { useEffect, type RefObject } from 'react'
import { crossedSnap, snapStorageKey } from '@manga/core'

export function useScrollSnaps(
  containerRef: RefObject<HTMLElement | null>,
  title?: string,
  chapter?: string,
) {
  useEffect(() => {
    const el = containerRef.current
    if (!el || !title || !chapter) return
    const key = snapStorageKey(title, chapter)
    let prevY = el.scrollTop

    const onScroll = () => {
      const y = el.scrollTop
      const k = crossedSnap(prevY, y, el.scrollHeight)
      prevY = y
      if (k === null) return
      try {
        localStorage.setItem(key, String(k))
      } catch {}
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [containerRef, title, chapter])
}
