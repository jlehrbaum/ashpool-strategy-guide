// Signed session cookie helpers. Uses jose HS256 JWTs.
// The cookie is set after a successful OAuth + role check and is required
// by /api/guide to return content.

import { SignJWT, jwtVerify } from 'jose'

const COOKIE_NAME = 'sg_session'
const COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days

export async function signSession({ discordId, name, avatarUrl }) {
  const secret = getSecret()
  const now = Math.floor(Date.now() / 1000)
  return await new SignJWT({ did: discordId, name, avatar: avatarUrl })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + COOKIE_TTL_SECONDS)
    .sign(secret)
}

export async function verifySession(token) {
  if (!token) return null
  try {
    const secret = getSecret()
    const { payload } = await jwtVerify(token, secret)
    return payload
  } catch {
    return null
  }
}

export function setSessionCookie(res, token) {
  const isProd = (process.env.VERCEL_ENV || process.env.NODE_ENV) !== 'development'
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${COOKIE_TTL_SECONDS}`,
  ]
  if (isProd) parts.push('Secure')
  res.setHeader('Set-Cookie', parts.join('; '))
}

export function clearSessionCookie(res) {
  const isProd = (process.env.VERCEL_ENV || process.env.NODE_ENV) !== 'development'
  const parts = [
    `${COOKIE_NAME}=`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Max-Age=0',
  ]
  if (isProd) parts.push('Secure')
  res.setHeader('Set-Cookie', parts.join('; '))
}

export function parseCookies(cookieHeader) {
  const out = {}
  if (!cookieHeader) return out
  for (const part of cookieHeader.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k) out[k] = v.join('=')
  }
  return out
}

export function getSessionFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie || '')
  return cookies[COOKIE_NAME] || null
}

export const SESSION_COOKIE_NAME = COOKIE_NAME

function getSecret() {
  const s = process.env.SESSION_SECRET
  if (!s) throw new Error('SESSION_SECRET is not configured')
  return new TextEncoder().encode(s)
}
