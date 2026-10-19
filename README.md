# Wing Fighter Strategy Guide

Static strategy guide site, auth-gated to members of a specific Discord server with a required role.

## Files

- `index.html` — shell: CSS, title-block/sidebar/content containers, renderer that fetches the guide and auto-generates the TOC
- `api/_lib/guide.json` — the guide content as a flat array of blocks (`h1`/`h2`/`h3`/`p`/`ul`/`ol`/`table`/`callout`); edit this to change content
- `api/_lib/session.js` — signed-cookie session helpers (jose, HS256)
- `api/auth/discord/authorize.js` — kicks off Discord OAuth (`identify` + `guilds.members.read` scopes)
- `api/auth/discord/callback.js` — exchanges code, checks guild membership and role, sets session cookie
- `api/auth/logout.js` — clears the session cookie
- `api/guide.js` — serves the guide JSON if session is valid; 401 otherwise
- `vercel.json` — bundles `api/_lib/guide.json` with the guide function
- `package.json` — one dependency (`jose`)

## Required Vercel env vars

| Var | What it is |
| --- | --- |
| `DISCORD_CLIENT_ID` | from your Discord application's OAuth2 settings |
| `DISCORD_CLIENT_SECRET` | from your Discord application's OAuth2 settings |
| `DISCORD_GUILD_ID` | your Discord server ID (enable Developer Mode in Discord, right-click server → Copy Server ID) |
| `DISCORD_ROLE_ID` | the "member" role ID (right-click role in server settings → Copy Role ID) |
| `SESSION_SECRET` | any random 32+ character string for signing session cookies |

## Discord app setup

1. Create an app at <https://discord.com/developers/applications>
2. Under **OAuth2**, add a redirect URI: `https://<your-domain>/api/auth/discord/callback` (plus any preview/dev domains you deploy to)
3. Copy Client ID and Client Secret into the Vercel env vars above
4. No bot token is needed; the OAuth flow uses the user's access token to read their own membership

## How auth gating works

1. Browser requests `/` and loads `index.html`
2. `index.html` fetches `/api/guide`
3. If no valid session cookie, `/api/guide` returns 401 and the client bounces to `/api/auth/discord/authorize`
4. Discord sends the user back to `/api/auth/discord/callback` with a code
5. Callback exchanges the code, fetches the user's identity and guild membership, and verifies the required role is present
6. On success: signed session cookie is set (30 days), browser is redirected back to `/`
7. On failure: an "access denied" page explains why, with a sign-out link to try a different account
