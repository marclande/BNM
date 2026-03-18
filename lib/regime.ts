export type RegimeId = 1 | 2 | 3 | 4

export interface RegimeConfig {
  id: RegimeId
  name: string
  badge: string
  color: string
  bg: string
  border: string
  desc: string
  etnAction: string
  vixAction: string
  satelliteAction: string
  harvesterAction: string
}

export const REGIMES: Record<RegimeId, RegimeConfig> = {
  1: {
    id: 1,
    name: 'CONTANGO HARVEST',
    badge: 'REGIME 1',
    color: 'var(--regime-1)',
    bg: 'var(--regime-1-bg)',
    border: 'var(--regime-1-border)',
    desc: 'Maximum ETN call spread exposure. VIX term structure in steep contango — structural decay at peak. Accumulate VIX call inventory at low cost. All satellite scanners active.',
    etnAction: 'MAXIMUM',
    vixAction: 'ACCUMULATE',
    satelliteAction: 'ALL ACTIVE',
    harvesterAction: 'STANDBY',
  },
  2: {
    id: 2,
    name: 'NEUTRAL CARRY',
    badge: 'REGIME 2',
    color: 'var(--regime-2)',
    bg: 'var(--regime-2-bg)',
    border: 'var(--regime-2-border)',
    desc: 'Standard positioning. Vol regime transitioning — hold existing ETN spreads, maintain VIX call inventory. No new satellite positions. Monitor VVIX for acceleration.',
    etnAction: 'STANDARD',
    vixAction: 'HOLD',
    satelliteAction: 'HOLD ONLY',
    harvesterAction: 'STANDBY',
  },
  3: {
    id: 3,
    name: 'VOL EXPANSION WARNING',
    badge: 'REGIME 3',
    color: 'var(--regime-3)',
    bg: 'var(--regime-3-bg)',
    border: 'var(--regime-3-border)',
    desc: 'Cut ETN shorts by 50%. Reallocate freed margin to VIX calls. Close all satellite short vol. Manual review recommended before any new short positions.',
    etnAction: 'CUT 50%',
    vixAction: 'ADD AGGRESSIVELY',
    satelliteAction: 'CLOSE SHORT',
    harvesterAction: 'ON STANDBY',
  },
  4: {
    id: 4,
    name: 'VOLMAGEDDON PROTOCOL',
    badge: 'REGIME 4',
    color: 'var(--regime-4)',
    bg: 'var(--regime-4-bg)',
    border: 'var(--regime-4-border)',
    desc: 'Cover ALL ETN shorts immediately. Harvester active — scaling out VIX calls per regime signal. No new short vol. Rebuild at elevated strikes when VVIX peaks.',
    etnAction: 'COVER ALL',
    vixAction: 'HARVESTING',
    satelliteAction: 'FULLY CLOSED',
    harvesterAction: 'ACTIVE',
  },
}

export function classifyRegime(vix: number, vix3m: number, vvix: number): RegimeId {
  const ratio = vix / vix3m
  if (vix > 28 || (ratio > 1.05 && vvix > 125)) return 4
  if (vix > 20 || (ratio > 0.95 && vvix > 110)) return 3
  if (vix > 15 || vvix > 90) return 2
  return 1
}

export function regimeConfidence(vix: number, vix3m: number, vvix: number, regime: RegimeId): number {
  const scores: Record<RegimeId, number> = {
    1: Math.min(97, Math.round(60 + ((15 - vix) / 5) * 25 + ((90 - vvix) / 30) * 15)),
    2: Math.min(90, Math.round(65 + Math.abs(vix - 17.5) * 2)),
    3: Math.min(95, Math.round(55 + (vix - 20) * 4 + (vvix - 110) * 0.4)),
    4: Math.min(99, Math.round(65 + (vix - 28) * 3.5)),
  }
  return Math.max(50, scores[regime])
}

export interface CarryResult {
  uvxyContracts: number
  vixCallContracts: number
  monthlyUVXYPremium: number
  monthlyVixCallCost: number
  txCosts: number
  netCarry: number
  netCarryPct: number
  satAlloc: number
  cashReserve: number
  isPositive: boolean
  action: 'PROCEED' | 'REDUCE_25' | 'REDUCE_50'
}

export function calcCarry(
  vix: number,
  vix3m: number,
  uvxy: number,
  acctK: number,
  maxRiskPct: number,
  regime: RegimeId
): CarryResult {
  const acct = acctK * 1000
  const maxRisk = maxRiskPct / 100
  const regimeMult: Record<RegimeId, number> = { 1: 1.0, 2: 0.7, 3: 0.35, 4: 0.0 }
  const mult = regimeMult[regime]

  const contangoBonus = Math.max(0, (vix3m - vix) / vix3m)
  const uvxyPremRate = (0.014 + contangoBonus * 0.008) * mult
  const uvxyContracts = Math.max(0, Math.floor((acct * maxRisk) / (uvxy * 100)))
  const monthlyUVXYPremium = uvxyContracts * uvxy * 100 * uvxyPremRate * 4.3

  const vixCallCostRate = 0.006
  const vixCallContracts = Math.max(0, Math.floor(monthlyUVXYPremium * 0.5 / (vix * 100 * vixCallCostRate * 3)))
  const monthlyVixCallCost = vixCallContracts * vix * 100 * vixCallCostRate

  const txCosts = (uvxyContracts + vixCallContracts) * 0.65 * 4
  const netCarry = monthlyUVXYPremium - monthlyVixCallCost - txCosts
  const netCarryPct = netCarry / acct

  let action: CarryResult['action'] = 'PROCEED'
  if (netCarryPct < -0.005) action = 'REDUCE_50'
  else if (netCarryPct < 0) action = 'REDUCE_25'

  return {
    uvxyContracts,
    vixCallContracts,
    monthlyUVXYPremium,
    monthlyVixCallCost,
    txCosts,
    netCarry,
    netCarryPct,
    satAlloc: Math.round(acct * (regime >= 3 ? 0 : 0.10)),
    cashReserve: Math.round(acct * (regime >= 3 ? 0.30 : 0.15)),
    isPositive: netCarry >= 0,
    action,
  }
}

export interface TermPoint {
  label: string
  val: number
  pct: number
}

export function buildTermStructure(vix: number, vix3m: number): TermPoint[] {
  const ratio = vix / vix3m
  const isBackward = ratio >= 1.0
  const pts: { label: string; val: number }[] = [
    { label: 'SPOT', val: vix },
    { label: '1M', val: vix * (isBackward ? 0.95 : 1.04) },
    { label: '2M', val: vix3m * (isBackward ? 0.94 : 1.00) },
    { label: '3M', val: vix3m },
    { label: '6M', val: vix3m * (isBackward ? 0.88 : 0.97) },
  ]
  const max = Math.max(...pts.map(p => p.val))
  return pts.map(p => ({ ...p, val: parseFloat(p.val.toFixed(1)), pct: (p.val / max) * 100 }))
}

export function buildVolSurface(vix: number) {
  const strikes = ['80%', '90%', '100%', '110%', '120%', '130%']
  const expiries = ['1W', '2W', '1M', '2M', '3M']
  const cells: { strike: string; expiry: string; vol: number; isSellZone: boolean }[] = []

  expiries.forEach((exp, ei) => {
    strikes.forEach((str, si) => {
      const strikeNum = parseInt(str) / 100
      const termAdj = 1 + ei * 0.04
      const skewAdj = strikeNum > 1
        ? 1 + (strikeNum - 1) * 2.5
        : 1 + (1 - strikeNum) * 1.8
      const vol = parseFloat((vix * termAdj * skewAdj).toFixed(1))
      const isSellZone = si >= 2 && si <= 3 && ei <= 1
      cells.push({ strike: str, expiry: exp, vol, isSellZone })
    })
  })

  return { strikes, expiries, cells }
}
