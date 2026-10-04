import { TITLES_STORE, openDatabase, promisifyRequest } from './db'
import { emitOfflineChanged } from './events'
import type { OfflineTitleMetadata, OfflineTitleRecord } from './types'

async function fetchThumbBlob(title: string): Promise<Blob | null> {
  try {
    const res = await fetch(`/api/read/${title}/01/thumb`)
    if (!res.ok) return null
    return await res.blob()
  } catch {
    return null
  }
}

// Caches everything a library/title screen needs to render — cover,
// metadata, and the chapter list — not just the page images a chapter
// download stores. Called both right after a chapter download and whenever
// the title page is browsed online, so offline availability tracks normal
// usage rather than requiring a separate, explicit "save this title" step.
// Best-effort: never throws, since this is always a background convenience.
export async function cacheTitleInfo(
  title: string,
  data?: { chapters?: string[]; modified?: Record<string, number>; metadata?: Partial<OfflineTitleMetadata> }
): Promise<void> {
  try {
    const [chapterData, metadataRes, thumb] = await Promise.all([
      data?.chapters ? Promise.resolve({ chapters: data.chapters, modified: data.modified || {} }) : fetch(`/api/read/${title}`).then((r) => r.json()),
      data?.metadata ? Promise.resolve(data.metadata) : fetch(`/api/metadata/${title}`).then((r) => r.json()),
      fetchThumbBlob(title),
    ])

    const db = await openDatabase()
    const tx = db.transaction(TITLES_STORE, 'readwrite')
    const record: OfflineTitleRecord = {
      id: title,
      name: title,
      chapters: chapterData.chapters || [],
      modified: chapterData.modified || {},
      metadata: {
        categories: metadataRes.categories || [],
        author: metadataRes.author || '',
        volumes: metadataRes.volumes || '',
        status: metadataRes.status || '',
        type: metadataRes.type || '',
        demographic: metadataRes.demographic || '',
        published: metadataRes.published || '',
        description: metadataRes.description || '',
      },
      thumb,
      cachedAt: Date.now(),
    }
    await promisifyRequest(tx.objectStore(TITLES_STORE).put(record))
    emitOfflineChanged()
  } catch {
    // Best-effort cache — a failure here must never break the caller's own
    // flow (a chapter download or a normal page view).
  }
}

export async function getCachedTitleInfo(title: string): Promise<OfflineTitleRecord | undefined> {
  const db = await openDatabase()
  const tx = db.transaction(TITLES_STORE, 'readonly')
  return promisifyRequest(tx.objectStore(TITLES_STORE).get(title))
}

export async function listCachedTitles(): Promise<OfflineTitleRecord[]> {
  const db = await openDatabase()
  const tx = db.transaction(TITLES_STORE, 'readonly')
  return promisifyRequest(tx.objectStore(TITLES_STORE).getAll())
}

export async function deleteCachedTitleInfo(title: string): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction(TITLES_STORE, 'readwrite')
  await promisifyRequest(tx.objectStore(TITLES_STORE).delete(title))
}

export async function clearAllCachedTitles(): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction(TITLES_STORE, 'readwrite')
  await promisifyRequest(tx.objectStore(TITLES_STORE).clear())
}
