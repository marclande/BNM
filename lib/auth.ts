export const SESSION_COOKIE = 'dvd_session'

export async function computeSessionToken(): Promise<string> {
  const password = process.env.APP_PASSWORD
  if (!password) throw new Error('APP_PASSWORD environment variable is required')
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode('dvd_auth_v1'))
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
