'use client'

import { useState } from 'react'
import styles from './Sidebar.module.css'
import { type RegimeId, type RegimeConfig, type CarryResult } from '@/lib/regime'
import { type DashState } from '@/app/page'
import { type FeedState, type EtfFeedState } from '@/lib/useMarketData'
import { type ThetaState } from '@/lib/useThetaData'

interface Props {
  state:         DashState
  update:        (key: keyof DashState, val: number) => void
  regime:        RegimeId
  carry:         CarryResult
  R:             RegimeConfig
  isOpen:        boolean
  feedState:     FeedState
  etfFeedState:  EtfFeedState
  thetaState:    ThetaState
}

const STATUS_COLOR: Record<FeedState['status'], string> = {
  live:    'var(--positive)',
  delayed: 'var(--warning)',
  manual:  'var(--text-tertiary)',
  loading: 'var(--text-tertiary)',
}

const STATUS_LABEL: Record<FeedState['status'], string> = {
  live:    '● LIVE',
  delayed: '◑ DELAYED',
  manual:  '○ MANUAL',
  loading: '○ LOADING',
}

export default function Sidebar({ state, update, regime, carry, R, isOpen, feedState, etfFeedState, thetaState }: Props) {
  const carryPct = (carry.netCarryPct * 100).toFixed(2)
  const barWidth = Math.min(100, Math.max(2, 50 + carry.netCarryPct * 2500))

  const lastStr = feedState.lastUpdated
    ? feedState.lastUpdated.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
      }) + ' ET'
    : null

  return (
    <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}>

      {/* ── Data Feed ─────────────────────────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.feedRow}>
          <span className={styles.feedStatus} style={{ color: STATUS_COLOR[feedState.status] }}>
            {STATUS_LABEL[feedState.status]}
          </span>
          <button className={styles.refreshBtn} onClick={feedState.refresh} title="Refresh quotes">↻</button>
        </div>
        {lastStr && (
          <div className={styles.feedMeta}>
            {lastStr}{feedState.status === 'delayed' && ' · 15m delay'}
          </div>
        )}

        {/* ThetaData options feed */}
        <div className={styles.thetaRow}>
          <span className={styles.thetaLabel}>THETADATA</span>
          {!thetaState.configured ? (
            <span className={styles.thetaBadge} style={{ color: 'var(--text-muted)' }}>○ KEY NEEDED</span>
          ) : thetaState.connected ? (
            <span className={styles.thetaBadge} style={{ color: 'var(--positive)' }}>● LIVE</span>
          ) : (
            <span className={styles.thetaBadge} style={{ color: 'var(--warning)' }}>◑ CONNECTING</span>
          )}
        </div>

        {/* ETF price feed status */}
        <div className={styles.thetaRow}>
          <span className={styles.thetaLabel}>ETF PRICES</span>
          <span className={styles.thetaBadge} style={{ color:
            etfFeedState.status === 'live'    ? 'var(--positive)' :
            etfFeedState.status === 'partial' ? 'var(--warning)'  : 'var(--text-muted)' }}>
            {etfFeedState.status === 'live'    ? '● LIVE'    :
             etfFeedState.status === 'partial' ? '◑ PARTIAL' :
             etfFeedState.status === 'loading' ? '○ LOADING' : '○ MANUAL'}
          </span>
        </div>

        {/* UVXY ATM stats when ThetaData is live */}
        {thetaState.connected && (thetaState.atmIv || thetaState.atmDelta) && (
          <div className={styles.thetaGrid}>
            {thetaState.atmIv != null && (
              <div className={styles.thetaStat}>
                <div className={styles.thetaStatLabel}>UVXY IV</div>
                <div className={styles.thetaStatVal}
                  style={{ color: thetaState.atmIv > 120 ? 'var(--negative)' : thetaState.atmIv < 80 ? 'var(--positive)' : 'var(--text-primary)' }}>
                  {thetaState.atmIv.toFixed(0)}%
                </div>
              </div>
            )}
            {thetaState.atmDelta != null && (
              <div className={styles.thetaStat}>
                <div className={styles.thetaStatLabel}>ATM Δ</div>
                <div className={styles.thetaStatVal}>{thetaState.atmDelta.toFixed(2)}</div>
              </div>
            )}
            {thetaState.atmTheta != null && (
              <div className={styles.thetaStat}>
                <div className={styles.thetaStatLabel}>ATM Θ/d</div>
                <div className={styles.thetaStatVal} style={{ color: 'var(--negative)' }}>
                  ${thetaState.atmTheta.toFixed(2)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Market Inputs ──────────────────────────────────────────── */}
      <MarketInputs state={state} update={update} feedState={feedState} etfFeedState={etfFeedState} />

      {/* ── Account Config ─────────────────────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.label}>Account Config</div>
        <div className={styles.inputRow}>
          <span className={styles.inputLabel}>Size ($k)</span>
          <input className={styles.input} type="number" step="10" value={state.acctK}
            onChange={e => update('acctK', parseFloat(e.target.value) || 0)} />
        </div>
        <div className={styles.inputRow}>
          <span className={styles.inputLabel}>Max Risk %</span>
          <input className={styles.input} type="number" step="0.5" value={state.maxRiskPct}
            onChange={e => update('maxRiskPct', parseFloat(e.target.value) || 0)} />
        </div>
      </div>

      {/* ── Net Carry ──────────────────────────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.label}>Net Carry</div>
        <div className={styles.carryHeader}>
          <span className={styles.carryLabel}>Monthly</span>
          <span className={styles.carryVal}
            style={{ color: carry.isPositive ? 'var(--positive)' : 'var(--negative)' }}>
            {carry.isPositive ? '+' : ''}{carryPct}%
          </span>
        </div>
        <div className={styles.track}>
          <div className={styles.fill}
            style={{ width: `${barWidth}%`, background: carry.isPositive ? 'var(--positive)' : 'var(--negative)' }} />
        </div>
        <div className={styles.carryMeta}>
          <span style={{ color: carry.isPositive ? 'var(--positive)' : 'var(--negative)', fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
            {carry.action === 'PROCEED' ? '▸ PROCEED' : carry.action === 'REDUCE_25' ? '▸ REDUCE 25%' : '▸ REDUCE 50%'}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
            {carry.netCarry >= 0 ? '+' : ''}${Math.round(carry.netCarry).toLocaleString()}/mo
          </span>
        </div>
      </div>

      {/* ── Position Sizing ────────────────────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.label}>Position Sizing</div>
        <div className={styles.metricGrid}>
          {[
            { label: 'UVXY SPRDS', val: regime === 4 ? '0' : String(carry.uvxyContracts) },
            { label: 'VIX CALLS',  val: String(carry.vixCallContracts) },
            { label: 'SAT ALLOC',  val: carry.satAlloc > 0 ? `$${Math.round(carry.satAlloc / 1000)}k` : 'OFF' },
            { label: 'CASH RSRV',  val: `$${Math.round(carry.cashReserve / 1000)}k` },
          ].map(m => (
            <div className={styles.metricCard} key={m.label}>
              <div className={styles.metricLabel}>{m.label}</div>
              <div className={styles.metricVal}>{m.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Regime Actions ─────────────────────────────────────────── */}
      <div className={styles.section} style={{ flex: 1 }}>
        <div className={styles.label}>Regime Actions</div>
        {[
          { label: 'ETN SHORTS',  val: R.etnAction },
          { label: 'VIX CALLS',   val: R.vixAction },
          { label: 'SATELLITES',  val: R.satelliteAction },
          { label: 'HARVESTER',   val: R.harvesterAction },
        ].map(a => (
          <div className={styles.actionRow} key={a.label}>
            <span className={styles.actionLabel}>{a.label}</span>
            <span className={styles.actionVal} style={{ color: R.color }}>{a.val}</span>
          </div>
        ))}
      </div>

    </aside>
  )
}

// manualOnly=true means the quotes server never auto-feeds this ticker
const FIELDS: [string, keyof DashState, number, boolean?][] = [
  ['VIX',   'vix',   0.1],
  ['VIX3M', 'vix3m', 0.1],
  ['VVIX',  'vvix',  1],
  ['SPX',   'spx',   1],
  ['UVXY',  'uvxy',  0.01],
  ['UVIX',  'uvix',  0.01, true],
  ['SVXY',  'svxy',  0.01, true],
  ['VXX',   'vxx',   0.01, true],
]

function MarketInputs({
  state, update, feedState, etfFeedState,
}: {
  state: DashState
  update: (key: keyof DashState, val: number) => void
  feedState: FeedState
  etfFeedState: EtfFeedState
}) {
  const [editing, setEditing] = useState<Set<keyof DashState>>(new Set())
  const isAuto    = feedState.status === 'live' || feedState.status === 'delayed'
  const etfIsAuto = etfFeedState.status === 'live' || etfFeedState.status === 'partial'
  const dotColor  = feedState.status === 'live' ? 'var(--positive)' : 'var(--warning)'
  const etfDotColor = etfFeedState.status === 'live' ? 'var(--positive)' : 'var(--warning)'

  function toggleEdit(key: keyof DashState) {
    setEditing(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  return (
    <div className={styles.section}>
      <div className={styles.labelRow}>
        <span className={styles.label} style={{ marginBottom: 0 }}>Market Inputs</span>
        {isAuto && (
          <span className={styles.autoTag} style={{ color: dotColor, borderColor: dotColor }}>
            AUTO
          </span>
        )}
      </div>
      <div style={{ marginTop: 10 }}>
        {FIELDS.map(([label, key, step, manualOnly]) => {
          const fieldIsAuto   = manualOnly ? etfIsAuto : isAuto
          const fieldDotColor = manualOnly ? etfDotColor : dotColor
          const isEditingThis = editing.has(key) || !fieldIsAuto
          const badgeLabel    = manualOnly
            ? (etfIsAuto ? (etfFeedState.status === 'live' ? 'LIVE' : 'YF') : 'MANUAL')
            : null
          const badgeColor    = manualOnly
            ? (etfIsAuto ? fieldDotColor : 'var(--text-muted)')
            : null

          return (
            <div className={styles.inputRow} key={key}>
              <span className={styles.inputLabel}>
                {label}
                {badgeLabel && (
                  <span style={{ marginLeft: 4, fontSize: 7, letterSpacing: '0.1em', color: badgeColor!, fontFamily: 'var(--font-mono)' }}>
                    {badgeLabel}
                  </span>
                )}
              </span>
              {isEditingThis ? (
                <div className={styles.inputWrap}>
                  <input
                    className={styles.input}
                    type="number"
                    step={step}
                    value={state[key]}
                    onChange={e => update(key, parseFloat(e.target.value) || 0)}
                    autoFocus={false}
                    onBlur={() => fieldIsAuto && toggleEdit(key)}
                  />
                </div>
              ) : (
                <button
                  className={styles.liveVal}
                  style={{ borderColor: fieldDotColor + '44' }}
                  onClick={() => toggleEdit(key)}
                  title="Click to override"
                >
                  <span style={{ color: fieldDotColor, fontSize: 7, marginRight: 4 }}>●</span>
                  {state[key]}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
