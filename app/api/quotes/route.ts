import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Yahoo Finance v8 chart — more stable than v7 quote, no crumb needed
async function fetchSymbol(symbol: string): Promise<{ price: number | null; marketState: string | null }> {
  const encoded = encodeURIComponent(symbol)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=1d&includePrePost=true`

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    next: { revalidate: 0 },
  })

  if (!res.ok) return { price: null, marketState: null }

  const json = await res.json()
  const meta  = json?.chart?.result?.[0]?.meta
  return {
    price:       meta?.regularMarketPrice   ?? null,
    marketState: meta?.marketState          ?? null,
  }
}

export async function GET() {
  try {
    // Fetch all 5 symbols in parallel
    const [vixR, vix3mR, vvixR, spxR, uvxyR] = await Promise.all([
      fetchSymbol('^VIX'),
      fetchSymbol('^VIX3M'),
      fetchSymbol('^VVIX'),
      fetchSymbol('^GSPC'),
      fetchSymbol('UVXY'),
    ])

    const marketState = spxR.marketState ?? vixR.marketState ?? 'UNKNOWN'
    const partial     = [vixR, vix3mR, vvixR, spxR, uvxyR].some(r => r.price === null)

    return NextResponse.json({
      vix:         vixR.price,
      vix3m:       vix3mR.price,
      vvix:        vvixR.price,
      spx:         spxR.price,
      uvxy:        uvxyR.price,
      marketState,
      partial,
      ts:          Date.now(),
    })
  } catch (err) {
    return NextResponse.json(
      { error: String(err), ts: Date.now() },
      { status: 503 },
    )
  }
}
