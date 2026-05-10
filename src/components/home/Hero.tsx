'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { Title } from '@/types/api'
import { Button } from '@/components/ui/button'
import { LucidePlay, LucideInfo } from 'lucide-react'

interface HeroProps {
  title: Title
  allTitles: Title[]
}

export default function Hero({ title:initialTitle, allTitles = [] }: HeroProps) {
  const [title, setTitle] = useState(initialTitle)
  const [readLink, setReadLink] = useState(initialTitle.link)
  const [savedChapter, setSavedChapter] = useState<string | null>(null)

  useEffect(() => {
   setTimeout(() => {
    const newTitle = allTitles[Math.floor(Math.random() * allTitles.length)]
    setTitle( newTitle as Title)
    setReadLink(`/read/${newTitle.id}`)
   }, 20000)
  }, [allTitles])

  useEffect(() => {
    try {
      const chaptersData = localStorage.getItem('chapters')
      if (!chaptersData) return

      const chapters: Record<string, string> = JSON.parse(chaptersData)
      const titleId = title.id || title.name.toLowerCase().replace(/\s+/g, '-')
      
      if (chapters[titleId]) {
        setSavedChapter(chapters[titleId])
        setReadLink(`/read/${titleId}/${chapters[titleId]}`)
      }
    } catch {
      // Keep default link
    }
  }, [title.id, title.name])

  return (
    <div className="relative w-full h-[60vh] min-h-[400px] overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src={title.thumb}
          alt={title.name}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
      </div>

      <div className="relative h-full flex flex-col justify-end p-8 md:p-12 max-w-2xl">
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 capitalize">
          {title.name.replaceAll('-', ' ')}
        </h1>
        
        <p className="text-gray-300 text-sm md:text-base mb-2">
          {title.caps} capítulos
        </p>
        
        <p className="text-gray-400 text-sm md:text-base mb-6 line-clamp-3">
          {title.description}
        </p>

        <div className="flex gap-4">
          <Link href={readLink}>
            <Button className="bg-white text-black hover:bg-gray-200 gap-2">
              <LucidePlay size={20} />
              {savedChapter ? `Continuar Cap. ${savedChapter}` : 'Ler agora'}
            </Button>
          </Link>
          <Link href={title.link}>
            <Button variant="outline" className="border-gray-500 text-white hover:bg-white/10 gap-2">
              <LucideInfo size={20} />
              Mais info
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
