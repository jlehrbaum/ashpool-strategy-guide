// Complete Discord OAuth, verify guild membership + required role, and set
// a signed session cookie. Redirects back to / on success, or shows an
// error page on failure.

import { parseCookies, signSession, setSessionCookie } from '../../_lib/session.js'

export default async function handler(req, res) {
  try {
    const { code, state, error: providerError, error_description } = req.query

    if (providerError) {
      const detail = error_description ? ` — ${error_description}` : ''
      return htmlError(res, `Discord returned an error: ${providerError}${detail}`)
    }
    if (!code) {
      return htmlError(res, 'Missing authorization code.')
    }

    const cookieState = parseCookies(req.headers.cookie || '').oauth_state
    if (!state || !cookieState || state !== cookieState) {
      return htmlError(res, 'State mismatch — possible CSRF. Try signing in again.')
    }

    const {
      DISCORD_CLIENT_ID,
      DISCORD_CLIENT_SECRET,
      DISCORD_GUILD_ID,
      DISCORD_ROLE_ID,
      SESSION_SECRET,
    } = process.env

    const missing = [
      'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET',
      'DISCORD_GUILD_ID', 'DISCORD_ROLE_ID',
      'SESSION_SECRET',
    ].filter((k) => !process.env[k])
    if (missing.length) {
      return htmlError(res, `Server misconfigured — missing env vars: ${missing.join(', ')}`)
    }

    const origin = getOrigin(req)

    // 1. Exchange the code for a Discord access token.
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${origin}/api/auth/discord/callback`,
      }),
    })
    if (!tokenRes.ok) {
      const body = await tokenRes.text()
      return htmlError(res, `Discord token exchange failed (${tokenRes.status}): ${body}`)
    }
    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token

    // 2. Fetch the Discord user identity.
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!userRes.ok) {
      return htmlError(res, `Discord user fetch failed (${userRes.status})`)
    }
    const discord = await userRes.json()

    // 3. Fetch the user's membership in the configured guild. This uses the
    // guilds.members.read scope to read the caller's own member object,
    // which includes their role IDs.
    const memberRes = await fetch(
      `https://discord.com/api/users/@me/guilds/${DISCORD_GUILD_ID}/member`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (memberRes.status === 404) {
      return accessDenied(res, 'You must be a member of the required Discord server to access this guide.', discord)
    }
    if (!memberRes.ok) {
      const body = await memberRes.text()
      return htmlError(res, `Discord guild member lookup failed (${memberRes.status}): ${body}`)
    }
    const member = await memberRes.json()
    const roles = Array.isArray(member.roles) ? member.roles : []

    if (!roles.includes(DISCORD_ROLE_ID)) {
      return accessDenied(res, 'Your Discord account does not have the required role to access this guide.', discord)
    }

    // 4. Mint session cookie and clear the state cookie.
    const displayName = discord.global_name || discord.username || 'user'
    const avatarUrl = discord.avatar
      ? `https://cdn.discordapp.com/avatars/${discord.id}/${discord.avatar}.png`
      : null

    const session = await signSession({
      discordId: discord.id,
      name: displayName,
      avatarUrl,
    })

    const cookies = [
      cookieString('oauth_state', '', { maxAge: 0, prod: origin.startsWith('https://') }),
      cookieString('sg_session', session, { maxAge: 60 * 60 * 24 * 30, prod: origin.startsWith('https://') }),
    ]
    res.setHeader('Set-Cookie', cookies)

    res.setHeader('Location', origin + '/')
    res.status(302).end()
  } catch (err) {
    console.error('Discord callback error:', err)
    return htmlError(res, `Auth error: ${err.message || err}`)
  }
}

function cookieString(name, value, { maxAge, prod }) {
  const parts = [
    `${name}=${value}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ]
  if (prod) parts.push('Secure')
  return parts.join('; ')
}

function getOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  return `${proto}://${host}`
}

function htmlError(res, message) {
  res.status(400).setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(`<!doctype html><html><body style="font-family:sans-serif;background:#0f1117;color:#e2e5ef;padding:2rem;max-width:600px;margin:40px auto"><h1 style="color:#e05a3a">Sign-in failed</h1><p>${escapeHtml(message)}</p><p><a style="color:#6c8ef5" href="/api/auth/discord/authorize">Try again</a></p></body></html>`)
}

function accessDenied(res, message, discord) {
  const name = discord ? escapeHtml(discord.global_name || discord.username || '') : ''
  res.status(403).setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(`<!doctype html><html><body style="font-family:sans-serif;background:#0f1117;color:#e2e5ef;padding:2rem;max-width:600px;margin:40px auto"><h1 style="color:#e05a3a">Access denied</h1><p>${escapeHtml(message)}</p>${name ? `<p style="color:#8a8f9f">Signed in as ${name}</p>` : ''}<p><a style="color:#6c8ef5" href="/api/auth/logout">Sign out</a></p></body></html>`)
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}
