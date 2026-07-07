'use client'

import { useRouter } from 'next/navigation'
import { useEffect, type Dispatch, type SetStateAction } from 'react'
import { getChapters, getHistory, saveToHistory } from '@/utils/history'
import { BIND_CODE_KEY } from '@/utils/bind'
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
        // Save the current chapter to localStorage
        const savedChapters = JSON.parse(localStorage.getItem('chapters') || '{}')
        savedChapters[title] = currentChapter
        localStorage.setItem('chapters', JSON.stringify(savedChapters))

        // Save the title to history
        saveToHistory(title, currentChapter)

        // Push the updated reading progress to the connected bind, if any
        const bindCode = localStorage.getItem(BIND_CODE_KEY)
        if (bindCode) {
            fetchData(`/api/bind/${bindCode}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history: getHistory(), chapters: getChapters() }),
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

