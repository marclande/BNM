'use client'

import { useState, useEffect } from 'react'
import styles from './Topbar.module.css'
import { type RegimeId, type RegimeConfig, type CarryResult } from '@/lib/regime'

interface Props {
  regime: RegimeId
  R: RegimeConfig
  carry: CarryResult
  onMenuClick: () => void
}

export default function Topbar({ regime, R, carry, onMenuClick }: Props) {
  const [time, setTime] = useState('')
  const [session, setSession] = useState('')

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
      const h = String(et.getHours()).padStart(2, '0')
      const m = String(et.getMinutes()).padStart(2, '0')
      const s = String(et.getSeconds()).padStart(2, '0')
      setTime(`${h}:${m}:${s} ET`)
      const hr = et.getHours()
      if (hr >= 9 && hr < 16) setSession('MARKET OPEN')
      else if (hr >= 4 && hr < 9) setSession('PRE-MARKET')
      else setSession('MARKET CLOSED')
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <button className={styles.menuButton} onClick={onMenuClick} aria-label="Toggle sidebar">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect y="2" width="16" height="1.5" rx="1"/>
            <rect y="7.25" width="16" height="1.5" rx="1"/>
            <rect y="12.5" width="16" height="1.5" rx="1"/>
          </svg>
        </button>
        <span className={styles.logo}>DRAGON // VOL DESK</span>
        <span
          className={styles.badge}
          style={{ color: R.color, borderColor: R.border, background: R.bg }}
        >
          {R.badge} — {R.name}
        </span>
      </div>
      <div className={styles.right}>
        <div className={styles.carryPill} style={{ color: carry.isPositive ? 'var(--positive)' : 'var(--negative)' }}>
          CARRY {carry.isPositive ? '+' : ''}{(carry.netCarryPct * 100).toFixed(2)}% / MO
        </div>
        <div className={styles.sessionBadge}>{session}</div>
        <div className={styles.clock}>{time}</div>
      </div>
    </div>
  )
}
