// Kick off Discord OAuth. Scopes: identify + guilds.members.read so the
// callback can read the user's membership in the configured guild and
// check for the required role.

import { randomBytes } from 'node:crypto'

export default function handler(req, res) {
  const clientId = process.env.DISCORD_CLIENT_ID
  if (!clientId) {
    return res.status(500).send('DISCORD_CLIENT_ID is not configured')
  }

  const origin = getOrigin(req)
  const redirectUri = `${origin}/api/auth/discord/callback`

  // CSRF-defense: random state, stored in an httpOnly cookie and echoed back
  // in the OAuth request so we can verify it on the callback.
  const state = randomBytes(24).toString('hex')

  const isProd = origin.startsWith('https://')
  res.setHeader(
    'Set-Cookie',
    [
      `oauth_state=${state}`,
      'HttpOnly',
      'Path=/',
      'SameSite=Lax',
      isProd ? 'Secure' : '',
      'Max-Age=600',
    ].filter(Boolean).join('; ')
  )

  const url = new URL('https://discord.com/oauth2/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'identify guilds.members.read')
  url.searchParams.set('state', state)

  res.setHeader('Location', url.toString())
  res.status(302).end()
}

function getOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  return `${proto}://${host}`
}
