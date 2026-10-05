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

// --- Raw key/value editing (the metadata editor) ----------------------------

export type MetadataEntry = [key: string, value: string]

// Keys the parser reads under another name: the editor folds them into the
// canonical key so a file never carries two competing values (last one wins).
export const METADATA_ALIASES: Record<string, string> = {
  authors: 'author',
  synopsis: 'description',
  sinopse: 'description',
}

const KEY_RE = /^[A-Za-z0-9_-]+$/

/**
 * Every key=value line of a .metadata file, in first-seen order, one entry per
 * key (aliases folded into their canonical key) and the LAST value winning,
 * exactly like parseMetadataFile. Unknown keys are kept as they are.
 */
export function parseMetadataEntries(content: string): MetadataEntry[] {
  const values = new Map<string, string>()
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const raw = trimmed.slice(0, eq).trim()
    const key = METADATA_ALIASES[raw] ?? raw
    const value = trimmed.slice(eq + 1).trim()
    // Map keeps insertion order: re-setting keeps the first position.
    values.set(key, value)
  }
  return [...values.entries()]
}

/** Key rules for custom fields: letters, digits, "_" and "-". */
export function isValidMetadataKey(key: string): boolean {
  return KEY_RE.test(key)
}

/**
 * Back to file text: one key=value per line. Values are single-line (the file
 * format has no escaping), so line breaks become spaces; empty values and
 * invalid keys are dropped; aliases are written under the canonical key.
 */
export function serializeMetadataEntries(entries: MetadataEntry[]): string {
  const out = new Map<string, string>()
  for (const [rawKey, rawValue] of entries) {
    const trimmedKey = rawKey.trim()
    const key = METADATA_ALIASES[trimmedKey] ?? trimmedKey
    const value = rawValue.replace(/\s*[\r\n]+\s*/g, ' ').trim()
    if (!isValidMetadataKey(key) || !value) continue
    out.set(key, value)
  }
  return [...out.entries()].map(([k, v]) => `${k}=${v}`).join('\n') + (out.size ? '\n' : '')
}
