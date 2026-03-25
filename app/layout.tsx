import type { Metadata, Viewport } from 'next'
import './globals.css'
import PasswordGate from '@/components/PasswordGate'

export const metadata: Metadata = {
  title: 'Dragon Vol Desk',
  description: 'Volatility regime dashboard — Artemis Dragon strategy',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <PasswordGate>{children}</PasswordGate>
      </body>
    </html>
  )
}
