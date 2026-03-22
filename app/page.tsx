'use client'

import { useState, useCallback } from 'react'
import styles from './page.module.css'
import { useMarketData } from '@/lib/useMarketData'
import {
  classifyRegime, regimeConfidence, calcCarry,
  buildTermStructure, buildVolSurface, REGIMES,
  type RegimeId,
} from '@/lib/regime'
import Topbar from '@/components/Topbar'
import Sidebar from '@/components/Sidebar'
import { RegimePanel, TermStructureChart, CarryBreakdown, PositionSpecs, SatelliteScanner, VolSurface, TradeRecommendations } from '@/components/index'

export interface DashState {
  vix: number
  vix3m: number
  vvix: number
  spx: number
  uvxy: number
  acctK: number
  maxRiskPct: number
}

const DEFAULT: DashState = {
  vix: 16.2,
  vix3m: 18.9,
  vvix: 94,
  spx: 5820,
  uvxy: 8.42,
  acctK: 200,
  maxRiskPct: 2.0,
}

export default function Page() {
  const [state, setState] = useState<DashState>(DEFAULT)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const regime: RegimeId = classifyRegime(state.vix, state.vix3m, state.vvix)
  const R = REGIMES[regime]
  const confidence = regimeConfidence(state.vix, state.vix3m, state.vvix, regime)
  const carry = calcCarry(state.vix, state.vix3m, state.uvxy, state.acctK, state.maxRiskPct, regime)
  const termStructure = buildTermStructure(state.vix, state.vix3m)
  const volSurface = buildVolSurface(state.vix)
  const ratio = state.vix / state.vix3m

  const update = useCallback((key: keyof DashState, val: number) => {
    setState(prev => ({ ...prev, [key]: val }))
  }, [])

  const feedState = useMarketData(update)

  return (
    <div className={styles.app}>
      <Topbar regime={regime} R={R} carry={carry} onMenuClick={() => setSidebarOpen(o => !o)} />
      {sidebarOpen && <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />}
      <div className={styles.layout}>
        <Sidebar state={state} update={update} regime={regime} carry={carry} R={R} isOpen={sidebarOpen} feedState={feedState} />
        <main className={styles.content}>
          <RegimePanel regime={regime} R={R} confidence={confidence} ratio={ratio} vvix={state.vvix} vix={state.vix} />
          <div className={styles.scrollArea}>
            <Section label="Daily Trade Recommendations — 4 Windows · 4 Risk Tiers">
              <TradeRecommendations state={state} regime={regime} />
            </Section>
            <Section label="VIX Term Structure">
              <TermStructureChart points={termStructure} regime={regime} ratio={ratio} />
            </Section>
            <Section label="Carry Breakdown">
              <CarryBreakdown carry={carry} />
            </Section>
            <Section label="Active Position Specs">
              <PositionSpecs regime={regime} R={R} state={state} carry={carry} />
            </Section>
            <Section label="Satellite Scanner">
              <SatelliteScanner regime={regime} R={R} vix={state.vix} />
            </Section>
            <Section label="Implied Vol Surface — UVXY Sell Zone">
              <VolSurface surface={volSurface} regime={regime} R={R} />
            </Section>
          </div>
        </main>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>{label}</div>
      {children}
    </div>
  )
}
