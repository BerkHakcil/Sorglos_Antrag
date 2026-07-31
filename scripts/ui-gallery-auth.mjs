/**
 * E-5 auth-state gallery — the signed-out screens plus the two "we emailed
 * you" confirmations, which the general gallery script does not reach.
 *
 *   node scripts/ui-gallery-auth.mjs <sub-phase> [--base <url>]
 *
 * States, each at 1280x800 and 375x812:
 *   01-login              login card
 *   02-signup             signup card, all fields + consents
 *   03-signup-confirm     the "check your inbox" notice AFTER a real signup
 *   04-reset-request      password-reset request card
 *   05-reset-confirm      the "we sent you a link" notice
 *
 * ⚠ 03 performs a REAL signup through the UI, which creates an auth user.
 * Prod has email confirmation enabled, so nothing is delivered to an
 * @hzp-test.invalid address and the account stays unconfirmed. It is deleted
 * in `finally` regardless. 05 requests a reset for that same address, which
 * likewise sends nothing deliverable.
 *
 * Button labels are read from lib/strings/de.ts, never guessed — "Registrieren"
 * (exact, to avoid matching the "Registrieren" LINK on the login card) and
 * "Link zum Zurücksetzen senden".
 *
 * ⚠ PRIVACY — the repo is PUBLIC. Synthetic identity only ("Maria
 * Musterfrau"). No real person appears.
 */

import { createClient } from '@supabase/supabase-js'
import { chromium } from '@playwright/test'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { config } from 'dotenv'
import { gotoWhenReady } from './lib/preview-ready.mjs'

config({ path: '.env.local' })

const subPhase = process.argv[2]
if (!subPhase) {
  console.error('Usage: node scripts/ui-gallery-auth.mjs <sub-phase> [--base <url>]')
  process.exit(1)
}
const baseIdx = process.argv.indexOf('--base')
const BASE =
  baseIdx > -1 ? process.argv[baseIdx + 1] : (process.env.E2E_BASE_URL ?? 'http://localhost:3000')
const OUT = join('docs', 'feedback', 'ui-gallery', subPhase)
mkdirSync(OUT, { recursive: true })

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
const extraHTTPHeaders = bypass
  ? { 'x-vercel-protection-bypass': bypass, 'x-vercel-set-bypass-cookie': 'true' }
  : {}

const DESKTOP = { width: 1280, height: 800 }
const MOBILE = { width: 375, height: 812 }
const email = `pw-authgallery+${Date.now()}@hzp-test.invalid`

const browser = await chromium.launch()

async function shoot(page, name) {
  for (const [tag, vp] of [
    ['desktop', DESKTOP],
    ['mobile', MOBILE],
  ]) {
    await page.setViewportSize(vp)
    await page.waitForTimeout(400)
    await page.screenshot({ path: join(OUT, `${name}-${tag}.png`), fullPage: true })
    console.log(`   ${name}-${tag}.png`)
  }
  await page.setViewportSize(DESKTOP)
}

try {
  const ctx = await browser.newContext({ viewport: DESKTOP, extraHTTPHeaders })
  const page = await ctx.newPage()

  await gotoWhenReady(page, `${BASE}/login`, '[name=email]')
  await page.locator('[name=email]').waitFor({ state: 'visible', timeout: 30_000 })
  await shoot(page, '01-login')

  await page.goto(`${BASE}/signup`)
  await page.locator('[name=first_name]').waitFor({ state: 'visible', timeout: 30_000 })
  await shoot(page, '02-signup')

  // Real signup → the confirmation notice.
  await page.locator('[name=first_name]').fill('Maria')
  await page.locator('[name=last_name]').fill('Musterfrau')
  await page.locator('[data-testid=phone-input]').fill('1512 3456789')
  await page.locator('[name=email]').fill(email)
  await page.locator('[name=password]').fill('TestPassw0rd!')
  for (const n of [
    'consent_datenschutz',
    'consent_agb',
    'consent_data_processing',
    'consent_authority_to_act',
  ]) {
    await page.locator(`[name=${n}]`).check()
  }
  await page.getByRole('button', { name: 'Registrieren', exact: true }).click()
  await page.locator('[role=status]').waitFor({ state: 'visible', timeout: 30_000 })
  await shoot(page, '03-signup-confirm')

  await page.goto(`${BASE}/reset-password`)
  await page.locator('[name=email]').waitFor({ state: 'visible', timeout: 30_000 })
  await shoot(page, '04-reset-request')

  await page.locator('[name=email]').fill(email)
  await page.getByRole('button', { name: 'Link zum Zurücksetzen senden' }).click()
  await page.locator('[role=status]').waitFor({ state: 'visible', timeout: 30_000 })
  await shoot(page, '05-reset-confirm')

  await ctx.close()
} finally {
  await browser.close()
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 })
  const u = data?.users?.find((x) => x.email === email)
  if (u) {
    const { error } = await admin.auth.admin.deleteUser(u.id)
    console.log(error ? `CLEANUP FAILED: ${error.message}` : `[auth-gallery] deleted ${email}`)
  } else {
    console.log(`[auth-gallery] no user to delete for ${email}`)
  }
}
console.log(`\n[auth-gallery] written to ${OUT}`)
