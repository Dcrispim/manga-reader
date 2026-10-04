import { readdir, readFile, stat } from 'fs/promises'
import path from 'path'
import { cache } from 'react'
import { normalizeCategory } from '@/utils/categories'

const ROOT_PATH = '/mnt/d/manga'
const META_PATH = path.join(ROOT_PATH, '.meta')

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

export interface MetadataContent {
  categories: string[]
  author: string
  // Either a count ("17", split evenly across the chapter range) or a
  // comma list of chapter numbers where each volume starts ("1,23,40").
  volumes: string
  status: string
  type: string
  demographic: string
  published: string
  description: string
}

const EMPTY_METADATA: MetadataContent = {
  categories: [],
  author: '',
  volumes: '',
  status: '',
  type: '',
  demographic: '',
  published: '',
  description: '',
}

function parseMetadataFile(content: string): MetadataContent {
  const result: MetadataContent = { ...EMPTY_METADATA }

  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const [key, ...valueParts] = trimmed.split('=')
    const value = valueParts.join('=').trim()

    switch (key) {
      case 'categories':
        result.categories = value.split(',').map((c) => c.trim()).filter(Boolean)
        break
      case 'author':
      case 'authors':
        result.author = value
        break
      case 'volumes':
        result.volumes = value
        break
      case 'status':
        result.status = value
        break
      case 'type':
        result.type = value
        break
      case 'demographic':
        result.demographic = value
        break
      case 'published':
        result.published = value
        break
      case 'description':
      case 'synopsis':
      case 'sinopse':
        result.description = value
        break
    }
  }

  return result
}

export async function readMetadata(titleName: string): Promise<MetadataContent> {
  try {
    const metadataPath = path.join(META_PATH, `${titleName}.metadata`)
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
    const titles = await readdir(ROOT_PATH, { withFileTypes: true })

    const titleList = await Promise.all(
      titles
        .filter((dirent) => dirent.isDirectory() && !dirent.name.startsWith('.'))
        .map(async (dirent) => {
          const titlePath = path.join(ROOT_PATH, dirent.name)
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

export interface CategoryMap {
  [categoryId: string]: {
    name: string
    titles: string[]
  }
}

export const buildCategoryMap = cache(async (): Promise<CategoryMap> => {
  const titles = await getAllTitles()
  const categoryMap: CategoryMap = {}

  categoryMap['todos'] = {
    name: 'Todos',
    titles: titles.map((t) => t.name),
  }

  categoryMap['recentes'] = {
    name: 'Recentes',
    titles: [...titles]
      .sort((a, b) => b.modifiedAt - a.modifiedAt)
      .slice(0, 20)
      .map((t) => t.name),
  }

  for (const title of titles) {
    for (const category of title.categories) {
      const normalizedName = normalizeCategory(category)
      const categoryId = normalizedName.toLowerCase().replace(/\s+/g, '-')
      if (!categoryMap[categoryId]) {
        categoryMap[categoryId] = {
          name: normalizedName,
          titles: [],
        }
      }
      categoryMap[categoryId].titles.push(title.name)
    }
  }

  categoryMap['menos-de-100'] = {
    name: 'Menos de 100 capítulos',
    titles: titles.filter((t) => t.caps < 100).map((t) => t.name),
  }

  categoryMap['mais-de-200'] = {
    name: 'Mais de 200 capítulos',
    titles: titles.filter((t) => t.caps >= 200).map((t) => t.name),
  }

  categoryMap['mais-de-500'] = {
    name: 'Mais de 500 capítulos',
    titles: titles.filter((t) => t.caps >= 500).map((t) => t.name),
  }

  categoryMap['mais-de-1000'] = {
    name: 'Mais de 1000 capítulos',
    titles: titles.filter((t) => t.caps >= 1000).map((t) => t.name),
  }

  return categoryMap
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