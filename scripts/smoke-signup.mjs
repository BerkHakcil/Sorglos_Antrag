/**
 * Signup-path smoke check — proves the auth email pipeline end to end at the
 * transport level.
 *
 * POSTs /auth/v1/signup with a unique throwaway address (the exact request the
 * signup Server Action makes) and asserts HTTP 200. GoTrue only returns 200
 * after the SMTP server ACCEPTED the confirmation email, and it rolls the user
 * back when sending fails — so this one assertion is precisely the check that
 * would have caught the 2026-07-20 outage (Brevo rejected the SMTP login with
 * 535; every signup 500'd with "Error sending confirmation email" for days
 * while the app showed only a generic error).
 *
 * The created unconfirmed user is deleted via the admin API in `finally`.
 *
 * What this does NOT verify: inbox delivery (SMTP acceptance ≠ delivered).
 * At this scale a periodic human glance at Brevo's transactional statistics
 * covers that; full IMAP verification would be over-engineering.
 *
 * Usage:
 *   npm run smoke:signup
 *
 * Env (from .env.local): NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY.
 * Optional SMOKE_SIGNUP_DOMAIN overrides the throwaway address domain
 * (default urasco.com — a domain the team controls; the tagged address
 * doesn't need a real mailbox, one bounced mail per run is acceptable).
 * NOTE: the domain must look real to GoTrue — reserved TLDs like .invalid
 * are rejected at validation, before the email step this check exists for.
 *
 * Costs one email of the Supabase auth rate-limit budget (30/hr) per run.
 * Run it as a pre-release checklist step and after any change to the
 * SMTP/Brevo configuration.
 *
 * Exit 0 = signup path healthy. Exit 1 = failure (details printed).
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SECRET = process.env.SUPABASE_SECRET_KEY

if (!URL_BASE || !PUBLISHABLE || !SECRET) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or SUPABASE_SECRET_KEY in .env.local'
  )
  process.exit(1)
}

const DOMAIN = process.env.SMOKE_SIGNUP_DOMAIN ?? 'urasco.com'
const EMAIL = `signup-smoke+${Date.now()}@${DOMAIN}`

const adminHeaders = { apikey: SECRET, Authorization: `Bearer ${SECRET}` }

async function deleteUserByEmail(email) {
  const res = await fetch(`${URL_BASE}/auth/v1/admin/users?per_page=100`, { headers: adminHeaders })
  if (!res.ok) throw new Error(`admin list users failed: HTTP ${res.status}`)
  const { users } = await res.json()
  const user = users.find((u) => u.email === email)
  if (!user) return false
  const del = await fetch(`${URL_BASE}/auth/v1/admin/users/${user.id}`, {
    method: 'DELETE',
    headers: adminHeaders,
  })
  if (!del.ok) throw new Error(`admin delete user ${user.id} failed: HTTP ${del.status}`)
  return true
}

let failed = false
try {
  console.log(`Signup smoke check → ${EMAIL}`)
  const res = await fetch(`${URL_BASE}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: EMAIL,
      password: `Smoke-${Date.now()}!aA`,
      data: { first_name: 'Smoke', last_name: 'Check' },
    }),
  })
  const body = await res.json().catch(() => ({}))

  if (res.status === 200) {
    console.log('OK — HTTP 200: user created, confirmation email accepted by SMTP.')
  } else {
    failed = true
    console.error(`FAIL — HTTP ${res.status}. The signup path is broken. Response body:`)
    console.error(JSON.stringify(body, null, 2))
    if (body.msg?.toLowerCase().includes('error sending')) {
      console.error(
        '\nThis is an SMTP send failure. Check the Supabase Auth logs for the raw SMTP error\n' +
          '(e.g. "535 Authentication failed") and the Brevo SMTP settings — see the\n' +
          '"Email delivery" section of docs/milestone-log.md.'
      )
    }
  }
} catch (err) {
  failed = true
  console.error('FAIL — request error:', err)
} finally {
  try {
    const deleted = await deleteUserByEmail(EMAIL)
    console.log(
      deleted ? `Cleaned up throwaway user ${EMAIL}.` : 'No user to clean up (rolled back).'
    )
  } catch (err) {
    // Leaving an unconfirmed throwaway behind is harmless but should be visible.
    console.error(`WARNING: could not clean up ${EMAIL}:`, err)
  }
}

process.exit(failed ? 1 : 0)
