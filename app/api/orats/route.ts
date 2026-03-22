import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const ORATS_BASE = 'https://api.orats.io/datav2'

// Token is set as ORATS_TOKEN in Vercel env vars (or .env.local for dev)
const TOKEN = process.env.ORATS_TOKEN

export async function GET(req: NextRequest) {
  // Always report whether token is configured — client uses this for status display
  if (!TOKEN) {
    return NextResponse.json({ configured: false, data: null })
  }

  const { searchParams } = req.nextUrl
  const endpoint = searchParams.get('endpoint') ?? 'summaries'

  // Build ORATS request params, injecting the server-side token
  const params = new URLSearchParams({ token: TOKEN })
  for (const [k, v] of searchParams.entries()) {
    if (k !== 'endpoint') params.set(k, v)
  }

  try {
    const res  = await fetch(`${ORATS_BASE}/${endpoint}?${params}`, {
      next: { revalidate: 0 },
    })
    const json = await res.json()

    return NextResponse.json({ configured: true, data: json?.data ?? json })
  } catch (err) {
    return NextResponse.json(
      { configured: true, data: null, error: String(err) },
      { status: 503 },
    )
  }
}
