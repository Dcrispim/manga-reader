'use client'

import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import i18n from '@/services/i18n'
import GridView from '@/components/GridView'
import Connect from '@/components/SidebarDrawer/Connect'
import { cn } from '@/lib/utils'

export default function SidebarDrawer({
  title,
  chapter,
  chapters,
  nextUrl,
  prevUrl,
}: {
  title: string
  chapter: string
  chapters: string[]
  nextUrl: string | null
  prevUrl: string | null
}) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const isLarge = window.innerWidth >= 1024
    setIsOpen(isLarge)

    const onResize = () => {
      if (window.innerWidth >= 1024) setIsOpen(true)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-50 lg:hidden bg-background border rounded-full p-3 shadow-lg"
        aria-label="Toggle sidebar"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Backdrop (mobile only) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer / sidebar */}
      <div
        className={cn(
          'flex flex-col items-center overflow-y-auto',
          // Mobile: fixed overlay drawer
          'fixed top-0 right-0 h-full w-72 bg-background border-l z-50 transition-transform duration-300',
          // Desktop: inline sidebar
          'lg:relative lg:w-[20%] lg:h-full lg:border-l-0 lg:translate-x-0 lg:transition-none lg:z-auto lg:bg-transparent',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Close button (mobile only) */}
        <button
          className="self-end m-3 lg:hidden"
          onClick={() => setIsOpen(false)}
          aria-label="Close sidebar"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center w-full px-4 gap-2">
          {chapter !== '@local' && nextUrl && (
            <Link className="w-full" href={nextUrl}>
              <Button className="w-full">
                <label>{i18n('Next')}</label>
              </Button>
            </Link>
          )}
          <Link className="w-full" href={`/read/${title}`}>
            <Button className="w-full">
              <label className="capitalize">{title.replaceAll('-', ' ')}</label>
            </Button>
          </Link>
          <Link className="w-full" href="/">
            <Button className="w-full">
              <label>{i18n('Home')}</label>
            </Button>
          </Link>
          {chapter !== '@local' && prevUrl && (
            <Link className="w-full" href={prevUrl}>
              <Button className="w-full">
                <label>{i18n('Previous')}</label>
              </Button>
            </Link>
          )}
        </div>

        <Connect />

        <GridView chapters={chapters} title={title} chapter={chapter} />
      </div>
    </>
  )
}
