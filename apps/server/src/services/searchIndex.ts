import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import path from 'path'
import { getAllTitles, readMetadata, type MetadataContent } from '@/services/metadata'

const ROOT_PATH = '/mnt/d/manga'
// Lives alongside the other app-managed dot-directories (.meta, .thumb,
// .binds) inside the library mount, not in the repo — same convention the
// rest of the codebase already uses for persisted state.
const SEARCH_DIR = path.join(ROOT_PATH, '.search')
const DB_PATH = path.join(SEARCH_DIR, 'index.db')

let db: Database.Database | null = null

function getDb(): Database.Database {
  if (db) return db

  mkdirSync(SEARCH_DIR, { recursive: true })
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS titles_fts USING fts5(
      id UNINDEXED,
      name,
      metadata,
      categories UNINDEXED,
      author UNINDEXED,
      thumb UNINDEXED,
      link UNINDEXED,
      caps UNINDEXED,
      tokenize = 'unicode61 remove_diacritics 2'
    )
  `)

  return db
}

export interface SearchIndexResult {
  id: string
  name: string
  thumb: string
  link: string
  caps: number
  categories: string[]
  author: string
}

// Schema-agnostic on purpose: whatever keys exist on MetadataContent today
// (or get added to it later — status, type, demographic, published, ...)
// flow into the search blob automatically, with no field-by-field mapping
// to keep in sync here.
function flattenMetadata(metadata: MetadataContent): string {
  return Object.values(metadata)
    .flat()
    .filter((value): value is string => Boolean(value))
    .join(' ')
}

export async function rebuildSearchIndex(): Promise<{ count: number }> {
  const database = getDb()
  const titles = await getAllTitles()

  const rows = await Promise.all(
    titles.map(async (title) => {
      const metadata = await readMetadata(title.name)
      return {
        id: title.id,
        name: title.name,
        metadata: flattenMetadata(metadata),
        categories: title.categories.join(', '),
        author: title.author,
        thumb: title.thumb,
        link: title.link,
        caps: title.caps,
      }
    })
  )

  const insert = database.prepare(`
    INSERT INTO titles_fts (id, name, metadata, categories, author, thumb, link, caps)
    VALUES (@id, @name, @metadata, @categories, @author, @thumb, @link, @caps)
  `)

  database.transaction(() => {
    database.exec('DELETE FROM titles_fts')
    for (const row of rows) insert.run(row)
  })()

  return { count: rows.length }
}

// Builds an FTS5 MATCH expression that ANDs each whitespace-separated term
// as a quoted prefix query — quoting treats each term as a literal string
// (sidesteps FTS5 query-syntax injection from special characters like " or
// ^) while the trailing * gives as-you-type prefix matching.
function toMatchQuery(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `"${term.replace(/"/g, '""')}"*`)
    .join(' ')
}

export async function searchTitles(query: string): Promise<SearchIndexResult[]> {
  const database = getDb()
  const matchQuery = toMatchQuery(query)
  if (!matchQuery) return []

  const rows = database
    .prepare(
      `SELECT id, name, categories, author, thumb, link, caps
       FROM titles_fts
       WHERE titles_fts MATCH ?
       ORDER BY bm25(titles_fts, 0, 3.0, 1.0)
       LIMIT 50`
    )
    .all(matchQuery) as Array<{
      id: string
      name: string
      categories: string
      author: string
      thumb: string
      link: string
      caps: number
    }>

  return rows.map((row) => ({
    ...row,
    categories: row.categories ? row.categories.split(', ').filter(Boolean) : [],
  }))
}

export function isSearchIndexBuilt(): boolean {
  const database = getDb()
  const row = database.prepare('SELECT COUNT(*) as count FROM titles_fts').get() as { count: number }
  return row.count > 0
}
