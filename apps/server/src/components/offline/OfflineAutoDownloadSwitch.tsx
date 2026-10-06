'use client'

import { useEffect, useId, useState } from 'react'
import { Input } from '@/components/ui/input'
import {
  DEFAULT_DOWNLOAD_AHEAD,
  MAX_DOWNLOAD_AHEAD,
  getDownloadAhead,
  setDownloadAhead,
} from '@/utils/offline/config'

/** "Capítulos à frente": how many chapters after the open one to save offline (0 = off). */
export default function OfflineAutoDownloadSwitch({ compact = false }: { compact?: boolean }) {
  const id = useId()
  const [value, setValue] = useState(DEFAULT_DOWNLOAD_AHEAD)

  useEffect(() => {
    setValue(getDownloadAhead())
  }, [])

  return (
    <div className={compact ? 'flex items-center justify-between w-full px-4 gap-3' : 'flex flex-col gap-1'}>
      <label htmlFor={id} className="text-sm text-muted-foreground text-left">
        Capítulos à frente para baixar <span className="text-xs opacity-70">(0 desliga)</span>
      </label>
      <Input
        id={id}
        type="number"
        min={0}
        max={MAX_DOWNLOAD_AHEAD}
        value={value}
        className={compact ? 'w-20' : undefined}
        onChange={(e) => {
          const n = Math.min(MAX_DOWNLOAD_AHEAD, Math.max(0, parseInt(e.target.value, 10) || 0))
          setValue(n)
          setDownloadAhead(n)
        }}
      />
    </div>
  )
}
