// IndexedDB is per-origin and only exists in the browser — every export here
// is only ever called from client code (hooks, client components) or from
// the service worker, both of which run in a window/worker context.

const DB_NAME = 'manga-offline'
const DB_VERSION = 2
export const CHAPTERS_STORE = 'chapters'
export const TITLES_STORE = 'titles'

let dbPromise: Promise<IDBDatabase> | null = null

export function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB indisponível neste ambiente'))
  }
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(CHAPTERS_STORE)) {
        const store = db.createObjectStore(CHAPTERS_STORE, { keyPath: 'id' })
        store.createIndex('title', 'title', { unique: false })
        store.createIndex('savedAt', 'savedAt', { unique: false })
      }
      // Offline-first means more than the page images: the cover and basic
      // facts (author, chapter list, ...) shown all over the app should
      // survive being offline too, not just chapters explicitly downloaded.
      if (!db.objectStoreNames.contains(TITLES_STORE)) {
        db.createObjectStore(TITLES_STORE, { keyPath: 'id' })
      }
    }

    // Without this, an older connection left open in another tab blocks a
    // version bump indefinitely — neither onsuccess nor onerror ever fires
    // for the tab requesting the upgrade, so it hangs forever instead of
    // failing loudly. Closing on versionchange lets that other tab's next
    // request through immediately.
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => db.close()
      resolve(db)
    }
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('IndexedDB bloqueado por outra aba com uma versão mais antiga aberta'))
  })

  // A rejected open must not be cached forever — clear it so the next call
  // gets a fresh attempt instead of the same dead promise every time.
  dbPromise.catch(() => {
    dbPromise = null
  })

  return dbPromise
}

export function chapterKey(title: string, chapter: string): string {
  return `${title}::${chapter}`
}

export function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
