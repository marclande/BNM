export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const SYMBOLS: Record<string, string> = {
  vix:   '^VIX',
  vix3m: '^VIX3M',
  vvix:  '^VVIX',
  uvxy:  'UVXY',
  uvix:  'UVIX',
  svxy:  'SVXY',
  vxx:   'VXX',
}

async function fetchHistory(sym: string): Promise<Map<string, number>> {
  const encoded = encodeURIComponent(sym)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=3mo`
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA },
      next: { revalidate: 0 },
    })
    if (!r.ok) return new Map()
    const d = await r.json()
    const result = d?.chart?.result?.[0]
    if (!result) return new Map()
    const timestamps: number[] = result.timestamp ?? []
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? []
    const m = new Map<string, number>()
    timestamps.forEach((ts, i) => {
      const price = closes[i]
      if (price != null && price > 0) {
        const date = new Date(ts * 1000).toISOString().slice(0, 10)
        m.set(date, price)
      }
    })
    return m
  } catch {
    return new Map()
  }
}

export async function GET() {
  const [vixMap, vix3mMap, vvixMap, uvxyMap, uvixMap, svxyMap, vxxMap] = await Promise.all([
    fetchHistory(SYMBOLS.vix),
    fetchHistory(SYMBOLS.vix3m),
    fetchHistory(SYMBOLS.vvix),
    fetchHistory(SYMBOLS.uvxy),
    fetchHistory(SYMBOLS.uvix),
    fetchHistory(SYMBOLS.svxy),
    fetchHistory(SYMBOLS.vxx),
  ])

  // Use UVXY trading dates as the calendar backbone
  const dates = [...uvxyMap.keys()].sort()

  const rows = dates
    .map(date => ({
      date,
      vix:   vixMap.get(date)   ?? null,
      vix3m: vix3mMap.get(date) ?? null,
      vvix:  vvixMap.get(date)  ?? null,
      uvxy:  uvxyMap.get(date)  ?? null,
      uvix:  uvixMap.get(date)  ?? null,
      svxy:  svxyMap.get(date)  ?? null,
      vxx:   vxxMap.get(date)   ?? null,
    }))
    .filter(r => r.vix != null && r.uvxy != null)

  return NextResponse.json({ rows })
}
