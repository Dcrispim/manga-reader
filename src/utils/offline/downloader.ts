import { saveChapter } from './store'
import { cacheTitleInfo, getCachedTitleInfo } from './titleCache'
import { getDownloadHighRes } from './config'
import { maybeUpgradeToHighRes } from './highRes'

export async function downloadChapterImages(
  title: string,
  chapter: string,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const listRes = await fetch(`/api/read/${title}/${chapter}`)
  if (!listRes.ok) throw new Error('Não foi possível obter a lista de páginas')
  const { images: paths } = (await listRes.json()) as { images: string[] }
  if (!paths?.length) throw new Error('Capítulo sem páginas')

  const blobs: Blob[] = []
  const mimeTypes: string[] = []

  for (let i = 0; i < paths.length; i++) {
    const res = await fetch(paths[i])
    if (!res.ok) throw new Error(`Falha ao baixar a página ${i + 1}`)
    const blob = await res.blob()
    blobs.push(blob)
    mimeTypes.push(blob.type || 'image/jpeg')
    onProgress?.(i + 1, paths.length)
  }

  await saveChapter(title, chapter, blobs, mimeTypes)

  // Offline-first isn't just the chapter's pages — the cover and metadata
  // shown on the title/home screens should survive going offline too.
  // Best-effort and non-blocking: never delays or fails the download itself.
  // Only fetched once per title — downloading several chapters in a row
  // shouldn't re-fetch metadata/thumb/chapter-list for each one; browsing
  // the title page is what keeps this cache fresh afterwards.
  const cached = await getCachedTitleInfo(title)
  if (!cached) cacheTitleInfo(title)

  // Secondary, optional upgrade: the chapter is already safely saved above
  // with its original pages — this never delays or blocks that. If enabled,
  // it checks for (or waits a bounded amount of time for) a high-res copy
  // and swaps it in once ready. See highRes.ts.
  if (getDownloadHighRes()) {
    maybeUpgradeToHighRes(title, chapter)
  }
}
