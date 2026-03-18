'use client'

import styles from './Components.module.css'
import { type RegimeId, type RegimeConfig, type CarryResult, type TermPoint, type DashState } from '@/lib/regime'

// ─── RegimePanel ───────────────────────────────────────────────────────────────

interface RegimePanelProps {
  regime: RegimeId
  R: RegimeConfig
  confidence: number
  ratio: number
  vvix: number
  vix: number
}

export function RegimePanel({ regime, R, confidence, ratio, vvix, vix }: RegimePanelProps) {
  const pills = [
    { label: `VIX/3M: ${ratio.toFixed(3)}`, highlight: ratio >= 1.0 },
    { label: `VVIX: ${vvix}`, highlight: vvix > 110 },
    { label: R.etnAction + ' — ETN', highlight: false },
    { label: R.vixAction + ' — VIX CALLS', highlight: false },
  ]

  return (
    <div className={styles.regimePanel} style={{ borderLeftColor: R.color, background: R.bg }}>
      <div className={styles.regimeTop}>
        <div>
          <div className={styles.regimeName} style={{ color: R.color }}>{R.name}</div>
          <div className={styles.regimeDesc}>{R.desc}</div>
        </div>
        <div className={styles.confidenceBlock}>
          <div className={styles.confLabel}>CONFIDENCE</div>
          <div className={styles.confVal} style={{ color: R.color }}>{confidence}%</div>
        </div>
      </div>
      <div className={styles.pills}>
        {pills.map((p, i) => (
          <span key={i} className={styles.pill}
            style={{ color: p.highlight ? R.color : 'var(--text-tertiary)', borderColor: p.highlight ? R.border : 'var(--border-subtle)', background: p.highlight ? R.bg : 'transparent' }}>
            {p.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── TermStructureChart ────────────────────────────────────────────────────────

interface TSProps { points: TermPoint[]; regime: RegimeId; ratio: number }

export function TermStructureChart({ points, regime, ratio }: TSProps) {
  const isBackward = ratio >= 1.0
  const barColor = isBackward ? 'var(--negative)' : 'var(--positive)'

  return (
    <div className={styles.tsWrap}>
      {points.map(p => (
        <div key={p.label} className={styles.tsRow}>
          <span className={styles.tsLabel}>{p.label}</span>
          <div className={styles.tsTrack}>
            <div className={styles.tsFill} style={{ width: `${p.pct}%`, background: barColor }} />
          </div>
          <span className={styles.tsVal} style={{ color: barColor }}>{p.val}</span>
        </div>
      ))}
      <div className={styles.tsNote} style={{ color: isBackward ? 'var(--negative)' : 'var(--positive)' }}>
        {isBackward ? '▲ BACKWARDATION — vol stress, reduce ETN shorts' : '▼ CONTANGO — structural decay active, ETN spread premium elevated'}
      </div>
    </div>
  )
}

// ─── CarryBreakdown ────────────────────────────────────────────────────────────

interface CBProps { carry: CarryResult }

export function CarryBreakdown({ carry }: CBProps) {
  const items = [
    { label: 'UVXY PREMIUM', val: `+$${Math.round(carry.monthlyUVXYPremium).toLocaleString()}`, sub: 'gross / month', color: 'var(--positive)' },
    { label: 'VIX CALL COST', val: `-$${Math.round(carry.monthlyVixCallCost).toLocaleString()}`, sub: 'hedge cost / month', color: 'var(--negative)' },
    { label: 'TX COSTS', val: `-$${Math.round(carry.txCosts).toLocaleString()}`, sub: 'est. / month', color: 'var(--text-secondary)' },
    { label: 'NET CARRY', val: `${carry.netCarry >= 0 ? '+' : ''}$${Math.round(carry.netCarry).toLocaleString()}`, sub: 'monthly net', color: carry.isPositive ? 'var(--positive)' : 'var(--negative)' },
  ]
  return (
    <div className={styles.carryGrid}>
      {items.map(item => (
        <div key={item.label} className={styles.carryItem}>
          <div className={styles.carryItemLabel}>{item.label}</div>
          <div className={styles.carryItemVal} style={{ color: item.color }}>{item.val}</div>
          <div className={styles.carryItemSub}>{item.sub}</div>
        </div>
      ))}
    </div>
  )
}

// ─── PositionSpecs ─────────────────────────────────────────────────────────────

interface PSProps { regime: RegimeId; R: RegimeConfig; state: DashState; carry: CarryResult }

export function PositionSpecs({ regime, R, state, carry }: PSProps) {
  const { vix, uvxy, acctK } = state
  const acct = acctK * 1000
  const uvxyShort = parseFloat((uvxy * 1.27).toFixed(2))
  const uvxyCap = parseFloat((uvxy * 1.44).toFixed(2))
  const vixStrike = Math.round(vix * 1.37)

  const positions = regime === 4 ? [
    {
      title: 'UVXY CALL SPREAD', badge: 'COVER NOW', badgeColor: 'var(--negative)',
      rows: [['ACTION', 'BUY TO CLOSE — ALL'], ['PRIORITY', 'MARKET ORDER'], ['TIMING', 'IMMEDIATE']],
      footer: [['STATUS', 'REGIME 4 — COVER']]
    },
    {
      title: 'VIX CALLS (HAWK)', badge: 'HARVESTING', badgeColor: 'var(--negative)',
      rows: [['STRIKE', `${vixStrike}C`], ['CONTRACTS', String(carry.vixCallContracts)], ['ACTION', 'SCALE OUT 33%']],
      footer: [['TARGET', 'VIX > 35 → 2ND TRANCHE']]
    },
    {
      title: 'REBUILD TRIGGER', badge: 'STANDBY', badgeColor: 'var(--warning)',
      rows: [['VIX LEVEL', `> ${Math.round(vix * 1.8)}`], ['UVXY TARGET', `$${(uvxy * 2.2).toFixed(2)}C`], ['MODE', 'ELEVATED PREMIUM']],
      footer: [['HARVESTER', 'ACTIVE']]
    },
  ] : [
    {
      title: 'UVXY CALL SPREAD', badge: regime >= 3 ? 'REDUCED 50%' : 'ACTIVE', badgeColor: regime >= 3 ? 'var(--warning)' : R.color,
      rows: [
        ['SELL', `$${uvxyShort}C`],
        ['BUY', `$${uvxyCap}C`],
        ['EXPIRY', '21–28 DTE'],
        ['CONTRACTS', regime >= 3 ? String(Math.floor(carry.uvxyContracts / 2)) : String(carry.uvxyContracts)],
      ],
      footer: [['NET CR', `~$${(uvxy * 0.052).toFixed(2)}`], ['MAX LOSS', `~$${(uvxyCap - uvxyShort).toFixed(2)}`]]
    },
    {
      title: 'VIX CALLS (HAWK)', badge: 'LONG', badgeColor: R.color,
      rows: [
        ['STRIKE', `${vixStrike}C`],
        ['EXPIRY', '60–90 DTE'],
        ['CONTRACTS', String(carry.vixCallContracts)],
        ['ROLL AT', '< 30 DTE'],
      ],
      footer: [['COST', `~$${(vix * 0.6).toFixed(0)}/ct`], ['UPSIDE', 'UNLIMITED']]
    },
    {
      title: 'SATELLITE POOL', badge: regime >= 3 ? 'SUSPENDED' : 'SCANNING', badgeColor: regime >= 3 ? 'var(--text-tertiary)' : R.color,
      rows: [
        ['BUDGET', carry.satAlloc > 0 ? `$${Math.round(carry.satAlloc / 1000)}k` : 'OFF'],
        ['HYG SCANNER', regime < 3 ? 'ACTIVE' : 'OFF'],
        ['MOVE SCANNER', regime < 3 ? 'ACTIVE' : 'OFF'],
        ['EARNINGS IV', regime < 2 ? 'ACTIVE' : 'OFF'],
      ],
      footer: [['MAX/NAME', `$${Math.round(acct * 0.05 / 1000)}k`], ['MAX NAMES', '3']]
    }
  ]

  return (
    <div className={styles.posGrid}>
      {positions.map(pos => (
        <div key={pos.title} className={styles.posCard}>
          <div className={styles.posHeader}>
            <span className={styles.posTitle}>{pos.title}</span>
            <span className={styles.posBadge} style={{ color: pos.badgeColor, borderColor: pos.badgeColor }}>{pos.badge}</span>
          </div>
          <div className={styles.posRows}>
            {pos.rows.map(([label, val]) => (
              <div key={label} className={styles.posRow}>
                <span className={styles.posRowLabel}>{label}</span>
                <span className={styles.posRowVal}>{val}</span>
              </div>
            ))}
          </div>
          <div className={styles.posFooter}>
            {pos.footer.map(([label, val]) => (
              <div key={label} className={styles.posFooterItem}>
                <div className={styles.posFooterLabel}>{label}</div>
                <div className={styles.posFooterVal}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── SatelliteScanner ──────────────────────────────────────────────────────────

interface SatProps { regime: RegimeId; R: RegimeConfig; vix: number }

export function SatelliteScanner({ regime, R, vix }: SatProps) {
  const scanners = [
    {
      name: 'CREDIT STRESS — HYG',
      desc: 'Monitor HYG 30-day IV — trigger if +15% in 5 days while VIX < 18',
      active: regime < 3,
      signal: vix < 18 ? 'NO SIGNAL' : 'ELEVATED — WATCH',
    },
    {
      name: 'RATES VOL — MOVE INDEX',
      desc: 'MOVE spike > 20% in 1 week → TLT straddle — credit stress leads equity vol by 5-10 days',
      active: regime < 3,
      signal: 'NO SIGNAL',
    },
    {
      name: 'EARNINGS IV HARVEST',
      desc: 'IVR > 70 + earnings within 5 days — iron condor, max 3 names, 5% budget each',
      active: regime < 2,
      signal: regime < 2 ? 'SCANNING' : 'OFF — REGIME 2+',
    },
  ]

  return (
    <div className={styles.scannerWrap}>
      {scanners.map(s => (
        <div key={s.name} className={styles.scannerRow}>
          <div className={styles.scannerLeft}>
            <div className={styles.dot} style={{ background: s.active ? R.color : 'var(--text-muted)' }} />
            <div>
              <div className={styles.scannerName}>{s.name}</div>
              <div className={styles.scannerDesc}>{s.desc}</div>
            </div>
          </div>
          <div className={styles.scannerRight}>
            <div className={styles.scannerStat}>
              <span className={styles.scannerStatLabel}>STATUS</span>
              <span className={styles.scannerStatVal} style={{ color: s.active ? R.color : 'var(--text-tertiary)' }}>
                {s.active ? 'MONITORING' : 'SUSPENDED'}
              </span>
            </div>
            <div className={styles.scannerStat}>
              <span className={styles.scannerStatLabel}>SIGNAL</span>
              <span className={styles.scannerStatVal}>{s.signal}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── VolSurface ────────────────────────────────────────────────────────────────

interface VSProps {
  surface: { strikes: string[]; expiries: string[]; cells: { strike: string; expiry: string; vol: number; isSellZone: boolean }[] }
  regime: RegimeId
  R: RegimeConfig
}

export function VolSurface({ surface, regime, R }: VSProps) {
  const { strikes, expiries, cells } = surface
  const vols = cells.map(c => c.vol)
  const minVol = Math.min(...vols)
  const maxVol = Math.max(...vols)

  const rgbMap: Record<RegimeId, string> = {
    1: '74,222,128',
    2: '96,165,250',
    3: '251,191,36',
    4: '248,113,113',
  }
  const rgb = rgbMap[regime]

  return (
    <div className={styles.surfaceWrap}>
      <div className={styles.surfaceGrid} style={{ gridTemplateColumns: `44px repeat(${strikes.length}, 1fr)` }}>
        <div className={styles.surfaceHeader} />
        {strikes.map(s => <div key={s} className={styles.surfaceHeader}>{s}</div>)}
        {expiries.map(exp => (
          <>
            <div key={`${exp}-label`} className={styles.surfaceExpiry}>{exp}</div>
            {strikes.map(str => {
              const cell = cells.find(c => c.expiry === exp && c.strike === str)!
              const t = (cell.vol - minVol) / (maxVol - minVol)
              const alpha = 0.12 + t * 0.65
              return (
                <div
                  key={`${exp}-${str}`}
                  className={styles.surfaceCell}
                  style={{
                    background: `rgba(${rgb},${alpha})`,
                    border: cell.isSellZone ? `1.5px solid rgba(${rgb},0.7)` : '1px solid transparent',
                  }}
                >
                  <span style={{ color: t > 0.55 ? `rgba(${rgb},1)` : 'var(--text-secondary)' }}>
                    {cell.vol.toFixed(0)}
                  </span>
                </div>
              )
            })}
          </>
        ))}
      </div>
      <div className={styles.surfaceNote}>Outlined cells = primary sell zone · Values = estimated implied vol</div>
    </div>
  )
}
