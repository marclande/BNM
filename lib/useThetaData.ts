'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ThetaOptionRecord {
  right:  'C' | 'P'
  strike: number       // dollars (e.g. 10.69)
  expiry: number       // YYYYMMDD
  dte:    number       // calendar days to expiry
  bid:    number
  ask:    number
  mid:    number
  delta?: number       // signed (calls +, puts -)
  theta?: number       // $ per day (negative = decay)
  gamma?: number
  vega?:  number
  iv?:    number       // as percent, e.g. 145.2
}

export interface ThetaState {
  configured:  boolean            // env vars present
  connected:   boolean            // last fetch succeeded
  lastFetch:   Date | null
  atmIv:       number | null      // UVXY ATM 30DTE call IV (%)
  atmDelta:    number | null      // UVXY ATM 30DTE call delta
  atmTheta:    number | null      // UVXY ATM 30DTE call theta ($/day)
  lookupOption: LookupFn
}

// Find real option closest to (right, targetStrike, targetDTE)
export type LookupFn = (
  right:        'C' | 'P',
  targetStrike: number,
  targetDTE:    number,
) => ThetaOptionRecord | null

// ─── ThetaData response parsers ───────────────────────────────────────────────

function expToDate(yyyymmdd: number): Date {
  const y = Math.floor(yyyymmdd / 10000)
  const m = Math.floor((yyyymmdd % 10000) / 100) - 1
  const d = yyyymmdd % 100
  return new Date(y, m, d)
}

function calcDTE(expiry: number): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff  = expToDate(expiry).getTime() - today.getTime()
  return Math.max(0, Math.round(diff / 86_400_000))
}

// ThetaData stores strikes as integer * 1000 (10000 → $10.000)
function parseStrike(raw: number): number {
  return raw / 1000
}

interface RawContract {
  root: string; expiration: number; strike: number; right: string
}
interface RawQuoteTick {
  bid: number; ask: number; bid_size?: number; ask_size?: number
}
interface RawGreekTick {
  delta?: number; theta?: number; gamma?: number; vega?: number; impl_vol?: number
}
interface RawEntry<T> {
  contract: RawContract
  tick: T
}

function parseQuotes(data: { response?: RawEntry<RawQuoteTick>[] } | null): Map<string, ThetaOptionRecord> {
  const map = new Map<string, ThetaOptionRecord>()
  if (!Array.isArray(data?.response)) return map

  for (const entry of data.response) {
    const { contract: c, tick: t } = entry
    if (!c || !t) continue
    const strike = parseStrike(c.strike)
    const expiry = c.expiration
    const right  = c.right === 'C' ? 'C' : 'P'
    const mid    = +((t.bid + t.ask) / 2).toFixed(3)
    const key    = `${right}_${c.strike}_${expiry}`
    map.set(key, { right, strike, expiry, dte: calcDTE(expiry), bid: t.bid, ask: t.ask, mid })
  }
  return map
}

function mergeGreeks(
  map: Map<string, ThetaOptionRecord>,
  data: { response?: RawEntry<RawGreekTick>[] } | null,
): void {
  if (!Array.isArray(data?.response)) return
  for (const entry of data.response) {
    const { contract: c, tick: t } = entry
    if (!c || !t) continue
    const key = `${c.right === 'C' ? 'C' : 'P'}_${c.strike}_${c.expiration}`
    const rec = map.get(key)
    if (rec) {
      rec.delta = t.delta
      rec.theta = t.theta
      rec.gamma = t.gamma
      rec.vega  = t.vega
      rec.iv    = t.impl_vol != null ? +(t.impl_vol * 100).toFixed(1) : undefined
    }
  }
}

// ─── Lookup helper ─────────────────────────────────────────────────────────────

function buildLookup(chain: ThetaOptionRecord[]): LookupFn {
  return (right, targetStrike, targetDTE) => {
    const filtered = chain.filter(o => o.right === right && o.bid > 0)
    if (filtered.length === 0) return null

    // Step 1: find the best expiry (closest DTE to target)
    const expiries = [...new Set(filtered.map(o => o.dte))]
    const bestDTE  = expiries.reduce((a, b) =>
      Math.abs(a - targetDTE) <= Math.abs(b - targetDTE) ? a : b
    )

    // Step 2: within that expiry, find closest strike
    const atDTE = filtered.filter(o => o.dte === bestDTE)
    return atDTE.reduce((best, cur) =>
      Math.abs(cur.strike - targetStrike) < Math.abs(best.strike - targetStrike) ? cur : best
    )
  }
}

// ─── ATM summary helper ───────────────────────────────────────────────────────

function atmStats(chain: ThetaOptionRecord[], spotPrice: number): {
  iv: number | null; delta: number | null; theta: number | null
} {
  // Find calls near ATM at ~21-30 DTE
  const calls = chain.filter(o => o.right === 'C' && o.dte >= 14 && o.dte <= 35 && o.bid > 0)
  if (calls.length === 0) return { iv: null, delta: null, theta: null }

  const atm = calls.reduce((best, cur) =>
    Math.abs(cur.strike - spotPrice) < Math.abs(best.strike - spotPrice) ? cur : best
  )
  return {
    iv:    atm.iv    ?? null,
    delta: atm.delta ?? null,
    theta: atm.theta ?? null,
  }
}

// ─── Market hours helper ──────────────────────────────────────────────────────

function isMarketHours(): boolean {
  const et  = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const dec = et.getHours() + et.getMinutes() / 60
  return dec >= 9.5 && dec < 16
}

const NULL_LOOKUP: LookupFn = () => null

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useThetaData(uvxySpot: number): ThetaState {
  const [configured, setConfigured] = useState(false)
  const [connected,  setConnected]  = useState(false)
  const [lastFetch,  setLastFetch]  = useState<Date | null>(null)
  const [chain,      setChain]      = useState<ThetaOptionRecord[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetch2 = useCallback(async () => {
    try {
      // Parallel: quotes + greeks for UVXY
      const [qRes, gRes] = await Promise.all([
        fetch('/api/thetadata?endpoint=bulk_snapshot%2Foption%2Fquote&root=UVXY'),
        fetch('/api/thetadata?endpoint=bulk_snapshot%2Foption%2Fgreeks&root=UVXY'),
      ])
      const [qJson, gJson] = await Promise.all([qRes.json(), gRes.json()])

      setConfigured(qJson.configured)
      if (!qJson.configured) return

      if (qJson.data) {
        const map = parseQuotes(qJson.data)
        mergeGreeks(map, gJson.data)
        setChain([...map.values()])
        setConnected(true)
        setLastFetch(new Date())
      }
    } catch {
      setConnected(false)
    }
  }, [])

  useEffect(() => {
    fetch2()
    const tick = () => {
      fetch2()
      timerRef.current = setTimeout(tick, isMarketHours() ? 60_000 : 600_000)
    }
    timerRef.current = setTimeout(tick, isMarketHours() ? 60_000 : 600_000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [fetch2])

  const atm     = atmStats(chain, uvxySpot)
  const lookup  = chain.length > 0 ? buildLookup(chain) : NULL_LOOKUP

  return {
    configured,
    connected,
    lastFetch,
    atmIv:    atm.iv,
    atmDelta: atm.delta,
    atmTheta: atm.theta,
    lookupOption: lookup,
  }
}
