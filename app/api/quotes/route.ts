import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const SYMBOLS = ['^VIX', '^VIX3M', '^VVIX', '^GSPC', 'UVXY']

async function getSession(): Promise<{ cookie: string; crumb: string } | null> {
  try {
    const r1 = await fetch('https://fc.yahoo.com', {
      headers: { 'User-Agent': UA },
      redirect: 'follow',
    })
    const rawCookie = r1.headers.get('set-cookie') ?? ''
    const cookie = rawCookie.split(';')[0]
    if (!cookie) return null

    const r2 = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': UA, 'Cookie': cookie },
    })
    if (!r2.ok) return null
    const crumb = (await r2.text()).trim()
    if (!crumb) return null

    return { cookie, crumb }
  } catch {
    return null
  }
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Could not get Yahoo Finance session', ts: Date.now() }, { status: 503 })
    }

    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(SYMBOLS.join(','))}&crumb=${encodeURIComponent(session.crumb)}&fields=regularMarketPrice,marketState`
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Cookie': session.cookie },
      next: { revalidate: 0 },
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Yahoo ${res.status}`, ts: Date.now() }, { status: 503 })
    }

    const json = await res.json()
    const results: Record<string, { regularMarketPrice?: number; marketState?: string }> = {}
    for (const q of json?.quoteResponse?.result ?? []) {
      results[q.symbol] = q
    }

    const marketState = results['^GSPC']?.marketState ?? results['^VIX']?.marketState ?? 'UNKNOWN'

    return NextResponse.json({
      vix:         results['^VIX']?.regularMarketPrice   ?? null,
      vix3m:       results['^VIX3M']?.regularMarketPrice ?? null,
      vvix:        results['^VVIX']?.regularMarketPrice  ?? null,
      spx:         results['^GSPC']?.regularMarketPrice  ?? null,
      uvxy:        results['UVXY']?.regularMarketPrice   ?? null,
      marketState,
      ts: Date.now(),
    })
  } catch (err) {
    return NextResponse.json({ error: String(err), ts: Date.now() }, { status: 503 })
  }
}
