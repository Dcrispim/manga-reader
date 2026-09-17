"use client"
import { useEffect, useRef, useState, type Dispatch, type SetStateAction, type UIEvent } from 'react';
import Link from 'next/link';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ImageGallery from './ImageGallery';

// Below this scrollTop the bar always shows, regardless of direction — so it
// doesn't hide right at the top of the chapter after a tiny downward nudge.
const ALWAYS_VISIBLE_SCROLL_TOP = 10


const SCROLL_PERCENT_MIN = 10
const SCROLL_PERCENT_MAX = 95

function scrollPercentForDigit(digit: number): number {
  return (
    SCROLL_PERCENT_MIN +
    ((digit - 1) / 8) * (SCROLL_PERCENT_MAX - SCROLL_PERCENT_MIN)
  )
}


export default function ZoomHandler({
  images,
  title,
  currentChapter,
  zoom,
  setZoom,
  isOriginal,
}: {
  images: { images: string[] }
  title?: string
  currentChapter?: string
  zoom: number
  setZoom: Dispatch<SetStateAction<number>>
  isOriginal?: boolean
}) {
  const handleZoomChange = (value: number[]) => {
    setZoom(value[0]);
  };

  const [toolbarVisible, setToolbarVisible] = useState(true)
  const lastScrollTop = useRef(0)

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const scrollTop = event.currentTarget.scrollTop

    if (scrollTop < ALWAYS_VISIBLE_SCROLL_TOP || scrollTop < lastScrollTop.current) {
      setToolbarVisible(true)
    } else if (scrollTop > lastScrollTop.current) {
      setToolbarVisible(false)
    }
    lastScrollTop.current = scrollTop
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null
      if (el?.closest('input, textarea, select, [contenteditable="true"]')) {
        return
      }
      if (!/^[1-9]$/.test(event.key)) return
      console.log(event.key);
      
      const digit = Number.parseInt(event.key, 10)
      const percent = scrollPercentForDigit(digit)
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight
      const top = (maxScroll * percent) / 100
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="relative h-screen w-full">
      <div
        className={cn(
          'absolute top-0 left-0 right-0 z-40 flex flex-row items-center w-full px-4 py-2 gap-4 bg-background/90 backdrop-blur border-b border-border transition-transform duration-300',
          toolbarVisible ? 'translate-y-0' : '-translate-y-full'
        )}
      >
        <div className="flex-1">
          <label className="block text-center">Zoom</label>
          <Slider
            className="w-full"
            value={[zoom]}
            min={0.5}
            max={2}
            step={0.01}
            onValueChange={handleZoomChange}
          />
        </div>
        {title && currentChapter && (
          isOriginal ? (
            <Link
              href={{ pathname: `/read/${title}/${currentChapter}` }}
              scroll={false}
            >
              <Button variant="outline">Ver upscalada</Button>
            </Link>
          ) : (
            <Link
              href={{
                pathname: `/read/${title}/${currentChapter}`,
                query: { original: "true" },
              }}
              scroll={false}
            >
              <Button variant="outline">Ver original</Button>
            </Link>
          )
        )}
      </div>
      <div
        className="h-screen overflow-y-scroll w-full justify-center scroll-m-0 zoom"
        onScroll={handleScroll}
      >
        <ImageGallery images={images.images} zoom={zoom} />
      </div>
    </div>
  );
}
