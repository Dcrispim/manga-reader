'use client'

import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import i18n from '@/services/i18n'
import { useUpscaleSettings } from '@/app/read/[title]/[chapter]/upscale-settings'

export default function UpscaleSettings() {
  const { upscaleNextChapter, setUpscaleNextChapter } = useUpscaleSettings()

  return (
    <div className="flex items-center justify-between w-full px-4 gap-2">
      <Label htmlFor="upscale-next-chapter" className="text-sm">
        {i18n('Upscale next chapter')}
      </Label>
      <Switch
        id="upscale-next-chapter"
        checked={upscaleNextChapter}
        onCheckedChange={setUpscaleNextChapter}
      />
    </div>
  )
}
