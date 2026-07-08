import { readdir, readFile, stat } from 'fs/promises'
import path from 'path'
import { cache } from 'react'

const ROOT_PATH = '/mnt/d/manga'
const META_PATH = path.join(ROOT_PATH, '.meta')

const CATEGORY_ALIASES: Record<string, string> = {
  'action': 'Ação',
  'acao': 'Ação',
  'ação': 'Ação',
  'adventure': 'Aventura',
  'aventura': 'Aventura',
  'comedy': 'Comédia',
  'comedia': 'Comédia',
  'comédia': 'Comédia',
  'drama': 'Drama',
  'fantasy': 'Fantasia',
  'fantasia': 'Fantasia',
  'horror': 'Horror',
  'terror': 'Terror',
  'isekai': 'Isekai',
  'magic': 'Magia',
  'magia': 'Magia',
  'martial arts': 'Artes Marciais',
  'artes marciais': 'Artes Marciais',
  'mecha': 'Mecha',
  'mystery': 'Mistério',
  'misterio': 'Mistério',
  'mistério': 'Mistério',
  'psychological': 'Psicológico',
  'psicologico': 'Psicológico',
  'psicológico': 'Psicológico',
  'romance': 'Romance',
  'sci-fi': 'Ficção Científica',
  'scifi': 'Ficção Científica',
  'science fiction': 'Ficção Científica',
  'ficção científica': 'Ficção Científica',
  'ficcao cientifica': 'Ficção Científica',
  'seinen': 'Seinen',
  'shoujo': 'Shoujo',
  'shojo': 'Shoujo',
  'shounen': 'Shounen',
  'shonen': 'Shounen',
  'slice of life': 'Slice of Life',
  'supernatural': 'Sobrenatural',
  'sobrenatural': 'Sobrenatural',
  'sports': 'Esportes',
  'esportes': 'Esportes',
  'thriller': 'Thriller',
  'zombie': 'Zumbi',
  'zumbi': 'Zumbi',
  'historical': 'Histórico',
  'historico': 'Histórico',
  'histórico': 'Histórico',
  'school': 'Escolar',
  'escolar': 'Escolar',
  'school life': 'Vida Escolar',
  'vida escolar': 'Vida Escolar',
  'ecchi': 'Ecchi',
  'harem': 'Harem',
  'josei': 'Josei',
  'mature': 'Maduro',
  'maduro': 'Maduro',
  'adult': 'Adulto',
  'adulto': 'Adulto',
  'gore': 'Gore',
  'military': 'Militar',
  'militar': 'Militar',
  'music': 'Música',
  'musica': 'Música',
  'música': 'Música',
  'parody': 'Paródia',
  'parodia': 'Paródia',
  'paródia': 'Paródia',
  'police': 'Policial',
  'policial': 'Policial',
  'post-apocalyptic': 'Pós-Apocalíptico',
  'pos-apocaliptico': 'Pós-Apocalíptico',
  'pós-apocalíptico': 'Pós-Apocalíptico',
  'reincarnation': 'Reencarnação',
  'reencarnacao': 'Reencarnação',
  'reencarnação': 'Reencarnação',
  'revenge': 'Vingança',
  'vinganca': 'Vingança',
  'vingança': 'Vingança',
  'samurai': 'Samurai',
  'space': 'Espaço',
  'espaco': 'Espaço',
  'espaço': 'Espaço',
  'super power': 'Super Poderes',
  'super powers': 'Super Poderes',
  'super poderes': 'Super Poderes',
  'survival': 'Sobrevivência',
  'sobrevivencia': 'Sobrevivência',
  'sobrevivência': 'Sobrevivência',
  'time travel': 'Viagem no Tempo',
  'viagem no tempo': 'Viagem no Tempo',
  'tragedy': 'Tragédia',
  'tragedia': 'Tragédia',
  'tragédia': 'Tragédia',
  'vampire': 'Vampiro',
  'vampiro': 'Vampiro',
  'video game': 'Video Game',
  'webtoon': 'Webtoon',
  'manhwa': 'Manhwa',
  'manhua': 'Manhua',
}

function normalizeCategory(category: string): string {
  const key = category.toLowerCase().trim()
  return CATEGORY_ALIASES[key] || category
}

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

interface MetadataContent {
  categories: string[]
  author: string
}

function parseMetadataFile(content: string): MetadataContent {
  const result: MetadataContent = {
    categories: [],
    author: '',
  }

  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const [key, ...valueParts] = trimmed.split('=')
    const value = valueParts.join('=').trim()

    if (key === 'categories') {
      result.categories = value.split(',').map((c) => c.trim()).filter(Boolean)
    } else if (key === 'author') {
      result.author = value
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
    return { categories: [], author: '' }
  }
}

// Cached per render/build so that the many calls fanning out from
// getCategories()/getTitlesByCategory() don't each re-scan the whole
// manga library on disk.
// dirent.isDirectory() relies on d_type from the filesystem, which some
// virtualized bind mounts (e.g. Docker Desktop's 9p/virtiofs translation of
// NTFS on Windows) don't populate — it silently reports false for real
// directories. Fall back to stat() whenever that happens.
async function isDirectory(dirent: import('fs').Dirent, fullPath: string): Promise<boolean> {
  if (dirent.isDirectory()) return true
  try {
    return (await stat(fullPath)).isDirectory()
  } catch {
    return false
  }
}

export const getAllTitles = cache(async (): Promise<TitleInfo[]> => {
  try {
    const entries = await readdir(ROOT_PATH, { withFileTypes: true })

    const titleNames = (
      await Promise.all(
        entries
          .filter((dirent) => !dirent.name.startsWith('.'))
          .map(async (dirent) =>
            (await isDirectory(dirent, path.join(ROOT_PATH, dirent.name))) ? dirent.name : null
          )
      )
    ).filter((name): name is string => name !== null)

    const titleList = await Promise.all(
      titleNames.map(async (name) => {
        const titlePath = path.join(ROOT_PATH, name)
        const capEntries = await readdir(titlePath, { withFileTypes: true })
        const capDirs = await Promise.all(
          capEntries.map((c) => isDirectory(c, path.join(titlePath, c.name)))
        )
        const stats = await stat(titlePath)
        const metadata = await readMetadata(name)

        return {
          id: name.toLowerCase().replace(/\s+/g, '-'),
          name,
          thumb: `/api/read/${name}/01/thumb`,
          description: metadata.author ? `Por ${metadata.author}` : `Description for ${name}`,
          caps: capDirs.filter(Boolean).length,
          link: `/read/${name.toLowerCase().replace(/\s+/g, '-')}`,
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