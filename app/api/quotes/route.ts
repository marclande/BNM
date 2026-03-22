import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const QUOTES_HOST = process.env.QUOTES_HOST ?? 'http://174.138.57.123:25504'

export async function GET() {
  try {
    const res = await fetch(QUOTES_HOST, { next: { revalidate: 0 } })
    if (!res.ok) {
      return NextResponse.json({ error: `Proxy ${res.status}`, ts: Date.now() }, { status: 503 })
    }
    const data = await res.json()
    return NextResponse.json({ ...data, ts: Date.now() })
  } catch (err) {
    return NextResponse.json({ error: String(err), ts: Date.now() }, { status: 503 })
  }
}
