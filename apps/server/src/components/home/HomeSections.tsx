'use client'

import { useState } from 'react'
import { HardDriveDownload } from 'lucide-react'
import type { Category, Title } from '@/types/api'
import { cn } from '@/lib/utils'
import SectionCarousel from './SectionCarousel'
import { useOfflineTitles } from '@/hooks/useOfflineTitles'

export default function HomeSections({
  categories,
  titlesByCategory,
}: {
  categories: Category[]
  titlesByCategory: Record<string, Title[]>
}) {
  const [onlyOffline, setOnlyOffline] = useState(false)
  const offlineTitles = useOfflineTitles()

  const filteredByCategory: Record<string, Title[]> = Object.fromEntries(
    Object.entries(titlesByCategory).map(([id, titles]) => [
      id,
      onlyOffline ? titles.filter((t) => offlineTitles.has(t.name)) : titles,
    ])
  )

  const visibleCategories = categories.filter((category) =>
    onlyOffline ? (filteredByCategory[category.id] ?? []).length > 0 : (category.count ?? 0) > 2
  )

  return (
    <>
      <div className="px-4 md:px-8 flex justify-end">
        <button
          type="button"
          onClick={() => setOnlyOffline((v) => !v)}
          className={cn(
            'inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-colors',
            onlyOffline
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-white/20 text-white/70 hover:text-white'
          )}
        >
          <HardDriveDownload size={14} />
          {onlyOffline ? `Salvos offline (${offlineTitles.size})` : 'Mostrar apenas salvos offline'}
        </button>
      </div>

      {visibleCategories.map((category) => (
        <SectionCarousel
          key={category.id}
          title={onlyOffline ? category.name : `${category.name}${category.count ? ` (${category.count})` : ''}`}
          titles={filteredByCategory[category.id] ?? []}
        />
      ))}

      {onlyOffline && offlineTitles.size === 0 && (
        <p className="px-4 md:px-8 text-sm text-white/50 italic">Nenhum título salvo offline ainda.</p>
      )}
    </>
  )
}
