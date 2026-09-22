// Minimal, hand-written service worker (no build-time PWA plugin, no
// invented offline-only UI). It does three things:
// 1. Cache-first the immutable Next.js static build assets so the app shell
//    boots offline.
// 2. Cache-first actual manga image bytes (covers, pages, upscaled pages) —
//    these are effectively write-once per URL, so once shown they stay
//    available even if the network/server later can't be reached. This is
//    separate from (and complements) the explicit, user-managed IndexedDB
//    chapter downloads: this cache is opportunistic and covers anything
//    merely viewed, like thumbnails.
// 3. Network-first everything else (pages, list/metadata/search JSON APIs),
//    falling back to whatever was last cached for that exact URL when the
//    network is unreachable. A chapter page you've already opened while
//    online replays from cache exactly as it looked — same layout, same
//    sidebar — because it genuinely is that same page, not a substitute. A
//    page you've never opened simply can't load offline, same as any other
//    site.
//
// Actual chapter-to-chapter offline reading (switching between downloaded
// chapters without a real page load) is handled client-side, inside the
// reader itself — see chapter-reader-context.tsx.
//
// One gap that lives here, not there: a chapter downloaded from the title
// page (a background fetch) may never have been *opened* as a real page
// before going offline, so there's no cached response for that exact
// /read/<title>/<chapter> URL — only in-app navigation (which never does a
// real page load offline) can reach it otherwise. When that happens, this
// file serves any other cached page for the *same* title instead of a
// generic failure — same sidebar, same chapter list, a real previously
// -rendered page, not a substitute. chapter-reader-context.tsx then notices
// the served chapter doesn't match the URL and swaps in the correct one
// from IndexedDB, the same way it does for in-app navigation.

const CACHE_VERSION = 'v5'
const STATIC_CACHE = `manga-static-${CACHE_VERSION}`
const RUNTIME_CACHE = `manga-runtime-${CACHE_VERSION}`
const IMAGE_CACHE = `manga-images-${CACHE_VERSION}`
const PRECACHE_URLS = ['/manifest.json']

// Thumb, a page image, or its upscaled variant — deliberately excludes the
// JSON-returning /api/read/<title> and /api/read/<title>/<chapter> list
// endpoints (and /api/metadata, /api/list, /api/search), which reflect the
// library's live state and must stay network-first.
const IMAGE_PATH_RE = /^\/api\/read\/[^/]+\/[^/]+\/(thumb|xl\/\d+|\d+)$/

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => Promise.all(PRECACHE_URLS.map((url) => cache.add(url).catch(() => {}))))
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE && key !== IMAGE_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

function isStaticAsset(pathname) {
  return pathname.startsWith('/_next/static/') || pathname.startsWith('/icons/')
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response && response.ok) {
    const cache = await caches.open(cacheName)
    cache.put(request, response.clone())
  }
  return response
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response && response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch (err) {
    const cached = await caches.match(request, { ignoreSearch: true })
    if (cached) return cached
    throw err
  }
}

const CHAPTER_ROUTE_RE = /^\/read\/([^/]+)\/([^/]+)\/?$/

// Any cached page under the same /read/<title>/ prefix — used only as a
// last resort when the exact chapter URL was never visited/cached, so a
// downloaded-but-never-opened chapter still has *a* real page to render
// client-side from instead of a hard failure.
async function findSameTitleFallback(cacheName, pathname) {
  const match = pathname.match(CHAPTER_ROUTE_RE)
  if (!match) return undefined
  const titlePrefix = `/read/${match[1]}/`
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  const sameTitleKey = keys.find((req) => new URL(req.url).pathname.startsWith(titlePrefix))
  return sameTitleKey ? cache.match(sameTitleKey) : undefined
}

async function handleNavigate(request, pathname) {
  try {
    return await networkFirst(request, RUNTIME_CACHE)
  } catch {
    const sameTitle = await findSameTitleFallback(RUNTIME_CACHE, pathname)
    if (sameTitle) return sameTitle
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (url.origin !== self.location.origin || request.method !== 'GET') return

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigate(request, url.pathname))
    return
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  if (IMAGE_PATH_RE.test(url.pathname)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE))
  }
})
