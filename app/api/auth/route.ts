import { NextRequest, NextResponse } from 'next/server'
import { computeSessionToken, SESSION_COOKIE } from '@/lib/auth'

// GET — check if current session cookie is valid
export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value
  if (!cookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const expected = await computeSessionToken()
    if (cookie !== expected) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }
}

// POST — verify password and issue session cookie
export async function POST(req: NextRequest) {
  let password: string
  try {
    ;({ password } = await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const expected = process.env.APP_PASSWORD
  if (!expected || password !== expected) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const token = await computeSessionToken()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24, // 24 hours
  })
  return res
}
