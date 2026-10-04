'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { LucideSearch, LucideArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { THUMB_SIZE } from '@/utils/consts'
import Card from '@/components/Card'

function SearchPage() {
  const router = useRouter()
  const searchParams  = useSearchParams()
  const [query, setQuery] = useState(searchParams .get("q") as string || '')
  const [results, setResults] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Perform search when query changes
  useEffect(() => {
    const searchDebounce = setTimeout(() => {
      if (query.trim()) {
        performSearch(query)
      } else {
        setResults([])
      }
    }, 300)

    return () => clearTimeout(searchDebounce)
  }, [query])

  async function performSearch(searchQuery: string) {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
      const data = await response.json()
      setResults(data)
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col w-full px-8 py-4">
      {/* Search Header */}
      <div className="flex items-center gap-4 mb-6 sticky top-0 bg-background z-10 py-4">
        <button 
          onClick={() => router.back()}
          className="p-2 rounded-full hover:bg-accent"
        >
          <LucideArrowLeft size={24} />
        </button>
        
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <LucideSearch className="text-gray-400" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search manga..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
        </div>
      </div>

      {/* Search Results */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : query && results.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No results found for "{query}"
        </div>
      ) : (
        <div className={cn('grid gap-8 w-full')} 
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          }}
        >
          {results.map((manga, index) => (
            <Card
              key={`${manga.name}-${index}`}
              {...manga}
              isHuge={false}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function (){
  return <Suspense>
    <SearchPage />
  </Suspense>
}