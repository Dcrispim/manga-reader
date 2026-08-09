'use client'

import { useRouter } from 'next/navigation'
import { useEffect, type Dispatch, type SetStateAction } from 'react'
import { getChapters, getHistory, getLatestChapter, saveToHistory, setChapters } from '@/utils/history'
import { BIND_CODE_KEY, buildDeltaPayload, getLastSync, setLastSync } from '@/utils/bind'
import { fetchData } from '@/services/fetch'

export default function HandleKeyboardNavigation({
    nextChapter,
    prevChapter,
    title,
    currentChapter,
    setZoom,
}: {
    nextChapter: string | null
    prevChapter: string | null
    title: string
    currentChapter: string
    setZoom: Dispatch<SetStateAction<number>>
}) {
    const router = useRouter()

    useEffect(() => {
        // Save the title to history (additive: only genuinely new chapters
        // get a fresh timestamp, so a stale reload of an old chapter can't
        // look "more recent" than real progress made elsewhere).
        saveToHistory(title, currentChapter)

        // Derive the "continue from" chapter from the recorded open times
        // instead of blindly trusting whatever chapter this mount happened
        // to load, which protects against the same stale-reload scenario.
        const savedChapters = getChapters()
        savedChapters[title] = getLatestChapter(getHistory()[title]) ?? currentChapter
        setChapters(savedChapters)

        // Push only what changed since the last sync to the connected bind, if any
        const bindCode = localStorage.getItem(BIND_CODE_KEY)
        if (bindCode) {
            const since = getLastSync()
            const now = Date.now()
            fetchData(`/api/bind/${bindCode}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildDeltaPayload({ history: getHistory(), chapters: savedChapters }, since)),
            }).then((result) => {
                if (result && !result.error && !result.message) setLastSync(now)
            })
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            const el = event.target as HTMLElement | null
            const inEditable = Boolean(
                el?.closest('input, textarea, select, [contenteditable="true"]')
            )

            if (event.key === 'ArrowRight' && nextChapter && !inEditable) {
                router.push(`/read/${title}/${nextChapter}`)
            } else if (event.key === 'ArrowLeft' && prevChapter && !inEditable) {
                router.push(`/read/${title}/${prevChapter}`)
            } else if (
                !inEditable &&
                (event.key === ']' || event.code === 'BracketRight')
            ) {
                setZoom((prevZoom) => Math.min(2, prevZoom + 0.1))
            } else if (
                !inEditable &&
                (event.key === '[' || event.code === 'BracketLeft')
            ) {
                setZoom((prevZoom) => Math.max(0.5, prevZoom - 0.1))
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [nextChapter, prevChapter, title, currentChapter, router, setZoom])

    return null
}

