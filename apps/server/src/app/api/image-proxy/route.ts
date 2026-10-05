import { NextResponse } from "next/server"

const MAX_BYTES = 15 * 1024 * 1024
const TIMEOUT_MS = 15_000

// Fetches an image from a pasted link on the server, so the cover editor can
// crop it in a canvas (a direct cross-origin load would taint the canvas).
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url") ?? ""
  let url: URL
  try {
    url = new URL(raw)
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("protocol")
  } catch {
    return NextResponse.json({ error: "Link inválido" }, { status: 400 })
  }
  try {
    // Some hosts (Wikimedia, CDNs) refuse requests without a browser-like agent.
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36 manga-reader",
        Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
      },
    })
    const type = res.headers.get("content-type") ?? ""
    if (!res.ok || !type.startsWith("image/")) {
      return NextResponse.json({ error: "O link não aponta para uma imagem" }, { status: 422 })
    }
    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.length > MAX_BYTES) {
      return NextResponse.json({ error: "Imagem maior que 15 MB" }, { status: 413 })
    }
    return new NextResponse(bytes, { headers: { "Content-Type": type, "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "Não foi possível baixar a imagem" }, { status: 502 })
  }
}
