// Auth-gated guide content endpoint. Returns the guide JSON if the session
// cookie is valid, 401 otherwise. The client in index.html handles 401 by
// redirecting to /api/auth/discord/authorize.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { getSessionFromRequest, verifySession } from './_lib/session.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const GUIDE_PATH = join(__dirname, '_lib', 'guide.json')

// Load once at cold start, cache in memory.
const guideJson = readFileSync(GUIDE_PATH, 'utf8')

export default async function handler(req, res) {
  const token = getSessionFromRequest(req)
  const session = await verifySession(token)
  if (!session) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  // Add session info to the response so the client can show who's signed in.
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'private, max-age=60')
  res.setHeader('X-Session-Name', session.name || '')
  res.send(guideJson)
}
