import { getChapterRecord, upgradeChapterImages } from './store'

// The upscaler is a single-worker GPU queue shared by the whole app (see
// src/services/upscale.ts) — at most one job runs at a time, one more
// waits, and a newer request bumps whatever was waiting. So this poll must
// stay bounded: a chapter can sit "pending" forever if it keeps getting
// bumped by newer requests, and this is always a secondary nice-to-have,
// never something worth waiting on indefinitely.
const POLL_INTERVAL_MS = 5000
const MAX_POLL_ATTEMPTS = 24 // ~2 minutes

type UpscaleResponse = { status?: 'pending' | 'processing' | 'done' | 'error'; error?: string }

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchUpscaleStatus(title: string, chapter: string, method: 'GET' | 'POST'): Promise<UpscaleResponse> {
  const res = await fetch(`/api/read/${title}/${chapter}/upscale`, { method })
  if (!res.ok) return {}
  return res.json()
}

// Downloading a chapter always saves the original pages first — that's the
// reliable, primary flow (see downloader.ts) and never waits on this. Once
// that's done, this runs in the background: request/check the upscale for
// this chapter, and if a high-res copy is (or becomes) available, replace
// the chapter's stored pages with it. Never awaited by the download itself.
export async function maybeUpgradeToHighRes(title: string, chapter: string): Promise<void> {
  try {
    let result = await fetchUpscaleStatus(title, chapter, 'POST')

    let attempts = 0
    while (result.status !== 'done' && result.status !== 'error' && attempts < MAX_POLL_ATTEMPTS) {
      await wait(POLL_INTERVAL_MS)
      result = await fetchUpscaleStatus(title, chapter, 'GET')
      attempts++
    }

    if (result.status !== 'done') return

    // Only bother fetching xl pages if the chapter is still worth upgrading.
    const record = await getChapterRecord(title, chapter)
    if (!record) return

    const xlBlobs: Blob[] = []
    const xlMimeTypes: string[] = []
    for (let i = 0; i < record.images.length; i++) {
      const res = await fetch(`/api/read/${title}/${chapter}/xl/${i}`)
      if (!res.ok) return // incomplete/mismatched set — leave the original pages alone
      const blob = await res.blob()
      xlBlobs.push(blob)
      xlMimeTypes.push(blob.type || 'image/jpeg')
    }

    await upgradeChapterImages(title, chapter, xlBlobs, xlMimeTypes)
  } catch {
    // Best-effort background upgrade — a failure here must never surface as
    // a download error, since the original pages are already safely saved.
  }
}
