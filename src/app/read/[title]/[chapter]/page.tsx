import { fetchData } from "@/services/fetch";
import ReadChapterClient from "./read-chapter-client";
import { getNextChapter, getSkippedChapterCount } from "@/utils/utils.server";
import SidebarDrawer from "@/components/SidebarDrawer";
import NextChapterNavigationProvider from "./next-chapter-navigation";
import ImageDeformProvider from "./image-deform";
import UpscaleSettingsProvider from "./upscale-settings";
import ChapterReaderProvider from "./chapter-reader-context";

export default async function ReadPage({
  params,
  searchParams,
}: {
  params: { title: string; chapter: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const { title, chapter } = params;
  const isOriginal = searchParams?.original === "true";
  const images: { images: string[] } = await fetchData(
    `/api/read/${title}/${chapter}`,
  );
  const titleInfos = await fetchData(`/api/read/${title}`);
  const nextChapter = getNextChapter(chapter, titleInfos?.chapters);
  const skippedChapters = getSkippedChapterCount(chapter, nextChapter);

  return (
    <ChapterReaderProvider
      title={title}
      initialChapter={chapter}
      initialImages={images.images || []}
      allChapters={titleInfos?.chapters || []}
    >
      <NextChapterNavigationProvider skippedChapters={skippedChapters}>
        <ImageDeformProvider title={title} chapter={chapter}>
          <UpscaleSettingsProvider
            title={title}
            chapter={chapter}
            nextChapter={nextChapter ? nextChapter.toString() : null}
            isOriginal={isOriginal}
          >
            <div className="flex flex-row w-full h-[100vh] pb-1 justify-between">
              <div className="flex flex-col w-full h-full">
                <ReadChapterClient
                  title={title}
                  isOriginal={isOriginal}
                />
              </div>
              <SidebarDrawer title={title} chapters={titleInfos.chapters} />
            </div>
          </UpscaleSettingsProvider>
        </ImageDeformProvider>
      </NextChapterNavigationProvider>
    </ChapterReaderProvider>
  );
}
