import { fileUpload } from '@/lib/utils'
import i18n from '@/services/i18n'
import { parsePSRT } from '@/services/psrt/parserPSRT'
import { PSRTFile } from '@/services/psrt/types'
import { RefObject } from 'react'
import { Button } from '../ui/button'

export function LoadPSRTFile({
  onLoad,
  className,
  ref,
}: {
  onLoad: (_psrtFile: PSRTFile, _fileName: string) => void
  className?: string
  ref?: RefObject<HTMLLabelElement>
}) {
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    e.preventDefault()
    const file = e.target.files?.[0]


    if (file) {
      const text = await file.text()
      const parsedFile = parsePSRT(text)
      onLoad(parsedFile, file.name)
    }
  }

  return (
    <div className="flex w-full h-[100%]">
      <Button
        onClick={() => fileUpload(handleFileUpload)}
        className={className}
      >
        {i18n('Load')}
      </Button>
    </div>
  )
}
