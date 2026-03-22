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

// ─── ETN Product Universe ─────────────────────────────────────────────────────

export interface EtnProduct {
  ticker: string
  name: string
  leverage: string
  direction: 1 | -1
  liquidityGrade: 'A' | 'B' | 'C'
  decayPctPerDay: number  // base daily decay in contango (positive = costs when long)
}

export const ETN_PRODUCTS: Record<string, EtnProduct> = {
  UVXY: { ticker: 'UVXY', name: 'ProShares Ultra VIX ST',   leverage: '2x Long',      direction:  1, liquidityGrade: 'A', decayPctPerDay:  0.72 },
  UVIX: { ticker: 'UVIX', name: '2x Long VIX Futures ETF',  leverage: '2x Long',      direction:  1, liquidityGrade: 'B', decayPctPerDay:  0.70 },
  SVXY: { ticker: 'SVXY', name: 'ProShares Short VIX ST',   leverage: '0.5x Inverse', direction: -1, liquidityGrade: 'B', decayPctPerDay: -0.30 },
  VXX:  { ticker: 'VXX',  name: 'iPath S&P 500 VIX ST Fut', leverage: '1x Long',      direction:  1, liquidityGrade: 'A', decayPctPerDay:  0.35 },
}

// ─── Regime Allocation Matrix ─────────────────────────────────────────────────

export interface AllocationEntry {
  weight: number   // 0–100 %
  bias: 'LONG' | 'SHORT' | 'HEDGE' | 'OFF'
  note: string
  active: boolean
}

export const ETN_ALLOC_MATRIX: Record<RegimeId, Record<string, AllocationEntry>> = {
  1: {
    UVXY: { weight: 35, bias: 'SHORT', note: 'Max call spreads',    active: true  },
    UVIX: { weight: 10, bias: 'SHORT', note: 'Alt to UVXY',         active: true  },
    SVXY: { weight: 40, bias: 'LONG',  note: 'Heavy long carry',    active: true  },
    VXX:  { weight: 15, bias: 'SHORT', note: 'Moderate spreads',    active: true  },
  },
  2: {
    UVXY: { weight: 40, bias: 'SHORT', note: 'Spreads active',       active: true  },
    UVIX: { weight: 10, bias: 'OFF',   note: 'Monitor only',         active: false },
    SVXY: { weight: 25, bias: 'LONG',  note: 'Light long',           active: true  },
    VXX:  { weight: 25, bias: 'SHORT', note: 'Conservative spreads', active: true  },
  },
  3: {
    UVXY: { weight: 20, bias: 'SHORT', note: 'Cut 50%',              active: true  },
    UVIX: { weight: 25, bias: 'HEDGE', note: 'Hedge vehicle',        active: true  },
    SVXY: { weight: 20, bias: 'HEDGE', note: 'Reduce/hedge',         active: true  },
    VXX:  { weight: 35, bias: 'SHORT', note: 'Lower spike risk',     active: true  },
  },
  4: {
    UVXY: { weight:  0, bias: 'OFF',   note: 'No new positions',     active: false },
    UVIX: { weight:  0, bias: 'OFF',   note: 'No new positions',     active: false },
    SVXY: { weight: 50, bias: 'HEDGE', note: 'Puts = crash protect', active: true  },
    VXX:  { weight:  0, bias: 'OFF',   note: 'No new positions',     active: false },
  },
}

// ─── Multi-product Carry ──────────────────────────────────────────────────────

export interface MultiCarryResult {
  uvxyPremium: number
  uvixPremium: number
  svxyDrift: number
  vxxPremium: number
  hedgeCosts: number
  txCosts: number
  netCarry: number
  netCarryPct: number
  totalGross: number
  isPositive: boolean
}

export function calcMultiCarry(
  vix: number,
  vix3m: number,
  uvxy: number,
  uvix: number,
  svxy: number,
  vxx: number,
  acctK: number,
  maxRiskPct: number,
  regime: RegimeId,
): MultiCarryResult {
  const acct = acctK * 1000
  const maxRisk = maxRiskPct / 100
  const regimeMult: Record<RegimeId, number> = { 1: 1.0, 2: 0.7, 3: 0.35, 4: 0.0 }
  const mult = regimeMult[regime]
  const contangoBonus = Math.max(0, (vix3m - vix) / vix3m)
  const alloc = ETN_ALLOC_MATRIX[regime]

  // UVXY premium: short call spreads
  const uvxyContracts = Math.max(0, Math.floor((acct * maxRisk * (alloc.UVXY.weight / 100) * 2) / (uvxy * 100)))
  const uvxyPremium = uvxyContracts * uvxy * 100 * (0.014 + contangoBonus * 0.008) * mult * 4.3

  // UVIX premium: similar to UVXY
  const uvixContracts = Math.max(0, Math.floor((acct * maxRisk * (alloc.UVIX.weight / 100) * 2) / (uvix * 100)))
  const uvixPremium = uvixContracts * uvix * 100 * (0.013 + contangoBonus * 0.007) * mult * 4.3

  // SVXY positive drift in contango (long position)
  const svxyShares = Math.max(0, Math.floor((acct * maxRisk * (alloc.SVXY.weight / 100)) / svxy))
  const svxyDrift = svxyShares * svxy * (0.008 + contangoBonus * 0.012) * mult * 4.3

  // VXX premium: short call spreads, lower premium than UVXY
  const vxxContracts = Math.max(0, Math.floor((acct * maxRisk * (alloc.VXX.weight / 100) * 2) / (vxx * 100)))
  const vxxPremium = vxxContracts * vxx * 100 * (0.009 + contangoBonus * 0.005) * mult * 4.3

  const totalGross = uvxyPremium + uvixPremium + svxyDrift + vxxPremium

  // Hedge costs: VIX calls + regime-scaled protection
  const hedgeCosts = totalGross * (0.38 + (1 - mult) * 0.12)
  const txCosts = (uvxyContracts + uvixContracts + vxxContracts) * 0.65 * 4 + svxyShares * 0.01

  const netCarry = totalGross - hedgeCosts - txCosts
  const netCarryPct = acct > 0 ? netCarry / acct : 0

  return {
    uvxyPremium,
    uvixPremium,
    svxyDrift,
    vxxPremium,
    hedgeCosts,
    txCosts,
    netCarry,
    netCarryPct,
    totalGross,
    isPositive: netCarry >= 0,
  }
}

// ─── Relative Value Scanner ───────────────────────────────────────────────────

export interface RVEntry {
  label: string
  spread: number
  zScore: number
  signal: 'CHEAP' | 'RICH' | 'FAIR'
  desc: string
}

export function calcRelativeValue(
  uvxy: number,
  uvix: number,
  svxy: number,
  vxx: number,
): RVEntry[] {
  // UVXY vs UVIX: both 2x products, spread = % difference
  const uvxyUvixSpread = ((uvxy - uvix) / ((uvxy + uvix) / 2)) * 100
  const uvxyUvixZ = parseFloat(((uvxyUvixSpread - 2.0) / 3.0).toFixed(2))

  // SVXY vs synthetic inverse: synthSVXY estimated from uvxy level
  const synthSvxy = Math.max(5, 100 - uvxy * 0.42)
  const svxySynthSpread = ((svxy - synthSvxy) / synthSvxy) * 100
  const svxySynthZ = parseFloat(((svxySynthSpread - 5.0) / 8.0).toFixed(2))

  // VXX vs 0.5× UVXY: VXX (1x) should theoretically track at ~half UVXY (2x) vol
  const synthVxx = uvxy * 0.50
  const vxxSynthSpread = ((vxx - synthVxx) / synthVxx) * 100
  const vxxSynthZ = parseFloat(((vxxSynthSpread - (-5.0)) / 6.0).toFixed(2))

  function sig(z: number): RVEntry['signal'] {
    return z > 1.0 ? 'RICH' : z < -1.0 ? 'CHEAP' : 'FAIR'
  }

  return [
    {
      label: 'UVXY / UVIX SPREAD',
      spread: parseFloat(uvxyUvixSpread.toFixed(2)),
      zScore: uvxyUvixZ,
      signal: sig(uvxyUvixZ),
      desc: uvxyUvixZ > 1
        ? 'UVXY rich vs UVIX — prefer UVIX shorts'
        : uvxyUvixZ < -1
          ? 'UVIX rich vs UVXY — prefer UVXY shorts'
          : 'Parity within normal band',
    },
    {
      label: 'SVXY / SYNTHETIC',
      spread: parseFloat(svxySynthSpread.toFixed(2)),
      zScore: svxySynthZ,
      signal: sig(svxySynthZ),
      desc: svxySynthZ > 1
        ? 'SVXY overvalued vs model — reduce long'
        : svxySynthZ < -1
          ? 'SVXY undervalued — good long entry signal'
          : 'SVXY fairly priced vs inverse model',
    },
    {
      label: 'VXX / 0.5× UVXY',
      spread: parseFloat(vxxSynthSpread.toFixed(2)),
      zScore: vxxSynthZ,
      signal: sig(vxxSynthZ),
      desc: vxxSynthZ > 1
        ? 'VXX rich vs UVXY — use UVXY spreads instead'
        : vxxSynthZ < -1
          ? 'VXX cheap — better short target than UVXY'
          : 'VXX/UVXY ratio in normal band',
    },
  ]
}

// ─── Per-product vol premium scan ────────────────────────────────────────────

export interface ProductVolEntry {
  ticker: string
  atmVol: number       // estimated ATM IV
  premiumGrade: 'HIGH' | 'MED' | 'LOW'
  sellZone: string     // e.g. "110%C · 2W"
  richness: number     // 0–100 relative premium score
}

export function buildProductVolScan(
  vix: number,
  uvxy: number,
  uvix: number,
  svxy: number,
  vxx: number,
): ProductVolEntry[] {
  // ATM IV rough estimates by product
  const uvxyAtmVol  = parseFloat((vix * 2.8).toFixed(1))
  const uvixAtmVol  = parseFloat((vix * 2.75).toFixed(1))
  const svxyAtmVol  = parseFloat((vix * 1.2).toFixed(1))
  const vxxAtmVol   = parseFloat((vix * 1.55).toFixed(1))

  const maxVol = Math.max(uvxyAtmVol, uvixAtmVol, svxyAtmVol, vxxAtmVol)

  function grade(vol: number): ProductVolEntry['premiumGrade'] {
    const r = vol / maxVol
    return r > 0.75 ? 'HIGH' : r > 0.50 ? 'MED' : 'LOW'
  }

  return [
    { ticker: 'UVXY', atmVol: uvxyAtmVol, premiumGrade: grade(uvxyAtmVol), sellZone: `$${(uvxy * 1.27).toFixed(2)}C · 2W`, richness: Math.round((uvxyAtmVol / maxVol) * 100) },
    { ticker: 'UVIX', atmVol: uvixAtmVol, premiumGrade: grade(uvixAtmVol), sellZone: `$${(uvix * 1.27).toFixed(2)}C · 2W`, richness: Math.round((uvixAtmVol / maxVol) * 100) },
    { ticker: 'SVXY', atmVol: svxyAtmVol, premiumGrade: grade(svxyAtmVol), sellZone: `$${(svxy * 0.92).toFixed(2)}P · 1M`, richness: Math.round((svxyAtmVol / maxVol) * 100) },
    { ticker: 'VXX',  atmVol: vxxAtmVol,  premiumGrade: grade(vxxAtmVol),  sellZone: `$${(vxx  * 1.20).toFixed(2)}C · 2W`, richness: Math.round((vxxAtmVol  / maxVol) * 100) },
  ]
}
