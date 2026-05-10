import { useEffect } from 'react'

import HandleFocus from '@/app/read/[title]/[chapter]/handle-focus'
import Image from 'next/image'
import ChapterImage from './chapter-image'


export default function ImageGallery({
  images,
  zoom,
  nextChapter
}: {
  images: string[]
  zoom: number
  nextChapter?: string

}) {


  return (
    <div className='flex flex-col w-full justify-center items-center'>
      <HandleFocus />
      {images?.map((src, index) => (

        <ChapterImage
          key={index}
          src={src}
          alt={`Page ${index + 1}`}
          width={1200 * zoom}
          height={1200 * zoom}
        />
      ))}
      {
        nextChapter ? <a href={nextChapter}>
          <div className='w-full text-center'>END</div>
        </a> : <div className='w-full text-center'>END</div>
      }
    </div>
  )
}
