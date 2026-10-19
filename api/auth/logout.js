// Clear the session cookie and redirect to /.
import { clearSessionCookie } from '../_lib/session.js'

export default function handler(req, res) {
  clearSessionCookie(res)
  const origin = getOrigin(req)
  res.setHeader('Location', origin + '/')
  res.status(302).end()
}

function getOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  return `${proto}://${host}`
}
