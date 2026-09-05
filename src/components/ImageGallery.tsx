import HandleFocus from '@/app/read/[title]/[chapter]/handle-focus'
import { useNextChapterNavigation } from '@/app/read/[title]/[chapter]/next-chapter-navigation'
import ChapterImage from './chapter-image'


export default function ImageGallery({
  images,
  zoom,
}: {
  images: string[]
  zoom: number
}) {
  const { hasNext, goToNextChapter } = useNextChapterNavigation()

  return (
    <div className='flex flex-col w-full justify-center items-center'>
      <HandleFocus />
      {images?.map((src, index) => (

        <ChapterImage
          key={index}
          src={src}
          alt={`Page ${index + 1}`}
          width={1200 * zoom}
          height={1200 * zoom}
        />
      ))}
      <div
        className={`w-full text-center${hasNext ? ' cursor-pointer' : ''}`}
        onClick={() => {
          if (hasNext) {
            goToNextChapter()
          }
        }}
      >
        END
      </div>
    </div>
  )
}
