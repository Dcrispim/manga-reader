import { readdir, readFile, stat } from 'fs/promises'
import path from 'path'
import { cache } from 'react'
import {
  EMPTY_METADATA,
  parseMetadataFile,
  buildCategoryMap as buildCoreCategoryMap,
  type CategoryMap,
  type MetadataContent,
} from '@manga/core'
import { MANGA_ROOT, META_DIR } from '@/utils/paths.server'

export type { CategoryMap, MetadataContent }

export interface TitleInfo {
  id: string
  name: string
  thumb: string
  description: string
  caps: number
  link: string
  modifiedAt: number
  categories: string[]
  author: string
}

export async function readMetadata(titleName: string): Promise<MetadataContent> {
  try {
    const metadataPath = path.join(META_DIR, `${titleName}.metadata`)
    const content = await readFile(metadataPath, 'utf-8')
    return parseMetadataFile(content)
  } catch {
    return { ...EMPTY_METADATA }
  }
}

// Cached per render/build so that the many calls fanning out from
// getCategories()/getTitlesByCategory() don't each re-scan the whole
// manga library on disk.
export const getAllTitles = cache(async (): Promise<TitleInfo[]> => {
  try {
    const titles = await readdir(MANGA_ROOT, { withFileTypes: true })

    const titleList = await Promise.all(
      titles
        .filter((dirent) => dirent.isDirectory() && !dirent.name.startsWith('.'))
        .map(async (dirent) => {
          const titlePath = path.join(MANGA_ROOT, dirent.name)
          const caps = await readdir(titlePath, { withFileTypes: true })
          const stats = await stat(titlePath)
          const metadata = await readMetadata(dirent.name)

          return {
            id: dirent.name.toLowerCase().replace(/\s+/g, '-'),
            name: dirent.name,
            thumb: `/api/read/${dirent.name}/01/thumb`,
            description: metadata.author ? `Por ${metadata.author}` : `Description for ${dirent.name}`,
            caps: caps.filter((c) => c.isDirectory()).length,
            link: `/read/${dirent.name.toLowerCase().replace(/\s+/g, '-')}`,
            modifiedAt: stats.mtimeMs,
            categories: metadata.categories,
            author: metadata.author,
          }
        })
    )

    return titleList
  } catch {
    return []
  }
})

export const buildCategoryMap = cache(async (): Promise<CategoryMap> => {
  return buildCoreCategoryMap(await getAllTitles())
})

export async function getCategories(): Promise<{ id: string; name: string; count: number }[]> {
  const categoryMap = await buildCategoryMap()

  const priorityOrder = ['todos', 'recentes', 'menos-de-100', 'mais-de-200', 'mais-de-500', 'mais-de-1000']

  const categories = Object.entries(categoryMap)
    .map(([id, data]) => ({
      id,
      name: data.name,
      count: data.titles.length,
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => {
      const aIndex = priorityOrder.indexOf(a.id)
      const bIndex = priorityOrder.indexOf(b.id)

      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
      if (aIndex !== -1) return -1
      if (bIndex !== -1) return 1

      return a.name.localeCompare(b.name)
    })

  return categories
}

export async function getTitlesByCategory(categoryId: string): Promise<Omit<TitleInfo, 'modifiedAt' | 'categories' | 'author'>[]> {
  const categoryMap = await buildCategoryMap()
  const allTitles = await getAllTitles()

  const category = categoryMap[categoryId]
  if (!category) {
    return []
  }

  const titleNames = new Set(category.titles)
  const filteredTitles = allTitles
    .filter((t) => titleNames.has(t.name))
    .map(({ modifiedAt, categories, author, ...rest }) => rest)

  return filteredTitles
}

export async function getMetadata(titleName: string): Promise<MetadataContent> {
  return await readMetadata(titleName)
}