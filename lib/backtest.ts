import { classifyRegime, type RegimeId } from './regime'

// ─── Black-Scholes ─────────────────────────────────────────────────────────────

/** Abramowitz & Stegun erf approximation (max error 1.5×10⁻⁷) */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const t = 1.0 / (1.0 + 0.3275911 * Math.abs(x))
  const y =
    1.0 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t) *
      Math.exp(-x * x)
  return sign * y
}

function normCDF(x: number): number {
  return (1.0 + erf(x / Math.SQRT2)) / 2.0
}

/** Black-Scholes European call price.
 *  S = spot, K = strike, T = years to expiry, sigma = annual IV, r = risk-free rate */
export function bsCall(S: number, K: number, T: number, sigma: number, r = 0.05): number {
  if (T <= 0) return Math.max(0, S - K)
  const sqrtT = Math.sqrt(T)
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT)
  const d2 = d1 - sigma * sqrtT
  return S * normCDF(d1) - K * Math.exp(-r * T) * normCDF(d2)
}

/** UVXY options trade at roughly 1.5× the VIX level in IV terms */
function uvxyIV(vix: number): number {
  return (vix / 100) * 1.5
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface RawRow {
  date: string
  vix:   number | null
  vix3m: number | null
  vvix:  number | null
  uvxy:  number | null
  uvix:  number | null
  svxy:  number | null
  vxx:   number | null
}

export interface DayData {
  date:   string
  vix:    number
  vix3m:  number
  vvix:   number
  uvxy:   number
  uvix:   number | null
  svxy:   number | null
  vxx:    number | null
  regime: RegimeId
}

export type ExitReason =
  | 'EXPIRED_WORTHLESS'
  | 'EXPIRED_ITM'
  | 'EARLY_CLOSE_REGIME'
  | 'EARLY_CLOSE_STOP'

export interface SimTrade {
  id:           number
  entryDate:    string
  exitDate:     string | null
  regime:       RegimeId
  uvxyAtEntry:  number
  strike:       number       // 1.27× UVXY at entry
  credit:       number       // premium received (per share)
  exitPremium:  number       // premium paid to close (per share)
  pnl:          number       // credit − exitPremium (positive = profit)
  exitReason:   ExitReason
  isOpen:       boolean
  /** Running mark-to-market P&L on each subsequent trading day */
  dailyMark: { date: string; premium: number; markPnl: number }[]
}

export interface BacktestStats {
  totalDays:    number
  regimeDist:   Record<RegimeId, number>
  totalTrades:  number
  closedTrades: number
  wins:         number
  losses:       number
  winRate:      number
  avgWin:       number
  avgLoss:      number
  totalPnl:     number       // per-share basis
  maxDrawdown:  number
  profitFactor: number
}

export interface BacktestResult {
  days:          DayData[]
  trades:        SimTrade[]
  equityCurve:   { date: string; cumPnl: number }[]
  stats:         BacktestStats
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function indexOfDate(dates: string[], date: string): number {
  return dates.indexOf(date)
}

/** Returns the date that is `n` trading days after `startDate` within `dates`. */
function addTradingDays(dates: string[], startDate: string, n: number): string {
  const i = indexOfDate(dates, startDate)
  if (i < 0) return startDate
  return dates[Math.min(i + n, dates.length - 1)]
}

/** Trading days remaining from currentDate to expiryDate (can be negative = past). */
function daysRemaining(dates: string[], currentDate: string, expiryDate: string): number {
  return indexOfDate(dates, expiryDate) - indexOfDate(dates, currentDate)
}

// ─── Simulation ─────────────────────────────────────────────────────────────────

const DTE         = 21      // days to expiry for each trade
const STRIKE_MULT = 1.27    // strike = UVXY × 1.27
const STOP_MULT   = 2.0     // stop: exit if option premium doubles
const MIN_CREDIT  = 0.03    // minimum credit to bother entering (per share)

export function runBacktest(rawRows: RawRow[]): BacktestResult {
  // ── 1. Normalise rows (fill missing vix3m/vvix with estimates) ──────────────
  const days: DayData[] = []
  let lastVix3m = 0
  let lastVvix  = 0

  for (const r of rawRows) {
    if (r.vix == null || r.uvxy == null) continue
    const vix3m = r.vix3m ?? (lastVix3m > 0 ? lastVix3m : r.vix * 1.08)
    const vvix  = r.vvix  ?? (lastVvix  > 0 ? lastVvix  : r.vix * 5.5)
    if (r.vix3m != null) lastVix3m = r.vix3m
    if (r.vvix  != null) lastVvix  = r.vvix
    days.push({
      date:   r.date,
      vix:    r.vix,
      vix3m,
      vvix,
      uvxy:   r.uvxy,
      uvix:   r.uvix,
      svxy:   r.svxy,
      vxx:    r.vxx,
      regime: classifyRegime(r.vix, vix3m, vvix),
    })
  }

  const allDates = days.map(d => d.date)

  // ── 2. Step through days ────────────────────────────────────────────────────
  const trades:      SimTrade[] = []
  const equityCurve: { date: string; cumPnl: number }[] = []
  let openTrade:     SimTrade | null = null
  let tradeId        = 0
  let runningPnl     = 0

  for (const day of days) {
    const { date, vix, uvxy, regime } = day

    // ── Handle open trade ──────────────────────────────────────────────────
    if (openTrade) {
      const expiryDate   = addTradingDays(allDates, openTrade.entryDate, DTE)
      const remaining    = daysRemaining(allDates, date, expiryDate)
      const T            = Math.max(0, remaining) / 252
      const currentPrem  = bsCall(uvxy, openTrade.strike, T, uvxyIV(vix))
      const markPnl      = openTrade.credit - currentPrem
      openTrade.dailyMark.push({ date, premium: currentPrem, markPnl })

      let closed = false

      if (currentPrem >= openTrade.credit * STOP_MULT) {
        // Stop loss: premium doubled
        openTrade.exitDate    = date
        openTrade.exitPremium = currentPrem
        openTrade.pnl         = openTrade.credit - currentPrem
        openTrade.exitReason  = 'EARLY_CLOSE_STOP'
        openTrade.isOpen      = false
        closed = true
      } else if (regime >= 3) {
        // Regime deteriorated — close defensively
        openTrade.exitDate    = date
        openTrade.exitPremium = currentPrem
        openTrade.pnl         = openTrade.credit - currentPrem
        openTrade.exitReason  = 'EARLY_CLOSE_REGIME'
        openTrade.isOpen      = false
        closed = true
      } else if (remaining <= 0) {
        // Expiry
        openTrade.exitDate = date
        if (uvxy < openTrade.strike) {
          openTrade.exitPremium = 0
          openTrade.pnl         = openTrade.credit
          openTrade.exitReason  = 'EXPIRED_WORTHLESS'
        } else {
          openTrade.exitPremium = uvxy - openTrade.strike
          openTrade.pnl         = openTrade.credit - openTrade.exitPremium
          openTrade.exitReason  = 'EXPIRED_ITM'
        }
        openTrade.isOpen = false
        closed = true
      }

      if (closed) {
        runningPnl += openTrade.pnl
        openTrade = null
      }
    }

    // ── Enter new trade on Regime 1 (or Regime 2 at half size — skipped for
    //    clarity; Tier 1 is Regime 1 only) ───────────────────────────────────
    if (!openTrade && regime === 1) {
      const strike = parseFloat((uvxy * STRIKE_MULT).toFixed(2))
      const credit = parseFloat(bsCall(uvxy, strike, DTE / 252, uvxyIV(vix)).toFixed(4))
      if (credit >= MIN_CREDIT) {
        tradeId++
        openTrade = {
          id:          tradeId,
          entryDate:   date,
          exitDate:    null,
          regime,
          uvxyAtEntry: uvxy,
          strike,
          credit,
          exitPremium: 0,
          pnl:         0,
          exitReason:  'EXPIRED_WORTHLESS',
          isOpen:      true,
          dailyMark:   [],
        }
        trades.push(openTrade)
      }
    }

    equityCurve.push({ date, cumPnl: parseFloat(runningPnl.toFixed(4)) })
  }

  // ── 3. Stats ───────────────────────────────────────────────────────────────
  const closed  = trades.filter(t => !t.isOpen)
  const wins    = closed.filter(t => t.pnl > 0)
  const losses  = closed.filter(t => t.pnl <= 0)
  const winSum  = wins.reduce((s, t) => s + t.pnl, 0)
  const lossSum = Math.abs(losses.reduce((s, t) => s + t.pnl, 0))

  let peak = 0, maxDrawdown = 0
  for (const p of equityCurve) {
    if (p.cumPnl > peak) peak = p.cumPnl
    const dd = peak - p.cumPnl
    if (dd > maxDrawdown) maxDrawdown = dd
  }

  const regimeDist: Record<RegimeId, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  for (const d of days) regimeDist[d.regime]++

  return {
    days,
    trades,
    equityCurve,
    stats: {
      totalDays:    days.length,
      regimeDist,
      totalTrades:  trades.length,
      closedTrades: closed.length,
      wins:         wins.length,
      losses:       losses.length,
      winRate:      closed.length > 0 ? wins.length / closed.length : 0,
      avgWin:       wins.length   > 0 ? winSum  / wins.length   : 0,
      avgLoss:      losses.length > 0 ? lossSum / losses.length : 0,
      totalPnl:     parseFloat(runningPnl.toFixed(4)),
      maxDrawdown:  parseFloat(maxDrawdown.toFixed(4)),
      profitFactor: lossSum > 0 ? winSum / lossSum : winSum > 0 ? 99 : 0,
    },
  }
}
