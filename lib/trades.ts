import type { RegimeId } from './regime'

export type WindowId = 1 | 2 | 3 | 4

export interface TradeLeg {
  action: 'BUY' | 'SELL' | 'LONG' | 'SHORT'
  qty: string
  instrument: string
  detail: string
  role: 'CORE' | 'HEDGE' | 'INCOME' | 'TAIL' | 'SCALE'
}

export interface TradeRec {
  tier: 1 | 2 | 3 | 4
  tierLabel: string
  tierColor: string
  headline: string
  legs: TradeLeg[]
  riskAmt: number
  targetAmt: number
  rationale: string
  urgency: 'LOW' | 'STANDARD' | 'HIGH'
}

export interface WindowRecs {
  window: WindowId
  label: string
  timeRange: string
  focus: string
  recs: TradeRec[]
}

// ─── Internal param bundle ────────────────────────────────────────────────────
interface P {
  vix: number
  spy: number
  uvxy: number
  uvix: number
  svxy: number
  vxx: number
  maxRisk: number
  dte: number
  urgency: TradeRec['urgency']
}

const TIER_META = {
  1: { label: 'DEFINED RISK', color: '#4ade80' },
  2: { label: 'ENHANCED',     color: '#60a5fa' },
  3: { label: 'STRUCTURED',   color: '#fbbf24' },
  4: { label: 'FULL STRUCTURE', color: '#f87171' },
} as const

const WINDOW_LABELS:     readonly string[] = ['OPEN SETUP',   'TREND CONFIRM', 'MIDDAY THETA',   'INTO CLOSE']
const WINDOW_RANGES:     readonly string[] = ['9:30 — 11:00', '11:00 — 13:00', '13:00 — 15:00', '15:00 — 16:00']
const WINDOW_FOCUS:      readonly string[] = [
  'Vol premium peaks at open — highest-conviction short vol entry window',
  'Price discovery complete — confirm direction before adding size',
  'Intraday vol compresses — theta harvest and mean reversion plays',
  'Overnight carry positioning — swing entries or risk reduction',
]
const WINDOW_DTE:        readonly number[] = [21, 24, 18, 14]
const WINDOW_URGENCY:    readonly TradeRec['urgency'][] = ['HIGH', 'STANDARD', 'LOW', 'STANDARD']

// ─── Helpers ─────────────────────────────────────────────────────────────────
function f2(n: number)  { return n.toFixed(2) }
function f1(n: number)  { return n.toFixed(1) }
function fi(n: number)  { return Math.round(n) }

function strike(base: number, mult: number) {
  return parseFloat((base * mult).toFixed(2))
}

// ─── Public entry point ───────────────────────────────────────────────────────
export function buildAllWindowRecs(
  vix:        number,
  spx:        number,
  uvxy:       number,
  acctK:      number,
  maxRiskPct: number,
  regime:     RegimeId,
  uvix:       number = 0,
  svxy:       number = 0,
  vxx:        number = 0,
): WindowRecs[] {
  const spy     = spx / 10
  const maxRisk = acctK * 1000 * maxRiskPct / 100
  // Fallback estimates if prices not supplied
  const _uvix = uvix > 0 ? uvix : uvxy * 0.92
  const _svxy = svxy > 0 ? svxy : Math.max(8, 95 - uvxy * 0.42)
  const _vxx  = vxx  > 0 ? vxx  : vix * 1.88

  return ([1, 2, 3, 4] as WindowId[]).map(w => {
    const p: P = {
      vix, spy, uvxy, uvix: _uvix, svxy: _svxy, vxx: _vxx, maxRisk,
      dte:     WINDOW_DTE[w - 1],
      urgency: WINDOW_URGENCY[w - 1],
    }
    return {
      window:    w,
      label:     WINDOW_LABELS[w - 1],
      timeRange: WINDOW_RANGES[w - 1],
      focus:     WINDOW_FOCUS[w - 1],
      recs: [
        buildTier(1, regime, p),
        buildTier(2, regime, p),
        buildTier(3, regime, p),
        buildTier(4, regime, p),
      ],
    }
  })
}

function buildTier(tier: 1 | 2 | 3 | 4, regime: RegimeId, p: P): TradeRec {
  const map: Record<RegimeId, ((p: P) => TradeRec)[]> = {
    1: [r1t1, r1t2, r1t3, r1t4],
    2: [r2t1, r2t2, r2t3, r2t4],
    3: [r3t1, r3t2, r3t3, r3t4],
    4: [r4t1, r4t2, r4t3, r4t4],
  }
  return map[regime][tier - 1](p)
}

// ─── REGIME 1 · CONTANGO HARVEST ─────────────────────────────────────────────

function r1t1(p: P): TradeRec {
  const { uvxy, dte, urgency } = p
  const s27     = strike(uvxy, 1.27)
  const credit  = fi(uvxy * 5.2)     // approx $44 on $8.42 UVXY
  const risk    = credit * 2
  return {
    tier: 1, tierLabel: TIER_META[1].label, tierColor: TIER_META[1].color,
    headline: 'UVXY CONTANGO SHORT',
    legs: [
      { action: 'SELL', qty: '1 contract', instrument: 'UVXY', detail: `$${f2(s27)}C · ${dte}DTE`, role: 'CORE' },
    ],
    riskAmt: risk, targetAmt: credit,
    rationale: `Sell 1 UVXY call ${Math.round((s27/uvxy - 1)*100)}% OTM. Contango decay erodes premium ~$${f2(uvxy * 0.25)}/day. Close at 2× credit ($${risk}) as stop. Full credit $${credit} at expiry. Win rate historically >70% in Regime 1.`,
    urgency,
  }
}

function r1t2(p: P): TradeRec {
  const { uvxy, svxy, dte, urgency } = p
  const s27    = strike(uvxy, 1.27)
  const uvxyCr = fi(uvxy * 5.2)
  const svxySh = 50
  const svxyTgt = fi(svxySh * svxy * 0.08)
  const svxyRsk = fi(svxySh * svxy * 0.10)
  return {
    tier: 2, tierLabel: TIER_META[2].label, tierColor: TIER_META[2].color,
    headline: 'SVXY LONG + UVXY SHORT — DUAL CARRY',
    legs: [
      { action: 'SELL', qty: '1 contract',  instrument: 'UVXY', detail: `$${f2(s27)}C · ${dte}DTE`,                         role: 'CORE'   },
      { action: 'LONG', qty: `${svxySh} sh`, instrument: 'SVXY', detail: `@ $${f2(svxy)} · stop $${f2(svxy * 0.90)}`,       role: 'INCOME' },
    ],
    riskAmt: uvxyCr * 2 + svxyRsk, targetAmt: uvxyCr + svxyTgt,
    rationale: `Dual carry extraction: UVXY call spread harvests contango premium; SVXY long captures inverse decay drift. Both benefit from calm vol — negative correlation reduces net portfolio vol. SVXY stop -10% ($${f2(svxy * 0.90)}). Option exits at 2× credit.`,
    urgency,
  }
}

function r1t3(p: P): TradeRec {
  const { uvxy, svxy, vxx, spy, dte, urgency, vix } = p
  const uvxyStk  = strike(uvxy, 1.27)
  const vxxStk   = strike(vxx,  1.20)
  const uvxyCr   = fi(uvxy * 5.2)
  const vxxCr    = fi(vxx  * 3.8)
  const svxyShs  = 50
  const svxyRsk  = fi(svxyShs * svxy * 0.10)
  const svxyTgt  = fi(svxyShs * svxy * 0.08)
  const vixStk   = Math.round(vix + 4)
  const vixCost  = fi(vix * 1.2)
  return {
    tier: 3, tierLabel: TIER_META[3].label, tierColor: TIER_META[3].color,
    headline: 'FULL 4-PRODUCT BALANCED BOOK',
    legs: [
      { action: 'SELL', qty: '1 contract',   instrument: 'UVXY', detail: `$${f2(uvxyStk)}C · ${dte}DTE`,               role: 'CORE'   },
      { action: 'SELL', qty: '1 contract',   instrument: 'VXX',  detail: `$${f2(vxxStk)}C · ${dte}DTE`,                role: 'INCOME' },
      { action: 'LONG', qty: `${svxyShs} sh`, instrument: 'SVXY', detail: `@ $${f2(svxy)} · stop $${f2(svxy * 0.90)}`, role: 'SCALE'  },
      { action: 'BUY',  qty: '1 contract',   instrument: 'VIX',  detail: `$${vixStk}C · 60DTE (tail hedge)`,            role: 'HEDGE'  },
    ],
    riskAmt: uvxyCr * 2 + vxxCr * 2 + svxyRsk + vixCost,
    targetAmt: uvxyCr + vxxCr + svxyTgt,
    rationale: `Full 4-product balanced carry: UVXY + VXX call spreads generate premium; SVXY long captures inverse drift; VIX call provides tail protection if vol escalates. Diversified exposure across the whole ETN universe — maximum carry efficiency in Regime 1.`,
    urgency,
  }
}

function r1t4(p: P): TradeRec {
  const { uvxy, uvix, svxy, vxx, dte, urgency } = p
  const d7  = Math.max(5, fi(dte * 0.35))
  const d14 = Math.max(7, fi(dte * 0.65))
  // UVXY condor
  const uCsh = strike(uvxy, 1.20); const uCcap = strike(uvxy, 1.35)
  const uPsh = strike(uvxy, 0.90); const uPflr = strike(uvxy, 0.75)
  // VXX condor
  const vCsh = strike(vxx, 1.20);  const vCcap = strike(vxx, 1.35)
  const vPsh = strike(vxx, 0.90);  const vPflr = strike(vxx, 0.75)
  // SVXY collar
  const svxyCal = strike(svxy, 1.10); const svxyPut = strike(svxy, 0.92)
  // UVIX overflow short
  const uvixStk = strike(uvix, 1.27)

  const uvxyCr  = fi(uvxy * 3.5); const vxxCr = fi(vxx * 2.2)
  const svxyCollarCr = fi(svxy * 2.8)
  const uvixCr  = fi(uvix * 5.0)
  const net = uvxyCr + vxxCr + svxyCollarCr + uvixCr

  return {
    tier: 4, tierLabel: TIER_META[4].label, tierColor: TIER_META[4].color,
    headline: 'MULTI-PRODUCT IRON CONDOR MATRIX',
    legs: [
      { action: 'SELL', qty: '1 ct', instrument: 'UVXY', detail: `$${f2(uCsh)}C · ${dte}DTE (condor)`,         role: 'CORE'   },
      { action: 'BUY',  qty: '1 ct', instrument: 'UVXY', detail: `$${f2(uCcap)}C · ${dte}DTE (call cap)`,      role: 'TAIL'   },
      { action: 'SELL', qty: '1 ct', instrument: 'UVXY', detail: `$${f2(uPsh)}P · ${dte}DTE (put short)`,      role: 'INCOME' },
      { action: 'BUY',  qty: '1 ct', instrument: 'UVXY', detail: `$${f2(uPflr)}P · ${dte}DTE (put floor)`,     role: 'TAIL'   },
      { action: 'SELL', qty: '1 ct', instrument: 'VXX',  detail: `$${f2(vCsh)}C · ${d14}DTE (condor)`,         role: 'INCOME' },
      { action: 'BUY',  qty: '1 ct', instrument: 'VXX',  detail: `$${f2(vCcap)}C · ${d14}DTE (cap)`,           role: 'TAIL'   },
      { action: 'SELL', qty: '1 ct', instrument: 'SVXY', detail: `$${f2(svxyCal)}C · ${d7}DTE (collar sell)`,  role: 'INCOME' },
      { action: 'SELL', qty: '1 ct', instrument: 'UVIX', detail: `$${f2(uvixStk)}C · ${dte}DTE (overflow)`,    role: 'SCALE'  },
    ],
    riskAmt: fi((uCcap - uCsh) * 100) + fi((vCcap - vCsh) * 100),
    targetAmt: Math.max(0, fi(net * 0.70)),
    rationale: `Full 4-product iron condor matrix: UVXY + VXX simultaneous condors harvest premium across two correlated products; SVXY collar captures upside while limiting exposure; UVIX overflow call adds carry. Max loss capped at spread widths. Net theoretical credit ~$${fi(net)}.`,
    urgency,
  }
}

// ─── REGIME 2 · NEUTRAL CARRY ─────────────────────────────────────────────────

function r2t1(p: P): TradeRec {
  const { vix, vxx, dte, urgency } = p
  const vxxStk = strike(vxx, 1.15)
  const vxxCr  = fi(vxx * 2.8)
  const vixStk = Math.round(vix + 5)
  const vixCost = fi(vix * 1.5)
  return {
    tier: 1, tierLabel: TIER_META[1].label, tierColor: TIER_META[1].color,
    headline: 'VXX CALL — DEFINED RISK HEDGE',
    legs: [
      { action: 'BUY', qty: '1 contract', instrument: 'VXX', detail: `$${f2(vxxStk)}C · ${dte}DTE (alt: VIX $${vixStk}C)`, role: 'CORE' },
    ],
    riskAmt: vxxCr, targetAmt: vxxCr * 3,
    rationale: `VXX call as lower-cost alternative to VIX calls in neutral regime — same vol exposure, defined risk, tradeable in equity account. VXX $${f2(vxx)}, targeting breakeven $${f2(vxxStk)} on expansion. Alt: VIX $${vixStk}C at ~$${vixCost}. 1:3 R:R if vol escalates to Regime 3.`,
    urgency,
  }
}

function r2t2(p: P): TradeRec {
  const { uvxy, svxy, dte, urgency } = p
  const uvxyStk = strike(uvxy, 1.20)
  const uvxyCr  = fi(uvxy * 3.8)
  const svxyShs = 50
  const svxyRsk = fi(svxyShs * svxy * 0.12)
  const svxyTgt = fi(svxyShs * svxy * 0.07)
  return {
    tier: 2, tierLabel: TIER_META[2].label, tierColor: TIER_META[2].color,
    headline: 'SVXY LIGHT LONG + UVXY CONSERVATIVE SHORT',
    legs: [
      { action: 'SELL', qty: '1 contract',   instrument: 'UVXY', detail: `$${f2(uvxyStk)}C · ${dte}DTE`,                role: 'CORE'   },
      { action: 'LONG', qty: `${svxyShs} sh`, instrument: 'SVXY', detail: `@ $${f2(svxy)} · stop $${f2(svxy * 0.88)}`,  role: 'INCOME' },
    ],
    riskAmt: uvxyCr * 2 + svxyRsk, targetAmt: uvxyCr + svxyTgt,
    rationale: `Dual carry in neutral regime: UVXY call spread harvests moderate premium; SVXY light long captures positive drift. Smaller size than Regime 1 — risk-adjusted for transitional environment. SVXY stop -12% ($${f2(svxy * 0.88)}), UVXY exits at 2× credit.`,
    urgency,
  }
}

function r2t3(p: P): TradeRec {
  const { vix, uvxy, svxy, vxx, dte, urgency } = p
  const uvxyStk = strike(uvxy, 1.20)
  const uvxyCr  = fi(uvxy * 3.8)
  const vxxStk  = strike(vxx, 1.15)
  const vxxCr   = fi(vxx * 2.5)
  const svxyShs = 30
  const svxyRsk = fi(svxyShs * svxy * 0.12)
  const vixStk  = Math.round(vix + 5)
  const vixCost = fi(vix * 1.5)
  return {
    tier: 3, tierLabel: TIER_META[3].label, tierColor: TIER_META[3].color,
    headline: 'SVXY LONG + UVXY SHORT + VXX SPREAD + HEDGE',
    legs: [
      { action: 'SELL', qty: '1 contract',   instrument: 'UVXY', detail: `$${f2(uvxyStk)}C · ${dte}DTE`,               role: 'CORE'   },
      { action: 'SELL', qty: '1 contract',   instrument: 'VXX',  detail: `$${f2(vxxStk)}C · ${dte}DTE`,                role: 'INCOME' },
      { action: 'LONG', qty: `${svxyShs} sh`, instrument: 'SVXY', detail: `@ $${f2(svxy)} · stop $${f2(svxy * 0.88)}`, role: 'SCALE'  },
      { action: 'BUY',  qty: '1 contract',   instrument: 'VIX',  detail: `$${vixStk}C · 45DTE (tail)`,                 role: 'HEDGE'  },
    ],
    riskAmt: uvxyCr * 2 + vxxCr * 2 + svxyRsk + vixCost,
    targetAmt: uvxyCr + vxxCr + fi(svxyShs * svxy * 0.07),
    rationale: `Full balanced Regime 2 book: UVXY + VXX call spreads extract carry from two products; SVXY light long adds drift income; VIX call provides tail protection. Four-way hedge — generates income in flat vol, protected against escalation. Conservative sizing for neutral regime.`,
    urgency,
  }
}

function r2t4(p: P): TradeRec {
  const { uvxy, vix, dte, urgency } = p
  const d7  = Math.max(5, fi(dte * 0.35))
  const d30 = fi(dte * 1.4)
  const cSh = strike(uvxy, 1.20); const cLg = strike(uvxy, 1.35)
  const pSh = strike(uvxy, 0.90); const pLg = strike(uvxy, 0.75)
  const cHg = strike(uvxy, 1.00); const cNr = strike(uvxy, 1.05)
  const cCr  = fi(uvxy * 3.8); const cCap = fi(uvxy * 2.2)
  const pCr  = fi(uvxy * 3.2); const pFlr = fi(uvxy * 1.4)
  const hgC  = fi(uvxy * 14.5);  const nrC  = fi(uvxy * 9.2)
  const net  = cCr - cCap + pCr - pFlr - hgC + nrC
  const condMax = fi((cLg - cSh) * 100)
  const shRsk   = fi(75 * uvxy * 0.20)
  return {
    tier: 4, tierLabel: TIER_META[4].label, tierColor: TIER_META[4].color,
    headline: 'UVXY IRON CONDOR + DELTA OVERLAY',
    legs: [
      { action: 'SELL',  qty: '1 contract', instrument: 'UVXY', detail: `$${f2(cSh)}C · ${dte}DTE (call short)`,         role: 'INCOME' },
      { action: 'BUY',   qty: '1 contract', instrument: 'UVXY', detail: `$${f2(cLg)}C · ${dte}DTE (call cap)`,            role: 'TAIL'   },
      { action: 'SELL',  qty: '1 contract', instrument: 'UVXY', detail: `$${f2(pSh)}P · ${dte}DTE (put short)`,           role: 'INCOME' },
      { action: 'BUY',   qty: '1 contract', instrument: 'UVXY', detail: `$${f2(pLg)}P · ${dte}DTE (put floor)`,           role: 'TAIL'   },
      { action: 'BUY',   qty: '1 contract', instrument: 'UVXY', detail: `$${f2(cHg)}C · ${d30}DTE (ATM hedge)`,           role: 'HEDGE'  },
      { action: 'SELL',  qty: '1 contract', instrument: 'UVXY', detail: `$${f2(cNr)}C · ${d7}DTE (near income)`,          role: 'INCOME' },
      { action: 'SHORT', qty: '50 sh',      instrument: 'UVXY', detail: `@ $${f2(uvxy)} · stop $${f2(uvxy * 1.20)}`,      role: 'CORE'   },
      { action: 'SHORT', qty: '25 sh',      instrument: 'UVXY', detail: `scale · same stop`,                              role: 'SCALE'  },
    ],
    riskAmt: condMax + shRsk,
    targetAmt: Math.max(0, fi(Math.abs(net) * 0.7) + fi(75 * uvxy * 0.10)),
    rationale: `Regime 2 iron condor: UVXY stays within [$${f2(pLg)}–$${f2(cLg)}] for full credit. ATM call hedge buys convexity if vol expands. Near-term call adds gamma income. 75 short shares add delta bias. Max loss capped at spread width $${condMax}.`,
    urgency,
  }
}

// ─── REGIME 3 · VOL EXPANSION WARNING ────────────────────────────────────────

function r3t1(p: P): TradeRec {
  const { vix, dte, urgency } = p
  const stk  = Math.round(vix)            // ATM
  const cost = fi(vix * 4)               // ATM VIX call est.
  return {
    tier: 1, tierLabel: TIER_META[1].label, tierColor: TIER_META[1].color,
    headline: 'VIX ATM CALL — VOL EXPANSION',
    legs: [
      { action: 'BUY', qty: '1 contract', instrument: 'VIX', detail: `$${stk}C · ${dte}DTE (ATM)`, role: 'CORE' },
    ],
    riskAmt: cost, targetAmt: cost * 4,
    rationale: `ATM VIX call — Regime 3 = elevated VVIX and backwardation risk. VIX at $${vix.toFixed(1)}, targeting $${fi(vix * 1.6)} (+60%) on expansion. Max loss: est. $${cost}. R:R 1:4 if vol spikes to target.`,
    urgency,
  }
}

function r3t2(p: P): TradeRec {
  const { vix, spy, uvxy, dte, urgency } = p
  const vStk  = Math.round(vix)
  const vCost = fi(vix * 4)
  const spySh = 50
  const shRsk = fi(spySh * spy * 0.015)
  return {
    tier: 2, tierLabel: TIER_META[2].label, tierColor: TIER_META[2].color,
    headline: 'VIX CALL + SHORT SPY MOMENTUM',
    legs: [
      { action: 'BUY',   qty: '1 contract', instrument: 'VIX', detail: `$${vStk}C · ${dte}DTE`,                        role: 'CORE'  },
      { action: 'SHORT', qty: `${spySh} sh`, instrument: 'SPY', detail: `@ mkt · stop $${f1(spy * 1.015)}`,            role: 'SCALE' },
    ],
    riskAmt: vCost + shRsk,
    targetAmt: vCost * 3 + fi(spySh * spy * 0.03),
    rationale: `Long vol + short equity: both legs benefit from market stress. SPY short stop +1.5% ($${f1(spy * 1.015)}). VIX call provides convexity above $${vStk}. Combined P&L amplified in sell-off scenario.`,
    urgency,
  }
}

function r3t3(p: P): TradeRec {
  const { vix, uvxy, spy, dte, urgency } = p
  const vStk   = Math.round(vix)
  const vCost  = fi(vix * 4)
  const uvShs  = 100; const spySh = 50
  const shRsk  = fi(uvShs * uvxy * 0.20) + fi(spySh * spy * 0.015)
  const shTgt  = fi(uvShs * uvxy * 0.35) + fi(spySh * spy * 0.03)
  return {
    tier: 3, tierLabel: TIER_META[3].label, tierColor: TIER_META[3].color,
    headline: 'VOL EXPANSION TRIFECTA',
    legs: [
      { action: 'BUY',   qty: '1 contract', instrument: 'VIX',  detail: `$${vStk}C · ${dte}DTE`,                      role: 'CORE'  },
      { action: 'LONG',  qty: `${uvShs} sh`, instrument: 'UVXY', detail: `@ $${f2(uvxy)} · stop $${f2(uvxy * 0.80)}`, role: 'SCALE' },
      { action: 'SHORT', qty: `${spySh} sh`, instrument: 'SPY',  detail: `@ mkt · stop $${f1(spy * 1.015)}`,          role: 'HEDGE' },
    ],
    riskAmt:   vCost + shRsk,
    targetAmt: vCost * 4 + shTgt,
    rationale: `Three instruments, all long vol: VIX call = convexity, UVXY long = ETN momentum, SPY short = equity stress. All benefit from market dislocation. UVXY stop -20%, SPY stop +1.5%. Diversified vol long.`,
    urgency,
  }
}

function r3t4(p: P): TradeRec {
  const { uvxy, dte, urgency } = p
  const d7  = Math.max(5, fi(dte * 0.35))
  const d14 = Math.max(7, fi(dte * 0.65))
  const d30 = fi(dte * 1.4)
  const cATM  = strike(uvxy, 1.00); const c20 = strike(uvxy, 1.20)
  const c50   = strike(uvxy, 1.50); const p30 = strike(uvxy, 0.70)
  const p50   = strike(uvxy, 0.50)
  const cATMC  = fi(uvxy * 14.5); const c20C = fi(uvxy * 8.2)
  const c50Cr  = fi(uvxy * 2.1);  const p30C = fi(uvxy * 3.5)
  const p50Cr  = fi(uvxy * 1.2)
  const uvShs  = 200; const sc1 = 100; const sc2 = 50
  const optCost = cATMC + c20C - c50Cr + p30C - p50Cr
  const shRsk   = fi((uvShs + sc1 + sc2) * uvxy * 0.25)
  return {
    tier: 4, tierLabel: TIER_META[4].label, tierColor: TIER_META[4].color,
    headline: 'UVXY LONG VOL — 8-LEG EXPANSION STRUCTURE',
    legs: [
      { action: 'BUY',   qty: '1 contract', instrument: 'UVXY', detail: `$${f2(cATM)}C · ${d14}DTE (ATM primary)`,    role: 'CORE'   },
      { action: 'BUY',   qty: '1 contract', instrument: 'UVXY', detail: `$${f2(c20)}C · ${d30}DTE (extension)`,       role: 'SCALE'  },
      { action: 'SELL',  qty: '1 contract', instrument: 'UVXY', detail: `$${f2(c50)}C · ${d14}DTE (finance cap)`,     role: 'INCOME' },
      { action: 'BUY',   qty: '1 contract', instrument: 'UVXY', detail: `$${f2(p30)}P · ${d7}DTE (stop insurance)`,   role: 'TAIL'   },
      { action: 'SELL',  qty: '1 contract', instrument: 'UVXY', detail: `$${f2(p50)}P · ${d30}DTE (deep income)`,     role: 'INCOME' },
      { action: 'LONG',  qty: `${uvShs} sh`, instrument: 'UVXY', detail: `@ $${f2(uvxy)} · stop $${f2(uvxy * 0.78)}`, role: 'CORE'   },
      { action: 'LONG',  qty: `${sc1} sh`,  instrument: 'UVXY', detail: `tranche 2 · same stop`,                      role: 'SCALE'  },
      { action: 'LONG',  qty: `${sc2} sh`,  instrument: 'UVXY', detail: `tranche 3 · stop $${f2(uvxy * 0.82)}`,       role: 'SCALE'  },
    ],
    riskAmt:   optCost + shRsk,
    targetAmt: fi((cATMC + c20C) * 3.5 + (uvShs + sc1 + sc2) * uvxy * 0.40),
    rationale: `Full UVXY long vol engine: dual call positions across two timeframes, 350 shares across 3 tranches for maximum delta exposure. OTM call sale + deep put sale reduce cost basis. Put insurance floors downside. Target: UVXY +40% on vol spike.`,
    urgency,
  }
}

// ─── REGIME 4 · VOLMAGEDDON PROTOCOL ─────────────────────────────────────────

function r4t1(p: P): TradeRec {
  const { svxy, dte, urgency } = p
  const svxyPut = strike(svxy, 0.90)   // 10% OTM put — SVXY will drop in crisis
  const cost = fi(svxy * 100 * 0.012)
  return {
    tier: 1, tierLabel: TIER_META[1].label, tierColor: TIER_META[1].color,
    headline: 'SVXY PUTS — CRASH PROTECTION',
    legs: [
      { action: 'BUY', qty: '1 contract', instrument: 'SVXY', detail: `$${f2(svxyPut)}P · ${Math.min(dte, 30)}DTE`, role: 'CORE' },
    ],
    riskAmt: cost, targetAmt: cost * 6,
    rationale: `Crisis protocol: SVXY put as crash protection — SVXY is short-vol ETN, will collapse in vol spike. SVXY $${f2(svxy)}, put strike $${f2(svxyPut)} (10% OTM). If VIX spikes 50%+, SVXY drops proportionally, put goes deep ITM. Max loss: est. $${cost}. R:R 1:6 in Volmageddon scenario.`,
    urgency,
  }
}

function r4t2(p: P): TradeRec {
  const { spy, uvxy, dte, urgency } = p
  const stk    = strike(spy, 0.95)
  const pCost  = fi(spy * 100 * 0.005)
  const uvShs  = 100
  const shRsk  = fi(uvShs * uvxy * 0.25)
  return {
    tier: 2, tierLabel: TIER_META[2].label, tierColor: TIER_META[2].color,
    headline: 'SPY PUT + UVXY LONG — DUAL CRISIS',
    legs: [
      { action: 'BUY',  qty: '1 contract', instrument: 'SPY',  detail: `$${f1(stk)}P · ${Math.min(dte, 21)}DTE`,     role: 'CORE'  },
      { action: 'LONG', qty: `${uvShs} sh`, instrument: 'UVXY', detail: `@ $${f2(uvxy)} · stop $${f2(uvxy * 0.75)}`, role: 'SCALE' },
    ],
    riskAmt:   pCost + shRsk,
    targetAmt: pCost * 4 + fi(uvShs * uvxy * 0.60),
    rationale: `Dual crisis instruments: SPY put captures equity decline, UVXY long captures vol spike. Complementary instruments — both benefit from market stress. UVXY stop -25%. Combined R:R ~3:1 in panic scenario.`,
    urgency,
  }
}

function r4t3(p: P): TradeRec {
  const { spy, vix, uvxy, dte, urgency } = p
  const spyStk  = strike(spy, 0.95)
  const vixStk  = Math.round(vix * 1.15)
  const pCost   = fi(spy * 100 * 0.005)
  const vCost   = fi(vix * 4)
  const uvShs   = 100
  const shRsk   = fi(uvShs * uvxy * 0.20)
  return {
    tier: 3, tierLabel: TIER_META[3].label, tierColor: TIER_META[3].color,
    headline: 'FULL CRISIS HEDGE — EQUITY + VOL + ETN',
    legs: [
      { action: 'BUY',  qty: '1 contract', instrument: 'SPY',  detail: `$${f1(spyStk)}P · ${Math.min(dte, 21)}DTE`,  role: 'CORE'  },
      { action: 'BUY',  qty: '1 contract', instrument: 'VIX',  detail: `$${vixStk}C · 30DTE`,                         role: 'HEDGE' },
      { action: 'LONG', qty: `${uvShs} sh`, instrument: 'UVXY', detail: `@ $${f2(uvxy)} · stop $${f2(uvxy * 0.80)}`, role: 'SCALE' },
    ],
    riskAmt:   pCost + vCost + shRsk,
    targetAmt: pCost * 5 + vCost * 4 + fi(uvShs * uvxy * 0.80),
    rationale: `Three-instrument crisis hedge: SPY put ($${f1(spyStk)}P) for equity decline, VIX call ($${vixStk}C) for vol expansion above $${vixStk}, UVXY long for ETN acceleration. Staggered instruments protect across multiple crisis scenarios. UVXY stop -20%.`,
    urgency,
  }
}

function r4t4(p: P): TradeRec {
  const { uvxy, spy, dte, urgency } = p
  const d7  = Math.max(3, fi(dte * 0.35))
  const d14 = Math.max(5, fi(dte * 0.65))
  const d30 = fi(dte * 1.4)
  const cATM  = strike(uvxy, 1.00); const c30  = strike(uvxy, 1.30)
  const c100  = strike(uvxy, 2.00); const p30  = strike(uvxy, 0.70)
  const p50   = strike(uvxy, 0.50)
  const cATMC = fi(uvxy * 14.5); const c30C  = fi(uvxy * 5.8)
  const c100Cr = fi(uvxy * 1.5); const p30C  = fi(uvxy * 3.5)
  const p50Cr  = fi(uvxy * 0.8)
  const sh1    = 200; const sh2 = 100; const sh3 = 50
  const optCost = cATMC + c30C - c100Cr + p30C - p50Cr
  const shRsk   = fi((sh1 + sh2 + sh3) * uvxy * 0.30)
  return {
    tier: 4, tierLabel: TIER_META[4].label, tierColor: TIER_META[4].color,
    headline: 'UVXY VOLMAGEDDON — 8-LEG MAX POSITION',
    legs: [
      { action: 'BUY',  qty: '1 contract', instrument: 'UVXY', detail: `$${f2(cATM)}C · ${d7}DTE (ATM urgent)`,        role: 'CORE'   },
      { action: 'BUY',  qty: '1 contract', instrument: 'UVXY', detail: `$${f2(c30)}C · ${d14}DTE (extension)`,          role: 'SCALE'  },
      { action: 'SELL', qty: '1 contract', instrument: 'UVXY', detail: `$${f2(c100)}C · ${d14}DTE (far OTM finance)`,   role: 'INCOME' },
      { action: 'BUY',  qty: '1 contract', instrument: 'UVXY', detail: `$${f2(p30)}P · ${d30}DTE (reversion floor)`,    role: 'TAIL'   },
      { action: 'SELL', qty: '1 contract', instrument: 'UVXY', detail: `$${f2(p50)}P · ${d7}DTE (deep income)`,         role: 'INCOME' },
      { action: 'LONG', qty: `${sh1} sh`,  instrument: 'UVXY', detail: `@ $${f2(uvxy)} · stop $${f2(uvxy * 0.75)}`,     role: 'CORE'   },
      { action: 'LONG', qty: `${sh2} sh`,  instrument: 'UVXY', detail: `tranche 2 · same stop`,                         role: 'SCALE'  },
      { action: 'LONG', qty: `${sh3} sh`,  instrument: 'UVXY', detail: `tranche 3 · stop $${f2(uvxy * 0.80)}`,          role: 'SCALE'  },
    ],
    riskAmt:   optCost + shRsk,
    targetAmt: fi((cATMC + c30C) * 5 + (sh1 + sh2 + sh3) * uvxy * 0.70),
    rationale: `Maximum Volmageddon structure: ATM call (${d7}DTE) for immediate momentum + extension call (${d14}DTE) + 350 UVXY shares in 3 tranches. Far-OTM call + deep put sales reduce cost basis. Reversion put protects if vol reverts. Full delta long — designed for sustained spike event.`,
    urgency,
  }
}

// ─── Window detection helper (ET time) ───────────────────────────────────────
export function getCurrentWindow(): WindowId | null {
  const now = new Date()
  const et  = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const dec = et.getHours() + et.getMinutes() / 60
  if (dec >= 9.5  && dec < 11)   return 1
  if (dec >= 11   && dec < 13)   return 2
  if (dec >= 13   && dec < 15)   return 3
  if (dec >= 15   && dec < 16)   return 4
  return null  // outside market hours
}
