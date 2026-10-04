import { CHAPTERS_STORE, chapterKey, openDatabase, promisifyRequest } from './db'
import { getMaxGlobal, getMaxPerTitle } from './config'
import { emitOfflineChanged } from './events'
import { clearAllCachedTitles, deleteCachedTitleInfo } from './titleCache'
import type { OfflineChapterMeta, OfflineChapterRecord } from './types'

function toMeta(record: OfflineChapterRecord): OfflineChapterMeta {
  const { id, title, chapter, mimeTypes, savedAt, sizeBytes } = record
  return { id, title, chapter, mimeTypes, savedAt, sizeBytes }
}

export async function isChapterSaved(title: string, chapter: string): Promise<boolean> {
  const db = await openDatabase()
  const tx = db.transaction(CHAPTERS_STORE, 'readonly')
  const record = await promisifyRequest(tx.objectStore(CHAPTERS_STORE).get(chapterKey(title, chapter)))
  return Boolean(record)
}

export async function getChapterRecord(
  title: string,
  chapter: string
): Promise<OfflineChapterRecord | undefined> {
  const db = await openDatabase()
  const tx = db.transaction(CHAPTERS_STORE, 'readonly')
  return promisifyRequest(tx.objectStore(CHAPTERS_STORE).get(chapterKey(title, chapter)))
}

const inFlightRecordReads = new Map<string, Promise<OfflineChapterRecord | undefined>>()

// Same as getChapterRecord, but when a chapter's images fail all at once
// (e.g. the whole thing is unreachable), every <ChapterImage> in it falls
// back at roughly the same time — this dedupes those into a single
// IndexedDB read of the (potentially large) blob array instead of one per
// image.
export function getChapterRecordCached(title: string, chapter: string): Promise<OfflineChapterRecord | undefined> {
  const key = chapterKey(title, chapter)
  let pending = inFlightRecordReads.get(key)
  if (!pending) {
    pending = getChapterRecord(title, chapter).finally(() => {
      inFlightRecordReads.delete(key)
    })
    inFlightRecordReads.set(key, pending)
  }
  return pending
}

export async function listAllChapters(): Promise<OfflineChapterMeta[]> {
  const db = await openDatabase()
  const tx = db.transaction(CHAPTERS_STORE, 'readonly')
  const records = (await promisifyRequest(tx.objectStore(CHAPTERS_STORE).getAll())) as OfflineChapterRecord[]
  return records.map(toMeta)
}

export async function listChaptersByTitle(title: string): Promise<OfflineChapterMeta[]> {
  const db = await openDatabase()
  const tx = db.transaction(CHAPTERS_STORE, 'readonly')
  const index = tx.objectStore(CHAPTERS_STORE).index('title')
  const records = (await promisifyRequest(index.getAll(IDBKeyRange.only(title)))) as OfflineChapterRecord[]
  return records.map(toMeta)
}

export async function deleteChapter(title: string, chapter: string): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction(CHAPTERS_STORE, 'readwrite')
  await promisifyRequest(tx.objectStore(CHAPTERS_STORE).delete(chapterKey(title, chapter)))
  emitOfflineChanged()
}

export async function deleteTitle(title: string): Promise<void> {
  const chapters = await listChaptersByTitle(title)
  const db = await openDatabase()
  const tx = db.transaction(CHAPTERS_STORE, 'readwrite')
  const store = tx.objectStore(CHAPTERS_STORE)
  await Promise.all(chapters.map((c) => promisifyRequest(store.delete(c.id))))
  await deleteCachedTitleInfo(title)
  emitOfflineChanged()
}

export async function deleteAllChapters(): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction(CHAPTERS_STORE, 'readwrite')
  await promisifyRequest(tx.objectStore(CHAPTERS_STORE).clear())
  await clearAllCachedTitles()
  emitOfflineChanged()
}

async function deleteOldest(
  candidates: OfflineChapterMeta[],
  excludeId: string
): Promise<OfflineChapterMeta | undefined> {
  const oldest = candidates.filter((c) => c.id !== excludeId).sort((a, b) => a.savedAt - b.savedAt)[0]
  if (oldest) await deleteChapter(oldest.title, oldest.chapter)
  return oldest
}

// Prunes the oldest chapters so storage respects the per-title and global
// limits. Only runs while online — a device with no connectivity can't
// re-download what it evicts, so automatic cleanup must wait until it can.
// The chapter that was just saved is never evicted by its own save.
export async function enforceLimits(justSavedId: string): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return

  const justSaved = (await listAllChapters()).find((c) => c.id === justSavedId)
  if (!justSaved) return

  const maxPerTitle = getMaxPerTitle()
  let byTitle = await listChaptersByTitle(justSaved.title)
  while (byTitle.length > maxPerTitle) {
    const removed = await deleteOldest(byTitle, justSavedId)
    if (!removed) break
    byTitle = byTitle.filter((c) => c.id !== removed.id)
  }

  const maxGlobal = getMaxGlobal()
  let all = await listAllChapters()
  while (all.length > maxGlobal) {
    const removed = await deleteOldest(all, justSavedId)
    if (!removed) break
    all = all.filter((c) => c.id !== removed.id)
  }
}

export async function saveChapter(
  title: string,
  chapter: string,
  images: Blob[],
  mimeTypes: string[]
): Promise<void> {
  const id = chapterKey(title, chapter)
  const sizeBytes = images.reduce((sum, blob) => sum + blob.size, 0)
  const record: OfflineChapterRecord = {
    id,
    title,
    chapter,
    images,
    mimeTypes,
    savedAt: Date.now(),
    sizeBytes,
  }

  const db = await openDatabase()
  const tx = db.transaction(CHAPTERS_STORE, 'readwrite')
  await promisifyRequest(tx.objectStore(CHAPTERS_STORE).put(record))
  emitOfflineChanged()

  await enforceLimits(id)
}

// Swaps a persisted chapter's images for a higher-resolution set (the
// background high-res upgrade — see highRes.ts) without touching savedAt or
// re-running eviction: it's the same chapter the user already downloaded,
// just better quality, not a new download. Returns false (no-op) if the
// chapter was removed in the meantime, so a slow upgrade can never resurrect
// a chapter the user deleted.
export async function upgradeChapterImages(
  title: string,
  chapter: string,
  images: Blob[],
  mimeTypes: string[]
): Promise<boolean> {
  const db = await openDatabase()
  const tx = db.transaction(CHAPTERS_STORE, 'readwrite')
  const store = tx.objectStore(CHAPTERS_STORE)
  const existing = (await promisifyRequest(store.get(chapterKey(title, chapter)))) as
    | OfflineChapterRecord
    | undefined
  if (!existing) return false

  const sizeBytes = images.reduce((sum, blob) => sum + blob.size, 0)
  await promisifyRequest(store.put({ ...existing, images, mimeTypes, sizeBytes }))
  emitOfflineChanged()
  return true
}
