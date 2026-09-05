export const getNextChapter = (
    currentChapter: string,
    chapters: number[]
  ): number | '' => {
    const sortedChapters = chapters
      .sort((a, b) => a - b)
      .map((v) => parseFloat(v.toString()))
    const currentIndex = sortedChapters.indexOf(parseFloat(currentChapter))
    if (currentIndex === -1 || currentIndex === sortedChapters.length - 1) {
      return '' // Return an empty string or handle the end of the list case
    }

    return sortedChapters[currentIndex + 1]
  }

export const getSkippedChapterCount = (
  currentChapter: string,
  nextChapter: number | ''
): number => {
  if (nextChapter === '') return 0
  const skipped = Math.floor(nextChapter) - Math.floor(parseFloat(currentChapter)) - 1
  return skipped > 0 ? skipped : 0
}