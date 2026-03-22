import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ThetaTerminal v3 running on Droplet — override via THETADATA_HOST env var
const THETA_HOST = process.env.THETADATA_HOST ?? 'http://174.138.57.123:25503'
const THETA_BASE = `${THETA_HOST}/v3`

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const endpoint = searchParams.get('endpoint') ?? 'stock/history/eod'

  const params = new URLSearchParams()
  searchParams.forEach((v, k) => {
    if (k !== 'endpoint') params.set(k, v)
  })

  try {
    const url = `${THETA_BASE}/${endpoint}?${params}`
    const res = await fetch(url, { next: { revalidate: 0 } })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { configured: true, data: null, error: `ThetaData ${res.status}: ${text.slice(0, 200)}` },
        { status: res.status },
      )
    }

    // Terminal returns CSV — parse into array of objects
    const text = await res.text()
    const lines = text.trim().split('\n')
    const headers = lines[0].split(',')
    const data = lines.slice(1).map(line => {
      const vals = line.split(',')
      return Object.fromEntries(headers.map((h, i) => [h, vals[i]]))
    })

    return NextResponse.json({ configured: true, data })
  } catch (err) {
    return NextResponse.json(
      { configured: true, data: null, error: String(err) },
      { status: 503 },
    )
  }
}
