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
  nextChapterUrl,
  skippedChapters,
  children,
}: {
  nextChapterUrl: string | null
  skippedChapters: number
  children: ReactNode
}) {
  const router = useRouter()
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  const goToNextChapter = () => {
    if (!nextChapterUrl) return
    if (skippedChapters > 0) {
      setIsConfirmOpen(true)
      return
    }
    router.push(nextChapterUrl)
  }

  const confirmSkip = () => {
    setIsConfirmOpen(false)
    if (nextChapterUrl) router.push(nextChapterUrl)
  }

  return (
    <NextChapterNavigationContext.Provider
      value={{ hasNext: Boolean(nextChapterUrl), goToNextChapter }}
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
