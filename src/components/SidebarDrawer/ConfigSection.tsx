'use client'

import { useState } from 'react'
import { ChevronDown, Settings } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import i18n from '@/services/i18n'
import Connect from '@/components/SidebarDrawer/Connect'
import ImageDeformSettings from '@/components/SidebarDrawer/ImageDeformSettings'
import UpscaleSettings from '@/components/SidebarDrawer/UpscaleSettings'
import OfflineAutoDownloadSwitch from '@/components/offline/OfflineAutoDownloadSwitch'

export default function ConfigSection({
  showDeform,
  showUpscale,
}: {
  showDeform: boolean
  showUpscale: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full mt-2">
      <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground w-full px-4">
        <Settings size={16} />
        <span>{i18n('Settings')}</span>
        <ChevronDown
          size={16}
          className={cn('ml-auto transition-transform', isOpen && 'rotate-180')}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col items-center w-full gap-3 pt-2">
        <Connect />
        {showDeform && <ImageDeformSettings />}
        {showUpscale && <UpscaleSettings />}
        {showDeform && <OfflineAutoDownloadSwitch />}
      </CollapsibleContent>
    </Collapsible>
  )
}
