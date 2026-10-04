import { NextResponse } from 'next/server'
import { getServerId } from '@/services/serverId.server'
import { FEATURES } from '@/services/features.server'

// Force dynamic rendering to ensure fresh responses on each request
export const dynamic = 'force-dynamic'

export async function GET() {
  const serverId = await getServerId()
  // Version is hardcoded here to match package.json; updated in each milestone.
  const version = '1.3.0'

  const response = {
    ...(serverId && { serverId }),
    version,
    features: FEATURES,
  }

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
