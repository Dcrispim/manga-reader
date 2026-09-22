import type { MouseEvent } from 'react'

// Next.js <Link> and router.push() do a client-side transition: a fetch()
// for the RSC payload, not a real page navigation. A service worker's fetch
// handler only sees `request.mode === 'navigate'` for real navigations, so
// a soft transition silently fails offline instead of ever reaching the
// offline fallback. Forcing a full page load when offline is what actually
// lets the service worker step in.
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine
}

export function goToUrl(href: string) {
  window.location.href = href
}

// Attach to a Next <Link>'s onClick (alongside any existing handler) to
// fall back to a full navigation when offline.
export function offlineAwareLinkClick(event: MouseEvent, href: string) {
  if (!isOffline()) return
  event.preventDefault()
  goToUrl(href)
}
