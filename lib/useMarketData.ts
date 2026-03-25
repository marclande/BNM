'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { DashState } from '@/app/page'

export type FeedStatus = 'loading' | 'live' | 'delayed' | 'manual'

export interface FeedState {
  status:      FeedStatus
  marketState: string       // 'REGULAR' | 'PRE' | 'POST' | 'CLOSED' | 'UNKNOWN'
  lastUpdated: Date | null
  refresh:     () => void
}

interface QuotePayload {
  vix?: number; vix3m?: number; vvix?: number; spx?: number
  uvxy?: number; uvix?: number; svxy?: number; vxx?: number
  marketState?: string
  partial?: boolean
  error?: string
}

function isETMarketHours(): boolean {
  const et  = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const dec = et.getHours() + et.getMinutes() / 60
  return dec >= 9.5 && dec < 16
}

export function useMarketData(
  update: (key: keyof DashState, val: number) => void,
): FeedState {
  const [status,      setStatus]      = useState<FeedStatus>('loading')
  const [marketState, setMarketState] = useState('UNKNOWN')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchQuotes = useCallback(async () => {
    try {
      const res  = await fetch('/api/quotes')
      const data: QuotePayload = await res.json()

      if (data.error || !res.ok) { setStatus('manual'); return }

      if (data.vix   != null) update('vix',   +data.vix.toFixed(2))
      if (data.vix3m != null) update('vix3m', +data.vix3m.toFixed(2))
      if (data.vvix  != null) update('vvix',  +data.vvix.toFixed(0))
      if (data.spx   != null) update('spx',   +data.spx.toFixed(0))
      if (data.uvxy != null) update('uvxy', +data.uvxy.toFixed(2))
      // Only update these if the quotes server explicitly returns them — no derivation
      if (data.uvix != null) update('uvix', +data.uvix.toFixed(2))
      if (data.svxy != null) update('svxy', +data.svxy.toFixed(2))
      if (data.vxx  != null) update('vxx',  +data.vxx.toFixed(2))

      const ms = data.marketState ?? 'UNKNOWN'
      setMarketState(ms)
      setStatus(ms === 'REGULAR' ? 'live' : 'delayed')
      setLastUpdated(new Date())
    } catch {
      setStatus('manual')
    }
  }, [update])

  useEffect(() => {
    fetchQuotes()

    const tick = () => {
      fetchQuotes()
      timerRef.current = setTimeout(tick, isETMarketHours() ? 30_000 : 300_000)
    }
    timerRef.current = setTimeout(tick, isETMarketHours() ? 30_000 : 300_000)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [fetchQuotes])

  return { status, marketState, lastUpdated, refresh: fetchQuotes }
}
