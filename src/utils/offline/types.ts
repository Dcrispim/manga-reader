export type OfflineChapterRecord = {
  id: string
  title: string
  chapter: string
  images: Blob[]
  mimeTypes: string[]
  savedAt: number
  sizeBytes: number
}

export type OfflineChapterMeta = Omit<OfflineChapterRecord, 'images'>

export type OfflineTitleMetadata = {
  categories: string[]
  author: string
  volumes: string
  status: string
  type: string
  demographic: string
  published: string
  description: string
}

export type OfflineTitleRecord = {
  id: string
  name: string
  chapters: string[]
  modified: Record<string, number>
  metadata: OfflineTitleMetadata
  thumb: Blob | null
  cachedAt: number
}
