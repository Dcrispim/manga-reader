import { readMetadata } from "@/services/metadata"
import { NextResponse } from "next/server"



export async function GET(request: Request, { params }: { params: Promise<{ title: string }> }) {
  const { title } = await params
  const metadata = await readMetadata(title)
  return NextResponse.json(metadata)
}