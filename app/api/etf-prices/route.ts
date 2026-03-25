import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SYMBOLS = ['UVIX', 'SVXY', 'VXX'] as const
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

export async function GET() {
  const results = await Promise.allSettled(
    SYMBOLS.map(sym =>
      fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`,
        { headers: { 'User-Agent': UA }, next: { revalidate: 0 } }
      )
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(d => ({ sym, price: (d?.chart?.result?.[0]?.meta?.regularMarketPrice as number) ?? null }))
        .catch(() => ({ sym, price: null as number | null }))
    )
  )

  const out: Record<string, number | null> = {}
  for (const r of results) {
    if (r.status === 'fulfilled') out[r.value.sym.toLowerCase()] = r.value.price
  }

  const allNull = Object.values(out).every(v => v === null)
  return NextResponse.json({
    ...out,
    ts: Date.now(),
    ...(allNull ? { error: 'all symbols failed' } : {}),
  })
}
