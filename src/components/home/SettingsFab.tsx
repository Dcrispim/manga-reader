'use client'

import { useState } from 'react'
import { Settings } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import Connect from '@/components/SidebarDrawer/Connect'
import RebuildSearchIndex from '@/components/home/RebuildSearchIndex'
import i18n from '@/services/i18n'

export default function SettingsFab() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="fixed bottom-4 right-4 z-40 flex items-center justify-center rounded-full border border-white/10 bg-black/40 p-3 text-white/60 shadow-lg backdrop-blur transition-colors hover:bg-black/60 hover:text-white"
          aria-label={i18n('Settings') as string}
        >
          <Settings size={18} />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{i18n('Settings')}</DialogTitle>
        </DialogHeader>
        <Connect />
        <RebuildSearchIndex />
      </DialogContent>
    </Dialog>
  )
}
