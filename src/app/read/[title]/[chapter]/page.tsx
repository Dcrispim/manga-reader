import GridView from '@/components/GridView'; // Import the new component
import { Button } from '@/components/ui/button'
import { fetchData } from '@/services/fetch'
import i18n from '@/services/i18n'
import Link from 'next/link'
import ReadChapterClient from './read-chapter-client'
import { getNextChapter } from '@/utils/utils.server';




const getPreviousChapter = (
  currentChapter: string,
  chapters: number[]
): number | '' => {
  const sortedChapters = chapters.sort((a, b) => a - b)
  const currentIndex = sortedChapters.indexOf(parseFloat(currentChapter))

  if (currentIndex === -1 || currentIndex === sortedChapters.length - 1) {
    return '' // Return an empty string or handle the end of the list case
  }

  return sortedChapters[currentIndex - 1]
}


export default async function ReadPage({
  params,
  searchParams
}: {
  params: { title: string; chapter: string },
  searchParams?: { [key: string]: string | string[] | undefined }
}) {
  const { title, chapter } = params;
  const isOriginal = searchParams?.original === 'true';
  const images: { images: string[] } = await fetchData(`/api/read/${title}/${chapter}`);
  const titleInfos = await fetchData(`/api/read/${title}`);
  const nextChapter = getNextChapter(chapter, titleInfos?.chapters);
  const prevChapter = getPreviousChapter(chapter, titleInfos?.chapters.map((c:string) => parseFloat(c)));

  const handleNavigation = (direction: 'next' | 'prev') => {
    if (direction === 'next' && nextChapter) {
      return `/read/${title}/${nextChapter}`;
    } else if (direction === 'prev' && prevChapter) {
      return `/read/${title}/${prevChapter}`;
    }
    return null;
  };

  return (
    <div className="flex flex-row w-full h-[100vh] pb-1 justify-between">
      <div className="flex flex-col w-full h-full">
        <div className="flex flex-row w-full justify-end p-2 gap-2">
          {isOriginal ? (
            <Link href={{ pathname: `/read/${title}/${chapter}` }} scroll={false}>
              <Button variant="outline">Ver upscalada</Button>
            </Link>
          ) : (
            <Link href={{ pathname: `/read/${title}/${chapter}`, query: { original: 'true' } }} scroll={false}>
              <Button variant="outline">Ver original</Button>
            </Link>
          )}
        </div>
        <ReadChapterClient
          images={images}
          title={title}
          nextChapter={nextChapter ? nextChapter.toString() : null}
          prevChapter={prevChapter ? prevChapter.toString() : null}
          currentChapter={chapter}
        />
      </div>
      <div className="flex flex-col items-center w-[20%]">
        <div className="flex flex-col items-center w-full px-4">
          {chapter !== '@local' && (
            <Link
              className="w-full"
              href={handleNavigation('next') || `/title/${title}`}
            >
              <Button>
                <label>{i18n('Next')}</label>
              </Button>
            </Link>
          )}
          <Link className="w-full" href={`/read/${title}`}>
            <Button>
              <label className='capitalize'>{title.replaceAll("-"," ")}</label>
            </Button>
          </Link>
          <Link className="w-full" href={`/`}>
            <Button>
              <label>{i18n('Home')}</label>
            </Button>
          </Link>
          {chapter !== '@local' && (
            <Link
              className="w-full"
              href={handleNavigation('prev') || `/title/${title}`}
            >
              <Button>
                <label>{i18n('Previous')}</label>
              </Button>
            </Link>
          )}
        </div>
        <GridView chapters={titleInfos.chapters} title={title} chapter={chapter} />
      </div>
    </div>
  )
}
