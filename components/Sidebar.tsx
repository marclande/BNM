'use client'

import styles from './Sidebar.module.css'
import { type RegimeId, type RegimeConfig, type CarryResult } from '@/lib/regime'
import { type DashState } from '@/app/page'

interface Props {
  state: DashState
  update: (key: keyof DashState, val: number) => void
  regime: RegimeId
  carry: CarryResult
  R: RegimeConfig
}

export default function Sidebar({ state, update, regime, carry, R }: Props) {
  const carryPct = (carry.netCarryPct * 100).toFixed(2)
  const barWidth = Math.min(100, Math.max(2, 50 + carry.netCarryPct * 2500))

  return (
    <aside className={styles.sidebar}>

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

      <div className={styles.section}>
        <div className={styles.label}>Position Sizing</div>
        <div className={styles.metricGrid}>
          {[
            { label: 'UVXY SPRDS', val: regime === 4 ? '0' : String(carry.uvxyContracts) },
            { label: 'VIX CALLS', val: String(carry.vixCallContracts) },
            { label: 'SAT ALLOC', val: carry.satAlloc > 0 ? `$${Math.round(carry.satAlloc / 1000)}k` : 'OFF' },
            { label: 'CASH RSRV', val: `$${Math.round(carry.cashReserve / 1000)}k` },
          ].map(m => (
            <div className={styles.metricCard} key={m.label}>
              <div className={styles.metricLabel}>{m.label}</div>
              <div className={styles.metricVal}>{m.val}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.section} style={{ flex: 1 }}>
        <div className={styles.label}>Regime Actions</div>
        {[
          { label: 'ETN SHORTS', val: R.etnAction },
          { label: 'VIX CALLS', val: R.vixAction },
          { label: 'SATELLITES', val: R.satelliteAction },
          { label: 'HARVESTER', val: R.harvesterAction },
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
