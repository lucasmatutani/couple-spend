const INVITE_TTL_SECONDS = 7 * 24 * 60 * 60

function toBase64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...Array.from(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromBase64url(s: string): Uint8Array {
  const padded = s
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(s.length + ((4 - (s.length % 4)) % 4), '=')
  return new Uint8Array(
    atob(padded)
      .split('')
      .map((c) => c.charCodeAt(0)),
  )
}

async function getKey(): Promise<CryptoKey> {
  const secret = process.env['INVITE_SECRET'] ?? 'dev-secret-change-in-prod'
  const keyBytes = new TextEncoder().encode(secret)
  return crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ])
}

export async function generateInviteToken(householdId: string): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000)
  const payload = `${householdId}:${timestamp}`
  const key = await getKey()
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return `${toBase64url(new TextEncoder().encode(payload))}.${toBase64url(new Uint8Array(sig))}`
}

export async function verifyInviteToken(token: string): Promise<{ householdId: string } | null> {
  const dotIdx = token.lastIndexOf('.')
  if (dotIdx === -1) return null

  const payloadB64 = token.slice(0, dotIdx)
  const sigB64 = token.slice(dotIdx + 1)

  let payload: string
  try {
    payload = new TextDecoder().decode(fromBase64url(payloadB64))
  } catch {
    return null
  }

  const colonIdx = payload.lastIndexOf(':')
  if (colonIdx === -1) return null
  const householdId = payload.slice(0, colonIdx)
  const timestamp = parseInt(payload.slice(colonIdx + 1), 10)
  if (isNaN(timestamp)) return null

  if (Math.floor(Date.now() / 1000) - timestamp > INVITE_TTL_SECONDS) return null

  const key = await getKey()
  let sigBytes: Uint8Array
  try {
    sigBytes = fromBase64url(sigB64)
  } catch {
    return null
  }

  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes as unknown as Uint8Array<ArrayBuffer>,
    new TextEncoder().encode(payload) as unknown as Uint8Array<ArrayBuffer>,
  )
  if (!valid) return null

  return { householdId }
}
