import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const THETA_BASE = 'https://api.thetadata.us/v2'

// Support two auth methods — set whichever matches your plan in Vercel env vars:
//   THETADATA_KEY      → x-api-key header  (newer plans / cloud API key)
//   THETADATA_USERNAME + THETADATA_PASSWORD → HTTP Basic auth (ThetaTerminal credentials)
const API_KEY  = process.env.THETADATA_KEY
const USERNAME = process.env.THETADATA_USERNAME
const PASSWORD = process.env.THETADATA_PASSWORD

function isConfigured() {
  return !!API_KEY || (!!USERNAME && !!PASSWORD)
}

function authHeaders(): HeadersInit {
  if (API_KEY) return { 'x-api-key': API_KEY }
  if (USERNAME && PASSWORD) {
    const b64 = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')
    return { 'Authorization': `Basic ${b64}` }
  }
  return {}
}

export async function GET(req: NextRequest) {
  if (!isConfigured()) {
    return NextResponse.json({ configured: false, data: null })
  }

  const { searchParams } = req.nextUrl
  const endpoint = searchParams.get('endpoint') ?? 'bulk_snapshot/option/quote'

  // Forward remaining params to ThetaData (e.g. root=UVXY, exp=...)
  const params = new URLSearchParams({ use_csv: 'false' })
  for (const [k, v] of searchParams.entries()) {
    if (k !== 'endpoint') params.set(k, v)
  }

  try {
    const url = `${THETA_BASE}/${endpoint}?${params}`
    const res = await fetch(url, {
      headers: { ...authHeaders(), 'Accept': 'application/json' },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { configured: true, data: null, error: `ThetaData ${res.status}: ${text.slice(0, 200)}` },
        { status: res.status },
      )
    }

    const json = await res.json()
    return NextResponse.json({ configured: true, data: json })
  } catch (err) {
    return NextResponse.json(
      { configured: true, data: null, error: String(err) },
      { status: 503 },
    )
  }
}
