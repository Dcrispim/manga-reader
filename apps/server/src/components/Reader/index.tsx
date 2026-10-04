'use client'

import Slider from '@/components/Slider'
import i18n from '@/services/i18n'
import { ChevronLeft, ChevronRight, Home } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { LoadPSRTFile } from '../LoadPSRTFile'
import { stringifyPsrt } from '@/services/psrt/parserPSRT'
import { Button } from '../ui/button'
import { ChapterType } from '@/services/psrt/types'
import { PsrtListImage } from '../PsrtListImage'
export function Reader({
  title,
  chapter,
  images,
  setImages,
  chapters,
  nextChapter,
  previousChapter,
}: {
  images: ChapterType
  title: string
  chapter: string | '@local'
  chapters?: string[]
  nextChapter?: string
  previousChapter?: string
  setImages?: (s: string) => void
}) {
  const [zoom, setZoom] = useState(49) // Initial zoom level
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    handleResize() // Check on initial load
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleZoomChange = (value: number) => {
    setZoom(value)
  }
  useEffect(() => {
    images && setZoom(50)
  }, [images])

  return (
    <div className="flex flex-row w-full">
      <PsrtListImage
        psrtData={images.psrtContent}
        params={{
          chapter,
          title,
        }}
        zoom={zoom}
      />
      <div className="flex flex-col items-center w-[20%]">
        <div className="flex flex-col items-center w-full px-4">
          {chapter !== '@local' && (
            <Link
              className="w-full"
              href={
                nextChapter
                  ? `/read/${title}/${nextChapter}`
                  : `/title/${title}`
              }
            >
              <Button>
                <label>{isMobile ? <ChevronRight /> : i18n('Next')}</label>
              </Button>
            </Link>
          )}

          <Link className="w-full" href="/">
            <Button>
              <label>{isMobile ? <Home className="" /> : i18n('Home')}</label>
            </Button>
          </Link>

          {chapter !== '@local' && (
            <Link
              className="w-full"
              href={
                previousChapter
                  ? `/read/${title}/${previousChapter}`
                  : `/title/${title}`
              }
            >
              <Button>
                <label>{isMobile ? <ChevronLeft /> : i18n('Previous')}</label>
              </Button>
            </Link>
          )}
          {chapter === '@local' && (
            <LoadPSRTFile
              onLoad={(psrtFile, fileName) => {
                setZoom(0)
                setImages?.(stringifyPsrt(psrtFile))
                setZoom(50)
              }}
            />
          )}
        </div>

        <div className="px-4 w-full pt-4">
          <Slider
            onChange={handleZoomChange}
            value={zoom}
            min={5}
            valueFormater={(v) => `${v}%`}
            orientation={isMobile ? 'vertical' : 'horizontal'}
          />
        </div>

        {!isMobile && chapters && (
          <div
            id="chapters-grid"
            className="grid grid-cols-[repeat(auto-fit,_minmax(2rem,_1fr))] gap-3 w-full px-5"
          >
            {chapters.map((chap: string) => (
              <Link key={chap} href={`/read/${title}/${chap}`}>
                <div>
                  <Button variant={'outline'}> {parseFloat(chap)}</Button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
