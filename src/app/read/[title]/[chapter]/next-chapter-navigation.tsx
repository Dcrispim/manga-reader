'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { isOffline } from '@/utils/offline/navigation'
import { useChapterReader } from './chapter-reader-context'

type NextChapterNavigationContextValue = {
  hasNext: boolean
  goToNextChapter: () => void
}

const NextChapterNavigationContext =
  createContext<NextChapterNavigationContextValue | null>(null)

export function useNextChapterNavigation() {
  const context = useContext(NextChapterNavigationContext)
  if (!context) {
    throw new Error(
      'useNextChapterNavigation must be used within a NextChapterNavigationProvider'
    )
  }
  return context
}

export default function NextChapterNavigationProvider({
  skippedChapters,
  children,
}: {
  skippedChapters: number
  children: ReactNode
}) {
  const router = useRouter()
  const { title, nextChapter, goToChapter } = useChapterReader()
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  const navigate = () => {
    if (!nextChapter) return
    // Offline, a client-side transition (a fetch for RSC data) fails
    // silently — swap chapters in place instead, in the same mounted page.
    if (isOffline()) goToChapter(nextChapter)
    else router.push(`/read/${title}/${nextChapter}`)
  }

  const goToNextChapter = () => {
    if (!nextChapter) return
    if (skippedChapters > 0) {
      setIsConfirmOpen(true)
      return
    }
    navigate()
  }

  const confirmSkip = () => {
    setIsConfirmOpen(false)
    navigate()
  }

  return (
    <NextChapterNavigationContext.Provider
      value={{ hasNext: Boolean(nextChapter), goToNextChapter }}
    >
      {children}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pular capítulos?</DialogTitle>
            <DialogDescription>
              {skippedChapters === 1
                ? 'O próximo capítulo disponível pula 1 capítulo.'
                : `O próximo capítulo disponível pula ${skippedChapters} capítulos.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmSkip}>Continuar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </NextChapterNavigationContext.Provider>
  )
}
