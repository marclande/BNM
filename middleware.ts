import { NextRequest, NextResponse } from 'next/server'
import { computeSessionToken, SESSION_COOKIE } from '@/lib/auth'

export async function middleware(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value
  if (!cookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const expected = await computeSessionToken()
    if (cookie !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } catch {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  return NextResponse.next()
}

// Only protect the data API routes — not /api/auth (login endpoint)
export const config = {
  matcher: ['/api/quotes', '/api/thetadata', '/api/etf-prices'],
}
