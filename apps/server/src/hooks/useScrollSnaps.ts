'use client'
import { useEffect, type RefObject } from 'react'
import { crossedSnap, snapOffset, snapStorageKey } from '@manga/core'

const RESTORE_WINDOW_MS = 4000
const INTERACTION_EVENTS = ['wheel', 'touchstart', 'pointerdown'] as const

export function useScrollSnaps(
  containerRef: RefObject<HTMLElement | null>,
  title?: string,
  chapter?: string,
) {
  useEffect(() => {
    const el = containerRef.current
    if (!el || !title || !chapter) return
    const key = snapStorageKey(title, chapter)
    let saved = 0
    try {
      saved = Number(localStorage.getItem(key)) || 0
    } catch {}

    let prevY = 0
    let restoring = true
    const restore = () => {
      el.scrollTop = saved > 0 ? snapOffset(saved, el.scrollHeight) : 0
      prevY = el.scrollTop
    }

    const observer = new ResizeObserver(restore)
    const stopRestoring = () => {
      if (!restoring) return
      restoring = false
      observer.disconnect()
      clearTimeout(timer)
      INTERACTION_EVENTS.forEach((type) => el.removeEventListener(type, stopRestoring))
      window.removeEventListener('keydown', stopRestoring)
      prevY = el.scrollTop
    }
    const timer = setTimeout(stopRestoring, RESTORE_WINDOW_MS)
    INTERACTION_EVENTS.forEach((type) =>
      el.addEventListener(type, stopRestoring, { passive: true }),
    )
    window.addEventListener('keydown', stopRestoring)
    if (el.firstElementChild) observer.observe(el.firstElementChild)
    restore()

    const onScroll = () => {
      const y = el.scrollTop
      if (restoring) {
        prevY = y
        return
      }
      const k = crossedSnap(prevY, y, el.scrollHeight)
      prevY = y
      if (k === null) return
      try {
        localStorage.setItem(key, String(k))
      } catch {}
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      stopRestoring()
      el.removeEventListener('scroll', onScroll)
    }
  }, [containerRef, title, chapter])
}
