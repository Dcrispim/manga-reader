'use client'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { LucideChevronLeft, LucideChevronRight, LucideHistory } from 'lucide-react'
import { getHistory, TitleHistory } from '@/utils/history'

interface ReadingProgress {
  id: string
  name: string
  chapter: string
  thumb: string
  link: string
  lastRead: number
}

export default function ContinueReading() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [readings, setReadings] = useState<ReadingProgress[]>([])
  useEffect(() => {
    try {
      const history = getHistory()
      const chaptersData = localStorage.getItem('chapters')
      if (!chaptersData) return

      const chapters: Record<string, string> = JSON.parse(chaptersData)
      const progressList: ReadingProgress[] = Object.entries(chapters).map(([name, chapter]) => ({
        lastRead: history[name].lastRead ?? 0,
        id: name,
        name,
        chapter,
        thumb: `/api/read/${name}/01/thumb`,
        link: `/read/${name}/${chapter}`,
      }))
      
      console.log(history)

      setReadings(progressList)
    } catch {
      setReadings([])
    }
  }, [])




  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    const scrollAmount = scrollRef.current.clientWidth * 0.8
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

console.log(readings)

  if (readings.length === 0) return null


  return (
    <section className="relative px-4 md:px-8 group/section">
      <h2 className="text-xl md:text-2xl font-bold text-white mb-4 flex items-center gap-2">
        <LucideHistory size={24} />
        Continuar Lendo
      </h2>



      <div className=" relative flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth pb-4"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <button
          onClick={() => scroll('left')}
          className={cn(
            'absolute left-0 top-0 bottom-0 z-10 w-12 flex items-center justify-center',
            'bg-gradient-to-r from-black/80 to-transparent',
            'opacity-0 group-hover/section:opacity-100 transition-opacity duration-300',
            'hover:from-black/90'
          )}
          aria-label="Scroll left"
        >
          <LucideChevronLeft className="text-white" size={32} />
        </button>


        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth pb-4"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >

          {readings.sort((a, b) => b.lastRead - a.lastRead).map((item) => (
            <Link
              key={item.id}
              href={item.link}
              className="flex-shrink-0 group/card"
            >
              <div className="relative w-36 md:w-44 aspect-[2/3] rounded-md overflow-hidden" aria-label={`Lido por ultimo em ${new Date(item.lastRead).toLocaleDateString()}`}>
                <Image
                  src={item.thumb}
                  alt={item.name}
                  fill
                  className={cn(
                    'object-cover transition-transform duration-300',
                    'group-hover/card:scale-110'
                  )}
                />
                <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/20 transition-colors duration-300" />

                <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">
                  Cap. {item.chapter}
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
                  <p className="text-white text-sm font-medium truncate capitalize">
                    {item.name.replaceAll('-', ' ')}
                  </p>
                  <p className="text-blue-400 text-xs">Continuar do cap. {item.chapter}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <button
          onClick={() => scroll('right')}
          className={cn(
            'absolute right-0 top-0 bottom-0 z-10 w-12 flex items-center justify-center',
            'bg-gradient-to-l from-black/80 to-transparent',
            'opacity-0 group-hover/section:opacity-100 transition-opacity duration-300',
            'hover:from-black/90'
          )}
          aria-label="Scroll right"
        >
          <LucideChevronRight className="text-white" size={32} />
        </button>
      </div>
    </section>
  )
}
