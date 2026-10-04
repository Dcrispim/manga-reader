'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { LucideSearch, LucideLoader2 } from 'lucide-react'
import type { Title } from '@/types/api'

interface SearchResult extends Title {
  categories?: string[]
  author?: string
}

const DEBOUNCE_MS = 300

export default function SpotlightSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Cmd/Ctrl+K toggles the palette; Cmd/Ctrl+F opens it (overriding the
  // browser's native find-in-page); Escape closes it.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setOpen(true)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      setQuery('')
      setResults([])
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const debounce = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data = await response.json()
        setResults(Array.isArray(data) ? data : [])
      } catch {
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(debounce)
  }, [query])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 right-4 z-40 flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-white/60 shadow-lg backdrop-blur transition-colors hover:bg-black/60 hover:text-white"
        aria-label="Pesquisar"
      >
        <LucideSearch size={16} />
        <span className="hidden text-sm md:inline">Pesquisar</span>
        <kbd className="hidden rounded border border-white/20 px-1.5 py-0.5 text-xs text-white/40 md:inline">⌘K</kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex w-screen h-screen items-center justify-center overflow-y-auto bg-black/70 backdrop-blur-sm px-4 py-10"
          onClick={() => setOpen(false)}
        >
          <div
            className="h-fit w-full max-w-[min(45rem,920px)] overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/90 shadow-2xl backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <form
              className="flex items-center gap-3 border-b border-white/10 px-4 py-3"
              onSubmit={(e) => {
                e.preventDefault()
                const first = results[0]
                if (!first) return
                router.push(first.link)
                setOpen(false)
              }}
            >
              {isLoading ? (
                <LucideLoader2 size={20} className="animate-spin text-white/50" />
              ) : (
                <LucideSearch size={20} className="text-white/50" />
              )}
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por título, gênero ou autor..."
                className="w-full bg-transparent text-lg text-white placeholder:text-white/40 focus:outline-none"
              />
              <kbd className="rounded border border-white/20 px-1.5 py-0.5 text-xs text-white/40">esc</kbd>
            </form>

            {query.trim() && (
              <div
                className="max-h-[60vh] overflow-y-auto scrollbar-hide"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {!isLoading && results.length === 0 && (
                  <p className="px-4 py-8 text-center text-sm text-white/40">
                    Nenhum resultado para &quot;{query}&quot;
                  </p>
                )}

                {results.map((item) => (
                  <Link
                    key={item.id}
                    href={item.link}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-white/10"
                  >
                    <div className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded">
                      <Image src={item.thumb} alt={item.name} fill className="object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate capitalize text-white">{item.name.replaceAll('-', ' ')}</p>
                      <p className="truncate text-xs text-white/40">
                        {[item.categories?.slice(0, 2).join(', '), item.author, `${item.caps} caps`]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
