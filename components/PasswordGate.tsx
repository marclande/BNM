'use client'

import { useState, useEffect, useRef } from 'react'

const KEY = 'dvd_auth'
const CORRECT = 'damianmarley'

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false)
  const [input, setInput]       = useState('')
  const [error, setError]       = useState(false)
  const [ready, setReady]       = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (sessionStorage.getItem(KEY) === '1') {
      setUnlocked(true)
    }
    setReady(true)
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [])

  function attempt() {
    if (input.toLowerCase().trim() === CORRECT) {
      sessionStorage.setItem(KEY, '1')
      setUnlocked(true)
      setError(false)
    } else {
      setError(true)
      setInput('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  if (!ready) return null
  if (unlocked) return <>{children}</>

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0a0d14',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-mono, monospace)',
      color: '#e8ecf4',
    }}>

      {/* Dragon glyph */}
      <div style={{ fontSize: 48, marginBottom: 24, opacity: 0.15, userSelect: 'none' }}>
        ◈
      </div>

      {/* Title */}
      <div style={{
        fontSize: 22, fontWeight: 600, letterSpacing: '0.12em',
        color: '#4ade80', marginBottom: 6,
      }}>
        DRAGON // VOL DESK
      </div>

      {/* Under construction badge */}
      <div style={{
        fontSize: 9, letterSpacing: '0.22em', color: '#4a5468',
        border: '1px solid #1e2535', borderRadius: 2,
        padding: '3px 10px', marginBottom: 40,
      }}>
        UNDER CONSTRUCTION
      </div>

      {/* Password form */}
      <div style={{
        background: '#0f1420', border: '1px solid #1e2535',
        borderRadius: 6, padding: '28px 32px', width: 320,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ fontSize: 9, letterSpacing: '0.18em', color: '#4a5468', marginBottom: 2 }}>
          ACCESS CODE
        </div>

        <input
          ref={inputRef}
          type="password"
          value={input}
          placeholder="Enter password"
          onChange={e => { setInput(e.target.value); setError(false) }}
          onKeyDown={e => e.key === 'Enter' && attempt()}
          style={{
            background: '#0d1119',
            border: `1px solid ${error ? '#f87171' : '#1e2535'}`,
            borderRadius: 4, padding: '10px 12px',
            color: '#e8ecf4', fontSize: 14,
            fontFamily: 'inherit', outline: 'none',
            transition: 'border-color 0.2s',
            letterSpacing: '0.08em',
          }}
          autoComplete="off"
        />

        {error && (
          <div style={{ fontSize: 10, color: '#f87171', letterSpacing: '0.1em', marginTop: -6 }}>
            INCORRECT — TRY AGAIN
          </div>
        )}

        <button
          onClick={attempt}
          style={{
            background: '#4ade8011', border: '1px solid #4ade8033',
            borderRadius: 4, padding: '10px',
            color: '#4ade80', fontSize: 11,
            fontFamily: 'inherit', letterSpacing: '0.14em',
            cursor: 'pointer', transition: 'background 0.2s, border-color 0.2s',
          }}
          onMouseEnter={e => {
            (e.target as HTMLButtonElement).style.background = '#4ade8022'
            ;(e.target as HTMLButtonElement).style.borderColor = '#4ade8066'
          }}
          onMouseLeave={e => {
            (e.target as HTMLButtonElement).style.background = '#4ade8011'
            ;(e.target as HTMLButtonElement).style.borderColor = '#4ade8033'
          }}
        >
          ENTER
        </button>
      </div>

      <div style={{ fontSize: 9, color: '#2e3648', marginTop: 32, letterSpacing: '0.12em' }}>
        SITE COMING SOON
      </div>
    </div>
  )
}
