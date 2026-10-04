'use client'
import { Reader } from '@/components/Reader'
import i18n from '@/services/i18n'
import { ChapterType } from '@/services/psrt/types'
import { LucideArrowLeft } from 'lucide-react'
import { useState } from 'react'

export default function ReadPage() {
  const [title, setTitle] = useState('local file')
  const [images, setImages] = useState({
    psrtContent: '',
  } )

  return (
    <div className="w-full h-screen flex justify-center">
      {!images.psrtContent && (
        <div className="flex flex-col w-full h-auto justify-center items-center">
          <a className="flex flex-row" href="/">
            <div className="w-14 mt-2 flex items-center justify-between px-1 hover:border-b">
              <LucideArrowLeft size={15} />
              <label className="font-normal text-xs hover:bg-transparent">
                {i18n('Home')}
              </label>
            </div>
          </a>
        </div>
      )}
      {images.psrtContent && (
        <Reader
          title={title}
          images={images as ChapterType}
          chapter="@local"
          setImages={(psrtContent) => {
            setImages({ psrtContent })
          }}
        />
      )}
    </div>
  )
}
