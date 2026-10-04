'use client'

import { useEffect, useState } from 'react'
import { Switch } from '@/components/ui/switch'
import i18n from '@/services/i18n'
import { getAutoDownloadNext, setAutoDownloadNext } from '@/utils/offline/config'

export default function OfflineAutoDownloadSwitch() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    setEnabled(getAutoDownloadNext())
  }, [])

  return (
    <div className="flex items-center justify-between w-full px-4 gap-3">
      <label htmlFor="auto-download-next" className="text-sm text-muted-foreground text-left">
        {i18n('Download next chapter automatically')}
      </label>
      <Switch
        id="auto-download-next"
        checked={enabled}
        onCheckedChange={(value) => {
          setEnabled(value)
          setAutoDownloadNext(value)
        }}
      />
    </div>
  )
}
