'use client'

import styles from './Components.module.css'
import {
  type RegimeId, type RegimeConfig, type CarryResult, type TermPoint,
  type MultiCarryResult, type RVEntry, type AllocationEntry, type ProductVolEntry,
  ETN_PRODUCTS,
} from '@/lib/regime'
import { type DashState } from '@/app/page'

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

// ─── EtnProductPanel ───────────────────────────────────────────────────────────

const BIAS_COLOR: Record<string, string> = {
  LONG:  'var(--positive)',
  SHORT: 'var(--negative)',
  HEDGE: 'var(--warning)',
  OFF:   'var(--text-muted)',
}

interface EtnPanelProps {
  state: DashState
  regime: RegimeId
  R: RegimeConfig
  allocMatrix: Record<RegimeId, Record<string, AllocationEntry>>
}

export function EtnProductPanel({ state, regime, R, allocMatrix }: EtnPanelProps) {
  const prices: Record<string, number> = {
    UVXY: state.uvxy,
    UVIX: state.uvix,
    SVXY: state.svxy,
    VXX:  state.vxx,
  }
  const alloc = allocMatrix[regime]

  return (
    <div className={styles.etnGrid}>
      {(['UVXY', 'UVIX', 'SVXY', 'VXX'] as const).map(ticker => {
        const prod  = ETN_PRODUCTS[ticker]
        const price = prices[ticker]
        const entry = alloc[ticker]
        const isActive = entry.active
        const decaySign = prod.decayPctPerDay < 0 ? '+' : '-'
        const decayAbs  = Math.abs(prod.decayPctPerDay)

        return (
          <div key={ticker} className={styles.etnCard}
            style={{ borderColor: isActive ? R.border : 'var(--border-subtle)', background: isActive ? R.bg : 'var(--bg-card)' }}>
            <div className={styles.etnCardHeader}>
              <div className={styles.etnTicker} style={{ color: isActive ? R.color : 'var(--text-secondary)' }}>{ticker}</div>
              <div className={styles.etnStatus} style={{ color: isActive ? R.color : 'var(--text-muted)', borderColor: isActive ? R.border : 'var(--border-subtle)' }}>
                {isActive ? 'ACTIVE' : 'MONITORING'}
              </div>
            </div>

            <div className={styles.etnPrice}>${price.toFixed(2)}</div>
            <div className={styles.etnLeverage}>{prod.leverage}</div>

            <div className={styles.etnMeta}>
              <div className={styles.etnMetaRow}>
                <span className={styles.etnMetaLabel}>DECAY</span>
                <span className={styles.etnMetaVal} style={{ color: prod.direction === -1 ? 'var(--positive)' : 'var(--negative)' }}>
                  {decaySign}{decayAbs.toFixed(2)}%/day
                </span>
              </div>
              <div className={styles.etnMetaRow}>
                <span className={styles.etnMetaLabel}>OPT LIQ</span>
                <span className={styles.etnMetaVal} style={{ color: prod.liquidityGrade === 'A' ? 'var(--positive)' : prod.liquidityGrade === 'B' ? 'var(--warning)' : 'var(--text-secondary)' }}>
                  {prod.liquidityGrade}
                </span>
              </div>
              <div className={styles.etnMetaRow}>
                <span className={styles.etnMetaLabel}>ALLOC</span>
                <span className={styles.etnMetaVal}>{entry.weight}%</span>
              </div>
              <div className={styles.etnMetaRow}>
                <span className={styles.etnMetaLabel}>BIAS</span>
                <span className={styles.etnMetaVal} style={{ color: BIAS_COLOR[entry.bias] ?? 'var(--text-secondary)' }}>{entry.bias}</span>
              </div>
            </div>

            <div className={styles.etnNote}>{entry.note}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─── RegimeAllocationMatrix ────────────────────────────────────────────────────

interface AllocMatrixProps {
  regime: RegimeId
  allocMatrix: Record<RegimeId, Record<string, AllocationEntry>>
}

const REGIME_LABELS: Record<number, string> = {
  1: 'CONTANGO HARVEST',
  2: 'NEUTRAL CARRY',
  3: 'VOL EXPANSION',
  4: 'VOLMAGEDDON',
}

const REGIME_COLORS: Record<number, string> = {
  1: 'var(--regime-1)',
  2: 'var(--regime-2)',
  3: 'var(--regime-3)',
  4: 'var(--regime-4)',
}

export function RegimeAllocationMatrix({ regime, allocMatrix }: AllocMatrixProps) {
  const tickers = ['UVXY', 'UVIX', 'SVXY', 'VXX']

  function cellBg(bias: string, weight: number): string {
    if (weight === 0) return 'transparent'
    const a = Math.min(0.55, 0.08 + weight / 100 * 0.5)
    if (bias === 'LONG')  return `rgba(74,222,128,${a})`
    if (bias === 'SHORT') return `rgba(248,113,113,${a})`
    if (bias === 'HEDGE') return `rgba(251,191,36,${a})`
    return 'transparent'
  }

  return (
    <div className={styles.allocWrap}>
      <div className={styles.allocGrid}>
        {/* Header row */}
        <div className={styles.allocCorner} />
        {tickers.map(t => (
          <div key={t} className={styles.allocColHeader}>{t}</div>
        ))}

        {/* Data rows */}
        {([1, 2, 3, 4] as RegimeId[]).map(r => {
          const isActive = r === regime
          return (
            <>
              <div key={`label-${r}`} className={styles.allocRowLabel}
                style={{ color: isActive ? REGIME_COLORS[r] : 'var(--text-tertiary)', fontWeight: isActive ? 600 : 400 }}>
                R{r} {REGIME_LABELS[r]}
              </div>
              {tickers.map(t => {
                const entry = allocMatrix[r][t]
                return (
                  <div key={`${r}-${t}`} className={styles.allocCell}
                    style={{
                      background: cellBg(entry.bias, entry.weight),
                      border: isActive ? `1px solid ${REGIME_COLORS[r]}44` : '1px solid transparent',
                    }}>
                    <div className={styles.allocWeight} style={{ color: entry.weight === 0 ? 'var(--text-muted)' : BIAS_COLOR[entry.bias] }}>
                      {entry.weight > 0 ? `${entry.weight}%` : '—'}
                    </div>
                    <div className={styles.allocBias} style={{ color: BIAS_COLOR[entry.bias] }}>
                      {entry.weight > 0 ? entry.bias : ''}
                    </div>
                  </div>
                )
              })}
            </>
          )
        })}
      </div>
      <div className={styles.allocLegend}>
        <span style={{ color: 'var(--positive)' }}>■ LONG</span>
        <span style={{ color: 'var(--negative)' }}>■ SHORT</span>
        <span style={{ color: 'var(--warning)' }}>■ HEDGE</span>
        <span style={{ color: 'var(--text-muted)' }}>■ OFF</span>
        <span style={{ color: 'var(--text-tertiary)' }}>· Active regime highlighted</span>
      </div>
    </div>
  )
}

// ─── RelativeValueScanner ──────────────────────────────────────────────────────

interface RVProps { entries: RVEntry[]; regime: RegimeId; R: RegimeConfig }

const SIGNAL_COLORS: Record<RVEntry['signal'], string> = {
  RICH:  'var(--negative)',
  CHEAP: 'var(--positive)',
  FAIR:  'var(--text-secondary)',
}

export function RelativeValueScanner({ entries, regime, R }: RVProps) {
  return (
    <div className={styles.rvWrap}>
      <div className={styles.rvTable}>
        <div className={styles.rvHeader}>
          <span>SPREAD</span>
          <span>VALUE</span>
          <span>Z-SCORE</span>
          <span>SIGNAL</span>
          <span className={styles.rvDescCol}>INTERPRETATION</span>
        </div>
        {entries.map(e => {
          const zBarW = Math.min(100, Math.abs(e.zScore) * 33)
          const zColor = e.signal === 'RICH' ? 'var(--negative)' : e.signal === 'CHEAP' ? 'var(--positive)' : 'var(--text-tertiary)'
          return (
            <div key={e.label} className={styles.rvRow}>
              <span className={styles.rvLabel}>{e.label}</span>
              <span className={styles.rvSpread} style={{ color: e.spread > 0 ? 'var(--positive)' : 'var(--negative)' }}>
                {e.spread > 0 ? '+' : ''}{e.spread.toFixed(1)}%
              </span>
              <div className={styles.rvZCell}>
                <div className={styles.rvZBar}>
                  <div className={styles.rvZFill} style={{ width: `${zBarW}%`, background: zColor, marginLeft: e.zScore < 0 ? 'auto' : '0' }} />
                </div>
                <span className={styles.rvZVal} style={{ color: zColor }}>{e.zScore > 0 ? '+' : ''}{e.zScore.toFixed(2)}σ</span>
              </div>
              <span className={styles.rvSignal} style={{ color: SIGNAL_COLORS[e.signal] }}>{e.signal}</span>
              <span className={styles.rvDesc}>{e.desc}</span>
            </div>
          )
        })}
      </div>
      <div className={styles.rvNote}>Z-score vs estimated 20-day rolling mean · &gt;±1σ = actionable deviation</div>
    </div>
  )
}

// ─── MultiCarryBreakdown ───────────────────────────────────────────────────────

interface MCBProps { multiCarry: MultiCarryResult; regime: RegimeId; R: RegimeConfig }

export function MultiCarryBreakdown({ multiCarry: mc, regime, R }: MCBProps) {
  const items = [
    { label: 'UVXY PREMIUM',  val: `+$${Math.round(mc.uvxyPremium).toLocaleString()}`,  sub: 'call spreads / mo',  color: 'var(--positive)' },
    { label: 'UVIX PREMIUM',  val: `+$${Math.round(mc.uvixPremium).toLocaleString()}`,  sub: 'call spreads / mo',  color: 'var(--positive)' },
    { label: 'SVXY DRIFT',    val: `+$${Math.round(mc.svxyDrift).toLocaleString()}`,    sub: 'long drift / mo',    color: 'var(--positive)' },
    { label: 'VXX PREMIUM',   val: `+$${Math.round(mc.vxxPremium).toLocaleString()}`,   sub: 'call spreads / mo',  color: 'var(--positive)' },
    { label: 'HEDGE COSTS',   val: `-$${Math.round(mc.hedgeCosts).toLocaleString()}`,   sub: 'VIX calls + prot',   color: 'var(--warning)'  },
    { label: 'TX COSTS',      val: `-$${Math.round(mc.txCosts).toLocaleString()}`,      sub: 'est. / month',       color: 'var(--text-secondary)' },
    { label: 'NET CARRY',     val: `${mc.netCarry >= 0 ? '+' : ''}$${Math.round(mc.netCarry).toLocaleString()}`, sub: 'portfolio net / mo', color: mc.isPositive ? 'var(--positive)' : 'var(--negative)' },
  ]
  const grossPct = mc.totalGross > 0 ? ((mc.uvxyPremium / mc.totalGross) * 100).toFixed(0) : '0'

  return (
    <div className={styles.mcWrap}>
      <div className={styles.mcGrid}>
        {items.map(item => (
          <div key={item.label} className={styles.mcItem}>
            <div className={styles.mcLabel}>{item.label}</div>
            <div className={styles.mcVal} style={{ color: item.color }}>{item.val}</div>
            <div className={styles.mcSub}>{item.sub}</div>
          </div>
        ))}
      </div>
      <div className={styles.mcBar}>
        <div className={styles.mcBarLabel}>GROSS COMPOSITION</div>
        <div className={styles.mcBarTrack}>
          {mc.totalGross > 0 && [
            { key: 'UVXY', val: mc.uvxyPremium, color: 'var(--regime-1)' },
            { key: 'UVIX', val: mc.uvixPremium, color: 'var(--info)' },
            { key: 'SVXY', val: mc.svxyDrift,   color: 'var(--regime-2)' },
            { key: 'VXX',  val: mc.vxxPremium,  color: 'var(--warning)' },
          ].map(seg => (
            <div key={seg.key} className={styles.mcBarSeg}
              style={{ width: `${(seg.val / mc.totalGross) * 100}%`, background: seg.color }}
              title={`${seg.key}: $${Math.round(seg.val)}`}
            />
          ))}
        </div>
        <div className={styles.mcBarLegend}>
          {[{ l: 'UVXY', c: 'var(--regime-1)' }, { l: 'UVIX', c: 'var(--info)' }, { l: 'SVXY', c: 'var(--regime-2)' }, { l: 'VXX', c: 'var(--warning)' }].map(s => (
            <span key={s.l} style={{ color: s.c }}>■ {s.l}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── MultiPositionSpecs ────────────────────────────────────────────────────────

interface MPSProps { regime: RegimeId; R: RegimeConfig; state: DashState; carry: CarryResult; multiCarry: MultiCarryResult }

export function MultiPositionSpecs({ regime, R, state, carry, multiCarry: mc }: MPSProps) {
  const { vix, uvxy, uvix, svxy, vxx, acctK } = state
  const uvxyShort = (uvxy * 1.27).toFixed(2)
  const uvixShort = (uvix * 1.27).toFixed(2)
  const svxyPut   = (svxy * 0.92).toFixed(2)
  const vxxShort  = (vxx  * 1.20).toFixed(2)
  const vixStrike = Math.round(vix * 1.37)

  const groups: { ticker: string; color: string; rows: [string, string][]; footer?: [string, string][] }[] =
    regime === 4
      ? [
          {
            ticker: 'SVXY', color: 'var(--warning)',
            rows: [['ACTION', 'BUY PUTS'], ['STRIKE', `$${svxyPut}P`], ['EXPIRY', '30 DTE'], ['RATIONALE', 'CRASH PROTECT']],
            footer: [['STATUS', 'ACTIVE HEDGE']],
          },
          {
            ticker: 'UVXY', color: 'var(--negative)',
            rows: [['ACTION', 'COVER ALL'], ['PRIORITY', 'MARKET ORDER'], ['STATUS', 'REGIME 4']],
            footer: [['SHORTS', 'CLOSE NOW']],
          },
          {
            ticker: 'VIX CALLS', color: 'var(--negative)',
            rows: [['STRIKE', `${vixStrike}C`], ['ACTION', 'SCALE OUT 33%'], ['HARVESTER', 'ACTIVE']],
            footer: [['TARGET', `VIX > ${Math.round(vix * 1.4)}`]],
          },
          {
            ticker: 'UVIX / VXX', color: 'var(--text-muted)',
            rows: [['STATUS', 'NO NEW POS'], ['ACTION', 'MONITOR']],
            footer: [['REBUILD', `VIX < ${Math.round(vix * 0.7)}`]],
          },
        ]
      : [
          {
            ticker: 'UVXY', color: R.color,
            rows: [
              ['SELL', `$${uvxyShort}C`],
              ['EXPIRY', '21–28 DTE'],
              ['CONTRACTS', regime >= 3 ? String(Math.floor(carry.uvxyContracts / 2)) : String(carry.uvxyContracts)],
              ['STATUS', regime >= 3 ? 'REDUCED 50%' : 'ACTIVE'],
            ],
            footer: [['NET CR', `~$${(uvxy * 0.052).toFixed(2)}`], ['BIAS', 'SHORT']],
          },
          {
            ticker: 'UVIX', color: regime <= 2 ? R.color : 'var(--text-muted)',
            rows: [
              ['SELL', `$${uvixShort}C`],
              ['EXPIRY', '21–28 DTE'],
              ['STATUS', regime === 1 ? 'ACTIVE (ALT)' : regime === 2 ? 'MONITOR' : 'HEDGE VEHICLE'],
            ],
            footer: [['NET CR', `~$${(uvix * 0.050).toFixed(2)}`], ['BIAS', regime <= 2 ? 'SHORT' : 'HEDGE']],
          },
          {
            ticker: 'SVXY', color: regime < 3 ? 'var(--positive)' : 'var(--warning)',
            rows: [
              ['POSITION', regime < 3 ? 'LONG SHARES' : 'REDUCE/HEDGE'],
              ['STRIKE', regime < 3 ? `@ $${svxy.toFixed(2)}` : `$${svxyPut}P (hedge)`],
              ['STATUS', regime === 1 ? 'HEAVY LONG' : regime === 2 ? 'LIGHT LONG' : 'REDUCING'],
            ],
            footer: [['STOP', `-10% ($${(svxy * 0.90).toFixed(2)})`], ['BIAS', regime < 3 ? 'LONG' : 'HEDGE']],
          },
          {
            ticker: 'VXX', color: R.color,
            rows: [
              ['SELL', `$${vxxShort}C`],
              ['EXPIRY', '21–28 DTE'],
              ['STATUS', regime <= 2 ? 'ACTIVE' : 'PRIMARY SHORT'],
            ],
            footer: [['NET CR', `~$${(vxx * 0.038).toFixed(2)}`], ['BIAS', 'SHORT']],
          },
          {
            ticker: 'VIX CALLS', color: R.color,
            rows: [
              ['STRIKE', `${vixStrike}C`],
              ['EXPIRY', '60–90 DTE'],
              ['CONTRACTS', String(carry.vixCallContracts)],
              ['ROLL AT', '< 30 DTE'],
            ],
            footer: [['COST', `~$${(vix * 0.6).toFixed(0)}/ct`], ['BIAS', 'TAIL HEDGE']],
          },
        ]

  return (
    <div className={styles.mpWrap}>
      {groups.map(g => (
        <div key={g.ticker} className={styles.mpCard}>
          <div className={styles.mpCardHeader}>
            <span className={styles.mpTicker} style={{ color: g.color }}>{g.ticker}</span>
          </div>
          <div className={styles.posRows}>
            {g.rows.map(([label, val]) => (
              <div key={label} className={styles.posRow}>
                <span className={styles.posRowLabel}>{label}</span>
                <span className={styles.posRowVal}>{val}</span>
              </div>
            ))}
          </div>
          {g.footer && (
            <div className={styles.posFooter}>
              {g.footer.map(([label, val]) => (
                <div key={label} className={styles.posFooterItem}>
                  <div className={styles.posFooterLabel}>{label}</div>
                  <div className={styles.posFooterVal}>{val}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── ProductVolScan ────────────────────────────────────────────────────────────

interface PVSProps { entries: ProductVolEntry[]; regime: RegimeId; R: RegimeConfig }

const GRADE_COLORS: Record<ProductVolEntry['premiumGrade'], string> = {
  HIGH: 'var(--positive)',
  MED:  'var(--warning)',
  LOW:  'var(--text-secondary)',
}

export function ProductVolScan({ entries, regime, R }: PVSProps) {
  const maxRichness = Math.max(...entries.map(e => e.richness))

  return (
    <div className={styles.pvsWrap}>
      {entries.map(e => (
        <div key={e.ticker} className={styles.pvsRow}>
          <div className={styles.pvsTicker} style={{ color: e.premiumGrade === 'HIGH' ? R.color : 'var(--text-secondary)' }}>
            {e.ticker}
          </div>
          <div className={styles.pvsBar}>
            <div className={styles.pvsBarFill} style={{ width: `${e.richness}%`, background: GRADE_COLORS[e.premiumGrade] }} />
          </div>
          <div className={styles.pvsStats}>
            <span className={styles.pvsVol}>IV≈{e.atmVol.toFixed(0)}</span>
            <span className={styles.pvsGrade} style={{ color: GRADE_COLORS[e.premiumGrade] }}>{e.premiumGrade}</span>
            <span className={styles.pvsSellZone}>SELL: {e.sellZone}</span>
          </div>
        </div>
      ))}
      <div className={styles.pvsNote}>ATM IV estimates · Sell zone = primary premium extraction target · Values derived from VIX</div>
    </div>
  )
}
