'use client'

import styles from './Sidebar.module.css'
import { type RegimeId, type RegimeConfig, type CarryResult } from '@/lib/regime'
import { type DashState } from '@/app/page'
import { type FeedState } from '@/lib/useMarketData'

interface Props {
  state:     DashState
  update:    (key: keyof DashState, val: number) => void
  regime:    RegimeId
  carry:     CarryResult
  R:         RegimeConfig
  isOpen:    boolean
  feedState: FeedState
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

export default function Sidebar({ state, update, regime, carry, R, isOpen, feedState }: Props) {
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

      {/* ── Data Feed Status ───────────────────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.feedRow}>
          <span
            className={styles.feedStatus}
            style={{ color: STATUS_COLOR[feedState.status] }}
          >
            {STATUS_LABEL[feedState.status]}
          </span>
          <button className={styles.refreshBtn} onClick={feedState.refresh} title="Refresh quotes">
            ↻
          </button>
        </div>

        {lastStr && (
          <div className={styles.feedMeta}>
            {lastStr}
            {feedState.status === 'delayed' && ' · 15m delay'}
          </div>
        )}

        {/* ORATS status */}
        <div className={styles.oratsRow}>
          <span className={styles.oratsLabel}>ORATS</span>
          {feedState.oratsReady ? (
            <span style={{ color: 'var(--positive)', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em' }}>
              ● CONNECTED
            </span>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em' }}>
              ○ KEY NEEDED
            </span>
          )}
        </div>

        {/* ORATS IV summary when available */}
        {feedState.oratsReady && feedState.oratsSummary && (
          <div className={styles.oratsGrid}>
            <div className={styles.oratsStat}>
              <div className={styles.oratsStatLabel}>IV30</div>
              <div className={styles.oratsStatVal}>{feedState.oratsSummary.iv30.toFixed(0)}%</div>
            </div>
            <div className={styles.oratsStat}>
              <div className={styles.oratsStatLabel}>IVR</div>
              <div className={styles.oratsStatVal}
                style={{ color: feedState.oratsSummary.ivr30 > 60 ? 'var(--positive)' : feedState.oratsSummary.ivr30 < 30 ? 'var(--negative)' : 'var(--text-secondary)' }}>
                {feedState.oratsSummary.ivr30.toFixed(0)}
              </div>
            </div>
            <div className={styles.oratsStat}>
              <div className={styles.oratsStatLabel}>IVP</div>
              <div className={styles.oratsStatVal}>{feedState.oratsSummary.ivp30.toFixed(0)}</div>
            </div>
            <div className={styles.oratsStat}>
              <div className={styles.oratsStatLabel}>FWD</div>
              <div className={styles.oratsStatVal}>${feedState.oratsSummary.fwdPx.toFixed(2)}</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Market Inputs ──────────────────────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.label}>Market Inputs</div>
        {([
          ['VIX', 'vix', 0.1],
          ['VIX3M', 'vix3m', 0.1],
          ['VVIX', 'vvix', 1],
          ['SPX', 'spx', 1],
          ['UVXY', 'uvxy', 0.01],
        ] as [string, keyof DashState, number][]).map(([label, key, step]) => (
          <div className={styles.inputRow} key={key}>
            <span className={styles.inputLabel}>{label}</span>
            <input
              className={styles.input}
              type="number"
              step={step}
              value={state[key]}
              onChange={e => update(key, parseFloat(e.target.value) || 0)}
            />
          </div>
        ))}
      </div>

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
