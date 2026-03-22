'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { DashState } from '@/app/page'

export type FeedStatus = 'loading' | 'live' | 'delayed' | 'manual'

export interface OratsSummary {
  ticker:  string
  iv30:    number   // 30-day implied vol
  ivr30:   number   // IV rank (0–100)
  ivp30:   number   // IV percentile (0–100)
  fwdPx:   number   // forward price
}

export interface FeedState {
  status:         FeedStatus
  marketState:    string        // 'REGULAR' | 'PRE' | 'POST' | 'CLOSED' | 'UNKNOWN'
  lastUpdated:    Date | null
  oratsReady:     boolean       // ORATS_TOKEN is set in env
  oratsSummary:   OratsSummary | null
  refresh:        () => void
}

interface QuotePayload {
  vix?: number; vix3m?: number; vvix?: number; spx?: number; uvxy?: number
  marketState?: string
  partial?: boolean
  error?: string
}

interface OratsPayload {
  configured: boolean
  data: Array<{
    ticker: string
    iv30: number; ivr30: number; ivp30: number; fwdPx: number
  }> | null
  error?: string
}

// Market hours in ET (decimal): 9:30–16:00
function isETMarketHours(): boolean {
  const et  = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const dec = et.getHours() + et.getMinutes() / 60
  return dec >= 9.5 && dec < 16
}

export function useMarketData(
  update: (key: keyof DashState, val: number) => void,
): FeedState {
  const [status,       setStatus]       = useState<FeedStatus>('loading')
  const [marketState,  setMarketState]  = useState('UNKNOWN')
  const [lastUpdated,  setLastUpdated]  = useState<Date | null>(null)
  const [oratsReady,   setOratsReady]   = useState(false)
  const [oratsSummary, setOratsSummary] = useState<OratsSummary | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Quotes fetch ──────────────────────────────────────────────────────────
  const fetchQuotes = useCallback(async () => {
    try {
      const res  = await fetch('/api/quotes')
      const data: QuotePayload = await res.json()

      if (data.error || !res.ok) { setStatus('manual'); return }

      // Apply whichever fields came back (graceful partial)
      if (data.vix   != null) update('vix',   +data.vix.toFixed(2))
      if (data.vix3m != null) update('vix3m', +data.vix3m.toFixed(2))
      if (data.vvix  != null) update('vvix',  +data.vvix.toFixed(0))
      if (data.spx   != null) update('spx',   +data.spx.toFixed(0))
      if (data.uvxy  != null) update('uvxy',  +data.uvxy.toFixed(2))

      const ms = data.marketState ?? 'UNKNOWN'
      setMarketState(ms)
      setStatus(ms === 'REGULAR' ? 'live' : 'delayed')
      setLastUpdated(new Date())
    } catch {
      setStatus('manual')
    }
  }, [update])

  // ── ORATS fetch ───────────────────────────────────────────────────────────
  const fetchOrats = useCallback(async () => {
    try {
      const res  = await fetch('/api/orats?endpoint=summaries&tickers=UVXY')
      const json: OratsPayload = await res.json()

      setOratsReady(json.configured)

      if (json.configured && Array.isArray(json.data) && json.data.length > 0) {
        const row = json.data[0]
        setOratsSummary({
          ticker: row.ticker,
          iv30:   row.iv30,
          ivr30:  row.ivr30,
          ivp30:  row.ivp30,
          fwdPx:  row.fwdPx,
        })
      }
    } catch {
      /* ORATS failure is non-fatal */
    }
  }, [])

  // ── Polling schedule ──────────────────────────────────────────────────────
  const refresh = useCallback(() => {
    fetchQuotes()
    fetchOrats()
  }, [fetchQuotes, fetchOrats])

  useEffect(() => {
    refresh()

    const tick = () => {
      fetchQuotes()
      // Re-check ORATS every 5 min (it's static until key changes)
      const interval = isETMarketHours() ? 30_000 : 300_000
      timerRef.current = setTimeout(tick, interval)
    }

    const interval = isETMarketHours() ? 30_000 : 300_000
    timerRef.current = setTimeout(tick, interval)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [fetchQuotes, refresh])

  return { status, marketState, lastUpdated, oratsReady, oratsSummary, refresh }
}
