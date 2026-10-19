// Auth-gated guide content endpoint. Returns the guide JSON if the session
// cookie is valid, 401 otherwise. The client in index.html handles 401 by
// redirecting to /api/auth/discord/authorize.

import { readFileSync } from 'node:fs'
import { getSessionFromRequest, verifySession } from './_lib/session.js'

// Resolve the data file relative to this module. Vercel bundles files listed
// in vercel.json functions.includeFiles alongside the function.
const GUIDE_URL = new URL('./_lib/guide.json', import.meta.url)

// Cache the file contents between warm invocations.
let guideJsonCache = null
function loadGuide() {
  if (guideJsonCache === null) {
    guideJsonCache = readFileSync(GUIDE_URL, 'utf8')
  }
  return guideJsonCache
}

export default async function handler(req, res) {
  try {
    const token = getSessionFromRequest(req)
    const session = await verifySession(token)
    if (!session) {
      res.status(401).json({ error: 'unauthorized' })
      return
    }

    const body = loadGuide()
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'private, max-age=60')
    res.setHeader('X-Session-Name', session.name || '')
    res.status(200).send(body)
  } catch (err) {
    console.error('guide handler error:', err)
    res.status(500).json({
      error: 'guide_handler_error',
      message: err && err.message ? err.message : String(err),
      path: GUIDE_URL.pathname,
    })
  }
}
