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

export const EMPTY_METADATA: MetadataContent = {
  categories: [],
  author: '',
  volumes: '',
  status: '',
  type: '',
  demographic: '',
  published: '',
  description: '',
}

export function parseMetadataFile(content: string): MetadataContent {
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
