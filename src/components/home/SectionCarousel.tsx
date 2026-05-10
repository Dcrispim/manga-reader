'use client'
import { useRef, useState, useCallback, useEffect, JSX } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { Title } from '@/types/api'
import { LucideChevronLeft, LucideChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PreviewCardProps {
  item: Title
}

function PreviewCard({ item }: PreviewCardProps) {
  const [isHovering, setIsHovering] = useState(false)
  const [previewImages, setPreviewImages] = useState<string[]>([])
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const slideIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const clearTimers = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    if (slideIntervalRef.current) {
      clearInterval(slideIntervalRef.current)
      slideIntervalRef.current = null
    }
  }, [])

  const fetchPreviewImages = useCallback(async () => {
    try {
      const response = await fetch(`/api/read/${item.name}/01`)
      const data = await response.json()
      if (data.images && data.images.length > 0) {
        const limitedImages = data.images.slice(0, 10)
        setPreviewImages(limitedImages)
        setCurrentImageIndex(0)

        slideIntervalRef.current = setInterval(() => {
          setIsTransitioning(true)
          setTimeout(() => {
            setCurrentImageIndex((prev) => (prev + 1) % limitedImages.length)
            setIsTransitioning(false)
          }, 300)
        }, 3000)
      }
    } catch {
      setPreviewImages([])
    }
  }, [item.name])

  const handleMouseEnter = useCallback(() => {
    setIsHovering(true)
    hoverTimeoutRef.current = setTimeout(() => {
      fetchPreviewImages()
    }, 2000)
  }, [fetchPreviewImages])

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false)
    clearTimers()
    setPreviewImages([])
    setCurrentImageIndex(0)
    setIsTransitioning(false)
  }, [clearTimers])

  useEffect(() => {
    return () => clearTimers()
  }, [clearTimers])

  const showPreview = previewImages.length > 0
  const currentImage = showPreview ? previewImages[currentImageIndex] : item.thumb

  return (
    <Link href={item.link} className="flex-shrink-0 group/card">
      <div
        className="relative w-36 md:w-44 aspect-[2/3] rounded-md overflow-hidden"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Image
          src={item.thumb}
          alt={item.name}
          fill
          className={cn(
            'object-cover transition-all duration-300',
            isHovering && 'scale-110',
            showPreview && 'opacity-0'
          )}
        />
        
        {showPreview && (
          <Image
            src={currentImage}
            alt={`${item.name} preview`}
            fill
            className={cn(
              'object-cover transition-opacity duration-300 scale-110',
              isTransitioning ? 'opacity-0' : 'opacity-100'
            )}
          />
        )}

        <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/20 transition-colors duration-300" />
        
        {showPreview && (
          <div className="absolute top-2 left-0 right-0 flex justify-center gap-1 px-2">
            {previewImages.map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  'h-0.5 flex-1 rounded-full transition-colors duration-200',
                  idx === currentImageIndex ? 'bg-white' : 'bg-white/40'
                )}
              />
            ))}
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
          <p className="text-white text-sm font-medium truncate capitalize">
            {item.name.replaceAll('-', ' ')}
          </p>
          <p className="text-gray-400 text-xs">{item.caps} caps</p>
        </div>
      </div>
    </Link>
  )
}

interface SectionCarouselProps {
  title: string|JSX.Element
  titles: Title[]
}

export default function SectionCarousel({ title, titles }: SectionCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    const scrollAmount = scrollRef.current.clientWidth * 0.8
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    })
  }

  if (titles.length === 0) return null

  return (
    <section className="relative group/section px-4 md:px-8">
      <h2 className="text-xl md:text-2xl font-bold text-white mb-4">{title}</h2>

      <div className="relative">
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
          {titles.map((item, index) => (
            <PreviewCard key={`${item.id}-${index}`} item={item} />
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
