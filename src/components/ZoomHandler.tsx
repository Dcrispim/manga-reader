"use client"
import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { Slider } from '@/components/ui/slider';
import ImageGallery from './ImageGallery';


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
  zoom,
  setZoom,
}: {
  images: { images: string[] }
  title?: string
  zoom: number
  setZoom: Dispatch<SetStateAction<number>>
}) {
  const handleZoomChange = (value: number[]) => {
    setZoom(value[0]);
  };

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
    <div className="h-screen overflow-y-scroll w-full justify-center scroll-m-0 zoom">
      <div className="w-full px-4 py-2">
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
      <ImageGallery images={images.images} zoom={zoom}  nextChapter={`/read/${title}/last`}/>
    </div>
  );
}
