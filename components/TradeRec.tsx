'use client'

import { useState, useEffect } from 'react'
import styles from './TradeRec.module.css'
import {
  buildAllWindowRecs, getCurrentWindow,
  type WindowRecs, type TradeRec, type TradeLeg, type WindowId,
} from '@/lib/trades'
import { type LookupFn, type ThetaOptionRecord } from '@/lib/useThetaData'
import type { RegimeId } from '@/lib/regime'
import type { DashState } from '@/app/page'

interface Props {
  state:        DashState
  regime:       RegimeId
  lookupOption: LookupFn
}

const ROLE_COLORS: Record<TradeLeg['role'], string> = {
  CORE:   'var(--text-primary)',
  HEDGE:  'var(--info)',
  INCOME: 'var(--positive)',
  TAIL:   'var(--negative)',
  SCALE:  'var(--text-secondary)',
}

const ACTION_COLORS: Record<string, string> = {
  BUY:   'var(--positive)',
  LONG:  'var(--positive)',
  SELL:  'var(--negative)',
  SHORT: 'var(--negative)',
}

const URGENCY_COLORS: Record<TradeRec['urgency'], string> = {
  HIGH:     'var(--negative)',
  STANDARD: 'var(--text-secondary)',
  LOW:      'var(--text-tertiary)',
}

// Parse strike and right from a leg detail string like "$10.69C · 21DTE"
function parseLegOption(leg: TradeLeg): { strike: number; right: 'C' | 'P'; dte: number } | null {
  if (leg.action !== 'BUY' && leg.action !== 'SELL') return null
  if (!['UVXY', 'SPY', 'VIX'].includes(leg.instrument)) return null

  // Match e.g. "$10.69C", "$582.0P", "$22C"
  const strikeMatch = leg.detail.match(/\$([0-9.]+)([CP])/)
  // Match e.g. "21DTE", "7DTE"
  const dteMatch    = leg.detail.match(/(\d+)DTE/)

  if (!strikeMatch || !dteMatch) return null
  return {
    strike: parseFloat(strikeMatch[1]),
    right:  strikeMatch[2] as 'C' | 'P',
    dte:    parseInt(dteMatch[1]),
  }
}

export default function TradeRecommendations({ state, regime, lookupOption }: Props) {
  const [activeWindow, setActiveWindow] = useState<WindowId>(1)
  const [currentWindow, setCurrentWindow] = useState<WindowId | null>(null)

  useEffect(() => {
    const detect = () => {
      const w = getCurrentWindow()
      setCurrentWindow(w)
      if (w !== null) setActiveWindow(w)
    }
    detect()
    const id = setInterval(detect, 60_000)
    return () => clearInterval(id)
  }, [])

  const windows: WindowRecs[] = buildAllWindowRecs(
    state.vix, state.spx, state.uvxy,
    state.acctK, state.maxRiskPct, regime,
  )

  const active = windows.find(w => w.window === activeWindow)!

  return (
    <div className={styles.wrap}>
      <div className={styles.tabs}>
        {windows.map(w => {
          const isActive  = w.window === activeWindow
          const isCurrent = w.window === currentWindow
          return (
            <button
              key={w.window}
              className={isActive ? styles.tabActive : styles.tab}
              onClick={() => setActiveWindow(w.window)}
              style={isActive ? { borderColor: 'var(--border-active)' } : undefined}
            >
              {isCurrent && '● '}{w.label}
              <span style={{ opacity: 0.5, marginLeft: 6 }}>{w.timeRange}</span>
            </button>
          )
        })}
      </div>

      <div className={styles.windowMeta}>
        {currentWindow === activeWindow
          ? `▸ CURRENT WINDOW — ${active.focus}`
          : `W${activeWindow} — ${active.focus}`}
      </div>

      <div className={styles.cards}>
        {active.recs.map(rec => (
          <TradeCard key={rec.tier} rec={rec} lookupOption={lookupOption} />
        ))}
      </div>
    </div>
  )
}

function TradeCard({ rec, lookupOption }: { rec: TradeRec; lookupOption: LookupFn }) {
  const color = rec.tierColor
  const rr    = rec.riskAmt > 0 ? (rec.targetAmt / rec.riskAmt).toFixed(1) : '—'
  const rrStr = rec.riskAmt > 0 ? `1 : ${rr}` : '—'
  const hasRealData = lookupOption !== null

  return (
    <div className={styles.card}>
      {/* Header */}
      <div className={styles.cardHeader}>
        <div className={styles.cardHeaderLeft}>
          <span className={styles.tierBadge} style={{ color, borderColor: color, background: `${color}18` }}>
            T{rec.tier} · {rec.tierLabel}
          </span>
          <span className={styles.headline}>{rec.headline}</span>
        </div>
        <span className={styles.urgencyBadge}
          style={{ color: URGENCY_COLORS[rec.urgency], borderColor: URGENCY_COLORS[rec.urgency] }}>
          {rec.urgency}
        </span>
      </div>

      {/* Legs */}
      <table className={styles.legsTable}>
        <tbody>
          {rec.legs.map((leg, i) => {
            const parsed  = parseLegOption(leg)
            const real    = parsed ? lookupOption(parsed.right, parsed.strike, parsed.dte) : null
            return (
              <LegRow key={i} leg={leg} real={real} hasRealData={hasRealData} />
            )
          })}
        </tbody>
      </table>

      {/* Risk / Target / R:R */}
      <div className={styles.metrics}>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>RISK{!hasRealData && ' EST.'}</div>
          <div className={styles.metricVal} style={{ color: 'var(--negative)' }}>
            ${rec.riskAmt.toLocaleString()}
          </div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>TARGET{!hasRealData && ' EST.'}</div>
          <div className={styles.metricVal} style={{ color: 'var(--positive)' }}>
            ${rec.targetAmt.toLocaleString()}
          </div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricLabel}>R : R</div>
          <div className={styles.metricVal} style={{ color: 'var(--text-secondary)' }}>{rrStr}</div>
        </div>
      </div>

      {/* Rationale */}
      <div className={styles.rationale}>{rec.rationale}</div>
    </div>
  )
}

function LegRow({
  leg, real, hasRealData,
}: {
  leg: TradeLeg
  real: ThetaOptionRecord | null
  hasRealData: boolean
}) {
  const isOption = (leg.action === 'BUY' || leg.action === 'SELL') &&
                   ['UVXY', 'SPY', 'VIX'].includes(leg.instrument)

  return (
    <tr>
      <td className={styles.legAction} style={{ color: ACTION_COLORS[leg.action] ?? 'var(--text-primary)' }}>
        {leg.action}
      </td>
      <td className={styles.legQty}>{leg.qty}</td>
      <td className={styles.legInst}>{leg.instrument}</td>
      <td className={styles.legDetail}>{leg.detail}</td>

      {/* Real pricing column when ThetaData connected */}
      {isOption && real ? (
        <td className={styles.legLive}>
          <span className={styles.legMid}>${real.mid.toFixed(2)}</span>
          {real.delta != null && (
            <span className={styles.legGreek}>Δ{real.delta.toFixed(2)}</span>
          )}
          {real.theta != null && (
            <span className={styles.legGreek} style={{ color: 'var(--negative)' }}>
              Θ{real.theta.toFixed(2)}
            </span>
          )}
        </td>
      ) : (
        <td className={styles.legRole} style={{ color: ROLE_COLORS[leg.role] }}>
          {leg.role}
        </td>
      )}
    </tr>
  )
}
