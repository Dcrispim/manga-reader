'use client'

import { Slider } from '@/components/ui/slider'
import i18n from '@/services/i18n'
import { useImageDeform } from '@/app/read/[title]/[chapter]/image-deform'

const MIN = -20
const MAX = 20
const STEP = 1

export default function ImageDeformSettings() {
  const { horizontal, vertical, setHorizontal, setVertical } = useImageDeform()

  return (
    <div className="flex flex-col items-center w-full px-4 gap-2">
      <div className="w-full">
        <label className="block text-center text-sm">
          {i18n('Horizontal deform')} ({horizontal > 0 ? '+' : ''}
          {horizontal}%)
        </label>
        <Slider
          className="w-full"
          value={[horizontal]}
          min={MIN}
          max={MAX}
          step={STEP}
          onValueChange={(value) => setHorizontal(value[0])}
        />
      </div>

      <div className="w-full">
        <label className="block text-center text-sm">
          {i18n('Vertical deform')} ({vertical > 0 ? '+' : ''}
          {vertical}%)
        </label>
        <Slider
          className="w-full"
          value={[vertical]}
          min={MIN}
          max={MAX}
          step={STEP}
          onValueChange={(value) => setVertical(value[0])}
        />
      </div>
    </div>
  )
}
