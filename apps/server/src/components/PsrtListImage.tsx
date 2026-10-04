import ImagePsrt from '@/components/ImagePsrt'
import i18n from '@/services/i18n'
import { parsePSRT } from '@/services/psrt/parserPSRT'

export function PsrtListImage({
  psrtData,
  zoom,
  params: { chapter, title },
}: {
  psrtData: string
  zoom: number
  params: { title: string; chapter: string }
}) {
  const { sections } = parsePSRT(psrtData)

  return (
    <div className="flex flex-col items-center w-full h-screen overflow-auto scroll-m-1">
      {sections.map((page, i) => (
        <div key={`${title}/${chapter}-${i}`} style={{ width: `${zoom}%` }}>
          <ImagePsrt
            pageData={{
              title: page.title,
              entries: page.entries,
            }}
            pageLink={page.pageLink}
            alt={`${title}/${chapter}`}
            parentZoom={zoom}
          />
        </div>
      ))}
      <div className="w-full h-4 bg-black items-center text-center">
        {i18n('END')}
      </div>
    </div>
  )
}
