import { fetchData } from "@/services/fetch";
import ReadChapterClient from "./read-chapter-client";
import { getNextChapter, getSkippedChapterCount } from "@/utils/utils.server";
import SidebarDrawer from "@/components/SidebarDrawer";
import NextChapterNavigationProvider from "./next-chapter-navigation";

const getPreviousChapter = (
  currentChapter: string,
  chapters: number[],
): number | "" => {
  const sortedChapters = chapters?.sort((a, b) => a - b);
  const currentIndex = sortedChapters.indexOf(parseFloat(currentChapter));

  if (currentIndex === -1 || currentIndex === sortedChapters.length - 1) {
    return ""; // Return an empty string or handle the end of the list case
  }

  return sortedChapters[currentIndex - 1];
};

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
  const prevChapter = getPreviousChapter(
    chapter,
    titleInfos?.chapters.map((c: string) => parseFloat(c)),
  );
  const skippedChapters = getSkippedChapterCount(chapter, nextChapter);

  const handleNavigation = (direction: "next" | "prev") => {
    if (direction === "next" && nextChapter) {
      return `/read/${title}/${nextChapter}`;
    } else if (direction === "prev" && prevChapter) {
      return `/read/${title}/${prevChapter}`;
    }
    return null;
  };

  return (
    <NextChapterNavigationProvider
      nextChapterUrl={handleNavigation("next")}
      skippedChapters={skippedChapters}
    >
      <div className="flex flex-row w-full h-[100vh] pb-1 justify-between">
        <div className="flex flex-col w-full h-full">
          <ReadChapterClient
            images={images}
            title={title}
            prevChapter={prevChapter ? prevChapter.toString() : null}
            currentChapter={chapter}
            isOriginal={isOriginal}
          />
        </div>
        <SidebarDrawer
          title={title}
          chapter={chapter}
          chapters={titleInfos.chapters}
          nextUrl={handleNavigation("next")}
          prevUrl={handleNavigation("prev")}
        />
      </div>
    </NextChapterNavigationProvider>
  );
}
