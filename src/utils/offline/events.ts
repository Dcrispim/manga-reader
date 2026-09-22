// A plain DOM event bus so any component can react to offline-storage
// changes (download, delete, eviction) without a shared state library —
// hooks re-query IndexedDB whenever this fires instead of caching state
// that would otherwise drift across tabs/components.

const EVENT_NAME = 'offline-chapters-changed'

export function emitOfflineChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(EVENT_NAME))
}

export function subscribeOfflineChanged(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(EVENT_NAME, callback)
  return () => window.removeEventListener(EVENT_NAME, callback)
}
