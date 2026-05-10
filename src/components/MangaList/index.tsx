'use client'
import {
  LucideBookUp,
  LucideCog,
  LucideEdit3,
  LucideSearch,
  LucideSparkles,
  LucideTags,
} from 'lucide-react'

import Card, { asCard } from '../Card'
import { useScreen } from '@/hooks/useScreen'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { THUMB_SIZE } from '@/utils/consts'

export default function MangaList({
  list,
}: {
  list: {
    name: string
    thumb: string
    description: string
    caps: string
    link: string
  }[]
}) {
  const { isHuge, width } = useScreen()
  const [manga, setManga] = useState(
    {} as {
      name: string
      thumb: string
      description: string
      caps: string
      link: string
    }
  )
  const _cols = Math.ceil(width / THUMB_SIZE.W)
  const cols_possibility = [1, 2, 3, 6] // Allow only 1, 2, 3, or 4 columns

  // Create an object with the difference between _cols and each possible column count
  const _cols_possibility = cols_possibility.reduce(
    (acc, val) => {
      const diff = Math.abs(_cols - val) // Calculate the difference
      return { ...acc, [diff]: val }
    },
    {} as { [n: number]: number }
  )

  // Find the column number with the smallest difference
  const cols =
    _cols_possibility[
      Math.min(...(Object.keys(_cols_possibility) as unknown as number[]))
    ]
  return (
    <div className="flex scroll-hidden flex-col w-full h-screen justify-center items-center overflow-x-hidden px-8 scroll-m-0">
      <div
        className={cn('w-full grid gap-8 pl-4 pt-4')}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, minmax(40px, 1fr))`,
        }}
      >
        {asCard(LucideBookUp, 'Read', '/read')}
        {asCard(LucideSearch, 'Search',"/search")}
        {asCard(LucideSparkles, 'Destaq')}
        {asCard(LucideTags, 'Tags')}
        {asCard(LucideEdit3, 'Editor', '')}
        {asCard(LucideCog, 'Config')}
      </div>

      <div
        className={'w-full grid gap-8'}
        style={{
          //maxWidth: isHuge ? '60%' : undefined,
          gridTemplateColumns: isHuge
            ? 'repeat(auto-fit,minmax(40rem,1fr))'
            : 'repeat(auto-fit,minmax(10rem,1fr))',
        }}
      >
        {list?.map?.((manga, index) => (
          <Card
            {...manga}
            isHuge={isHuge}
            key={`${manga.name}-${index}`}
            onMouseOver={() => setManga(manga)}
          />
        ))}
      </div>
    </div>
  )
}
//  W: 145.83,
// H: 229.17,
