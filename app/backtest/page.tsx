'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { runBacktest, bsCall, type BacktestResult, type SimTrade, type RawRow } from '@/lib/backtest'
import { type RegimeId } from '@/lib/regime'

// ─── Colours ───────────────────────────────────────────────────────────────────

const REGIME_COLOR: Record<RegimeId, string> = {
  1: '#4ade80',
  2: '#60a5fa',
  3: '#fbbf24',
  4: '#f87171',
}
const REGIME_LABEL: Record<RegimeId, string> = {
  1: 'R1 CONTANGO',
  2: 'R2 NEUTRAL',
  3: 'R3 EXPANSION',
  4: 'R4 VOLMAGEDDON',
}

// ─── Tiny helpers ──────────────────────────────────────────────────────────────

function pct(n: number, decimals = 1) {
  return `${(n * 100).toFixed(decimals)}%`
}
function money(n: number) {
  const sign = n >= 0 ? '+' : ''
  return `${sign}$${Math.abs(n).toFixed(2)}`
}
function fmt2(n: number) {
  return n.toFixed(2)
}

// ─── Paper Trading Store (localStorage) ────────────────────────────────────────

interface PaperTrade {
  id:         string
  entryDate:  string
  uvxy:       number
  strike:     number
  credit:     number
  note:       string
}

function loadPaperTrades(): PaperTrade[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem('dvd_paper_trades') ?? '[]')
  } catch { return [] }
}
function savePaperTrades(trades: PaperTrade[]) {
  localStorage.setItem('dvd_paper_trades', JSON.stringify(trades))
}

// ─── Equity Curve SVG ──────────────────────────────────────────────────────────

function EquityCurve({ data }: { data: { date: string; cumPnl: number }[] }) {
  if (data.length < 2) return null
  const W = 800, H = 160, PAD = { t: 12, r: 12, b: 24, l: 52 }
  const minP = Math.min(0, ...data.map(d => d.cumPnl))
  const maxP = Math.max(0, ...data.map(d => d.cumPnl))
  const range = maxP - minP || 1

  const toX = (i: number) => PAD.l + (i / (data.length - 1)) * (W - PAD.l - PAD.r)
  const toY = (v: number) => PAD.t + (1 - (v - minP) / range) * (H - PAD.t - PAD.b)
  const zeroY = toY(0)

  const pts = data.map((d, i) => `${toX(i)},${toY(d.cumPnl)}`).join(' ')
  const area = `M${toX(0)},${zeroY} ` +
    data.map((d, i) => `L${toX(i)},${toY(d.cumPnl)}`).join(' ') +
    ` L${toX(data.length - 1)},${zeroY} Z`

  const labelDates = [0, Math.floor(data.length / 4), Math.floor(data.length / 2), Math.floor(data.length * 3 / 4), data.length - 1]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
      {/* Zero line */}
      <line x1={PAD.l} y1={zeroY} x2={W - PAD.r} y2={zeroY} stroke="rgba(255,255,255,0.1)" strokeDasharray="3,3" />
      {/* Area fill */}
      <path d={area} fill={data[data.length - 1].cumPnl >= 0 ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)'} />
      {/* Line */}
      <polyline points={pts} fill="none"
        stroke={data[data.length - 1].cumPnl >= 0 ? '#4ade80' : '#f87171'}
        strokeWidth="1.5" />
      {/* Y labels */}
      {[minP, 0, maxP].map((v, i) => (
        <text key={i} x={PAD.l - 6} y={toY(v) + 4} textAnchor="end"
          fontSize="9" fill="rgba(255,255,255,0.35)" fontFamily="monospace">
          {money(v)}
        </text>
      ))}
      {/* X labels */}
      {labelDates.map(i => (
        <text key={i} x={toX(i)} y={H - 4} textAnchor="middle"
          fontSize="9" fill="rgba(255,255,255,0.25)" fontFamily="monospace">
          {data[i]?.date.slice(5)}
        </text>
      ))}
    </svg>
  )
}

// ─── Regime Timeline ───────────────────────────────────────────────────────────

function RegimeTimeline({ days }: { data?: never; days: BacktestResult['days'] }) {
  return (
    <div style={{ display: 'flex', gap: 1, height: 28, borderRadius: 4, overflow: 'hidden' }}>
      {days.map(d => (
        <div key={d.date} title={`${d.date} · ${REGIME_LABEL[d.regime]} · VIX ${d.vix.toFixed(1)}`}
          style={{ flex: 1, background: REGIME_COLOR[d.regime], opacity: 0.75 }} />
      ))}
    </div>
  )
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      background: '#0f1420', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 6, padding: '14px 16px', minWidth: 120,
    }}>
      <div style={{ fontSize: 9, letterSpacing: '0.18em', color: '#4a5468', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: color ?? '#e8ecf4', fontFamily: 'monospace' }}>{value}</div>
    </div>
  )
}

// ─── Trade Row ─────────────────────────────────────────────────────────────────

function TradeRow({ t, isOpen }: { t: SimTrade; isOpen: boolean }) {
  const pnlColor = isOpen ? '#60a5fa' : t.pnl > 0 ? '#4ade80' : '#f87171'
  const exitLabel: Record<string, string> = {
    EXPIRED_WORTHLESS:  'EXPIRED ✓',
    EXPIRED_ITM:        'EXPIRED ITM',
    EARLY_CLOSE_REGIME: 'REGIME EXIT',
    EARLY_CLOSE_STOP:   'STOP LOSS',
  }
  return (
    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <td style={td}>{t.entryDate}</td>
      <td style={td}>{fmt2(t.uvxyAtEntry)}</td>
      <td style={td}>${fmt2(t.strike)}C</td>
      <td style={{ ...td, color: '#4ade80' }}>${fmt2(t.credit)}</td>
      <td style={td}>{t.exitDate ?? '—'}</td>
      <td style={{ ...td, fontSize: 9, letterSpacing: '0.1em', color: isOpen ? '#60a5fa' : '#8892a4' }}>
        {isOpen ? 'OPEN' : exitLabel[t.exitReason]}
      </td>
      <td style={{ ...td, color: pnlColor, fontWeight: 600 }}>
        {isOpen ? `MKT ${money(t.dailyMark[t.dailyMark.length - 1]?.markPnl ?? 0)}` : money(t.pnl)}
      </td>
    </tr>
  )
}
const td: React.CSSProperties = {
  padding: '7px 10px', fontSize: 11, fontFamily: 'monospace',
  color: '#8892a4', whiteSpace: 'nowrap',
}

// ─── Paper Trade Panel ─────────────────────────────────────────────────────────

function PaperTradePanel({ liveUvxy, liveVix }: { liveUvxy: number | null; liveVix: number | null }) {
  const [trades, setTrades]     = useState<PaperTrade[]>([])
  const [note, setNote]         = useState('')
  const [added, setAdded]       = useState(false)

  useEffect(() => { setTrades(loadPaperTrades()) }, [])

  function addTrade() {
    if (!liveUvxy || !liveVix) return
    const strike = parseFloat((liveUvxy * 1.27).toFixed(2))
    const credit = parseFloat(bsCall(liveUvxy, strike, 21 / 252, (liveVix / 100) * 1.5).toFixed(4))
    const t: PaperTrade = {
      id:        Date.now().toString(),
      entryDate: new Date().toISOString().slice(0, 10),
      uvxy:      liveUvxy,
      strike,
      credit,
      note,
    }
    const updated = [...trades, t]
    setTrades(updated)
    savePaperTrades(updated)
    setNote('')
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  function removeTrade(id: string) {
    const updated = trades.filter(t => t.id !== id)
    setTrades(updated)
    savePaperTrades(updated)
  }

  return (
    <div style={{ background: '#0f1420', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 20 }}>
      <div style={{ fontSize: 10, letterSpacing: '0.2em', color: '#4a5468', marginBottom: 14 }}>
        PAPER TRADING — TRACK LIVE TRADES
      </div>

      {/* Entry panel */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 9, color: '#4a5468', marginBottom: 4, letterSpacing: '0.12em' }}>TODAY'S T1 SETUP</div>
          {liveUvxy && liveVix ? (
            <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#e8ecf4' }}>
              SELL UVXY ${(liveUvxy * 1.27).toFixed(2)}C · 21DTE
              <span style={{ color: '#4ade80', marginLeft: 10 }}>
                ~${bsCall(liveUvxy, liveUvxy * 1.27, 21 / 252, (liveVix / 100) * 1.5).toFixed(3)} credit
              </span>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#4a5468' }}>Live data unavailable — quotes feed offline</div>
          )}
        </div>
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Optional note"
          style={{
            background: '#0d1119', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4,
            padding: '7px 10px', color: '#e8ecf4', fontSize: 11, fontFamily: 'monospace',
            outline: 'none', width: 180,
          }}
        />
        <button
          onClick={addTrade}
          disabled={!liveUvxy || !liveVix}
          style={{
            background: added ? '#4ade8022' : '#4ade8011',
            border: `1px solid ${added ? '#4ade8066' : '#4ade8033'}`,
            borderRadius: 4, padding: '8px 14px', color: '#4ade80',
            fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.14em',
            cursor: liveUvxy ? 'pointer' : 'not-allowed', opacity: liveUvxy ? 1 : 0.4,
          }}
        >
          {added ? 'LOGGED ✓' : 'LOG TRADE'}
        </button>
      </div>

      {/* Logged trades */}
      {trades.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              {['DATE', 'UVXY', 'STRIKE', 'CREDIT', 'NOTE', ''].map(h => (
                <th key={h} style={{ ...td, color: '#4a5468', fontSize: 9, letterSpacing: '0.14em', textAlign: 'left', padding: '4px 10px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={td}>{t.entryDate}</td>
                <td style={td}>{fmt2(t.uvxy)}</td>
                <td style={{ ...td, color: '#4ade80' }}>${fmt2(t.strike)}C</td>
                <td style={{ ...td, color: '#4ade80' }}>${fmt2(t.credit)}</td>
                <td style={{ ...td, color: '#8892a4' }}>{t.note || '—'}</td>
                <td style={td}>
                  <button onClick={() => removeTrade(t.id)}
                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 10 }}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {trades.length === 0 && (
        <div style={{ fontSize: 10, color: '#2e3648', letterSpacing: '0.12em' }}>
          No paper trades logged yet. Hit LOG TRADE to start tracking.
        </div>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function BacktestPage() {
  const [result, setResult]     = useState<BacktestResult | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [liveUvxy, setLiveUvxy] = useState<number | null>(null)
  const [liveVix, setLiveVix]   = useState<number | null>(null)
  const [tab, setTab]           = useState<'closed' | 'open'>('closed')

  // Fetch historical data and run backtest
  useEffect(() => {
    fetch('/api/backtest-data')
      .then(r => r.json())
      .then((d: { rows: RawRow[] }) => {
        setResult(runBacktest(d.rows))
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))

    // Also try to get live quotes for the paper trading panel
    fetch('/api/quotes')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.uvxy) setLiveUvxy(d.uvxy)
        if (d?.vix)  setLiveVix(d.vix)
      })
      .catch(() => {})
  }, [])

  const displayTrades = useMemo(() => {
    if (!result) return []
    return tab === 'open'
      ? result.trades.filter(t => t.isOpen)
      : result.trades.filter(t => !t.isOpen).slice().reverse()
  }, [result, tab])

  const s = result?.stats

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0d14',
      color: '#e8ecf4', fontFamily: 'monospace',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: '#0f1420', position: 'sticky', top: 0, zIndex: 10,
      }}>
        <Link href="/" style={{ color: '#4a5468', fontSize: 11, textDecoration: 'none', letterSpacing: '0.1em' }}>
          ← LIVE DESK
        </Link>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.1em', color: '#e8ecf4' }}>
          BACKTEST SIMULATOR
        </span>
        <span style={{
          fontSize: 9, letterSpacing: '0.18em', color: '#4a5468',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2,
          padding: '2px 8px',
        }}>
          90 DAYS · T1 SHORT CALLS · BLACK-SCHOLES P&L
        </span>
        {loading && (
          <span style={{ fontSize: 9, color: '#60a5fa', letterSpacing: '0.12em', marginLeft: 'auto' }}>
            LOADING DATA…
          </span>
        )}
      </div>

      <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {error && (
          <div style={{ background: '#1a0d0d', border: '1px solid #f8717133', borderRadius: 6, padding: 16, fontSize: 11, color: '#f87171' }}>
            Failed to load historical data: {error}
          </div>
        )}

        {result && (
          <>
            {/* ── Stats Bar ─────────────────────────────────────────────────── */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <Stat label="TRADING DAYS" value={`${s!.totalDays}`} />
              <Stat label="TOTAL TRADES" value={`${s!.totalTrades}`} />
              <Stat label="WIN RATE"
                value={pct(s!.winRate)}
                color={s!.winRate >= 0.6 ? '#4ade80' : s!.winRate >= 0.45 ? '#fbbf24' : '#f87171'} />
              <Stat label="TOTAL P&L (PER SH)"
                value={money(s!.totalPnl)}
                color={s!.totalPnl >= 0 ? '#4ade80' : '#f87171'} />
              <Stat label="AVG WIN" value={money(s!.avgWin)} color="#4ade80" />
              <Stat label="AVG LOSS" value={`-${money(s!.avgLoss)}`} color="#f87171" />
              <Stat label="PROFIT FACTOR"
                value={s!.profitFactor >= 99 ? '∞' : fmt2(s!.profitFactor)}
                color={s!.profitFactor >= 1.5 ? '#4ade80' : s!.profitFactor >= 1 ? '#fbbf24' : '#f87171'} />
              <Stat label="MAX DRAWDOWN" value={money(s!.maxDrawdown)} color="#f87171" />
            </div>

            {/* ── Regime Distribution ───────────────────────────────────────── */}
            <div style={{ background: '#0f1420', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 20 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.18em', color: '#4a5468', marginBottom: 14 }}>
                REGIME DISTRIBUTION — 90 DAY HISTORY
              </div>
              <RegimeTimeline days={result.days} />
              <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
                {([1, 2, 3, 4] as RegimeId[]).map(r => {
                  const count = s!.regimeDist[r]
                  const frac  = count / s!.totalDays
                  return (
                    <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: REGIME_COLOR[r] }} />
                      <span style={{ color: '#4a5468', letterSpacing: '0.1em' }}>
                        {REGIME_LABEL[r]}
                      </span>
                      <span style={{ color: REGIME_COLOR[r], fontWeight: 600 }}>
                        {count}d ({pct(frac, 0)})
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Equity Curve ──────────────────────────────────────────────── */}
            <div style={{ background: '#0f1420', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 20 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.18em', color: '#4a5468', marginBottom: 12 }}>
                EQUITY CURVE — CUMULATIVE P&L PER SHARE SOLD
              </div>
              <EquityCurve data={result.equityCurve} />
              <div style={{ fontSize: 9, color: '#2e3648', marginTop: 8, letterSpacing: '0.1em' }}>
                Each trade = 1 short UVXY call · Strike 1.27× spot · 21 DTE · IV = VIX × 1.5 · Stop at 2× credit · Exit on Regime 3/4
              </div>
            </div>

            {/* ── Trade Log ─────────────────────────────────────────────────── */}
            <div style={{ background: '#0f1420', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.18em', color: '#4a5468' }}>TRADE LOG</div>
                <div style={{ display: 'flex', gap: 1, marginLeft: 'auto' }}>
                  {(['closed', 'open'] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                      style={{
                        background: tab === t ? '#1e2535' : 'transparent',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: t === 'closed' ? '4px 0 0 4px' : '0 4px 4px 0',
                        padding: '5px 12px', color: tab === t ? '#e8ecf4' : '#4a5468',
                        fontSize: 9, fontFamily: 'monospace', letterSpacing: '0.12em', cursor: 'pointer',
                      }}>
                      {t.toUpperCase()} ({t === 'closed' ? s!.closedTrades : result.trades.filter(x => x.isOpen).length})
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      {['ENTRY', 'UVXY', 'STRIKE', 'CREDIT', 'EXIT', 'REASON', 'P&L'].map(h => (
                        <th key={h} style={{ ...td, color: '#4a5468', fontSize: 9, letterSpacing: '0.14em', textAlign: 'left', padding: '4px 10px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayTrades.map(t => <TradeRow key={t.id} t={t} isOpen={t.isOpen} />)}
                  </tbody>
                </table>
                {displayTrades.length === 0 && (
                  <div style={{ padding: '20px 10px', fontSize: 10, color: '#2e3648', letterSpacing: '0.12em' }}>
                    No {tab} trades in this period.
                  </div>
                )}
              </div>
            </div>

            {/* ── Methodology Note ──────────────────────────────────────────── */}
            <div style={{ background: '#0a0d14', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 6, padding: 16 }}>
              <div style={{ fontSize: 9, letterSpacing: '0.18em', color: '#2e3648', marginBottom: 8 }}>SIMULATION METHODOLOGY</div>
              <div style={{ fontSize: 10, color: '#4a5468', lineHeight: 1.7 }}>
                Strategy: Regime 1 days only · Sell 1 UVXY call at 1.27× spot · 21 calendar-equivalent trading days DTE
                · IV estimated as VIX × 1.5 (UVXY options typically trade at 1.3–1.7× VIX) · Risk-free rate 5%
                · Stop loss: buy back if premium doubles (2× credit) · Regime exit: close at market if Regime 3 or 4 fires
                · P&L shown per option contract share (multiply by 100 for full contract, then by number of contracts)
                · Historical data: Yahoo Finance daily closes (^VIX, ^VIX3M, ^VVIX, UVXY) · VIX3M estimated as VIX×1.08 when unavailable
              </div>
            </div>
          </>
        )}

        {/* ── Paper Trading ─────────────────────────────────────────────────── */}
        <PaperTradePanel liveUvxy={liveUvxy} liveVix={liveVix} />

      </div>
    </div>
  )
}
