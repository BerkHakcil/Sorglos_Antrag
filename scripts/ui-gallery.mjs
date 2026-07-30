/**
 * UI gallery capture (Phase E) — before/after screenshots for Roman's visual
 * sign-off, so he never needs preview access.
 *
 *   node scripts/ui-gallery.mjs <sub-phase> [--base <url>]
 *   e.g. node scripts/ui-gallery.mjs E-1-tokens --base https://<preview>
 *
 * ⚠ PRIVACY — the repo is PUBLIC. Every shot is taken on a throwaway account
 * driven with obviously synthetic answers ("Maria Musterfrau"); a real pilot
 * case must never be photographed. The account is deleted in `finally`.
 *
 * Writes docs/feedback/ui-gallery/<sub-phase>/<screen>-<viewport>.png at
 * 1280x800 (desktop) and 375x812 (mobile).
 */

import { createClient } from '@supabase/supabase-js'
import { chromium } from '@playwright/test'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { config } from 'dotenv'

config({ path: '.env.local' })

const subPhase = process.argv[2]
if (!subPhase) {
  console.error('Usage: node scripts/ui-gallery.mjs <sub-phase> [--base <url>]')
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

const VIEWPORTS = [
  { tag: 'desktop', width: 1280, height: 800 },
  { tag: 'mobile', width: 375, height: 812 },
]

// Bypass header for SSO-protected previews (see playwright.config.ts).
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
const extraHTTPHeaders = bypass
  ? { 'x-vercel-protection-bypass': bypass, 'x-vercel-set-bypass-cookie': 'true' }
  : {}

const email = `pw-gallery+${Date.now()}@hzp-test.invalid`
const { data: u, error: ue } = await admin.auth.admin.createUser({
  email,
  password: 'TestPassw0rd!',
  email_confirm: true,
  user_metadata: { first_name: 'Maria', last_name: 'Musterfrau' },
})
if (ue) throw ue
const userId = u.user.id
const now = new Date().toISOString()
await admin
  .from('profiles')
  .update({
    phone: '+4915100000000',
    consent_datenschutz_at: now,
    consent_agb_at: now,
    consent_data_processing_at: now,
    consent_authority_to_act_at: now,
  })
  .eq('id', userId)
const { data: c } = await admin.from('cases').select('id').eq('user_id', userId).single()
const caseId = c.id
console.log(`[gallery] ${subPhase} · base=${BASE} · case=${caseId}`)

const browser = await chromium.launch()
const shots = []
try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      extraHTTPHeaders,
    })
    const page = await ctx.newPage()
    const shot = async (name) => {
      const file = join(OUT, `${name}-${vp.tag}.png`)
      await page.screenshot({ path: file, fullPage: false })
      shots.push(file)
      console.log(`   ${file}`)
    }

    // 1. login (logged out)
    await page.goto(`${BASE}/login`)
    await page.waitForLoadState('networkidle')
    await shot('01-login')

    // 2. signup
    await page.goto(`${BASE}/signup`)
    await page.waitForLoadState('networkidle')
    await shot('02-signup')

    // log in for the case screens
    await page.goto(`${BASE}/login`)
    await page.locator('[name=email]').fill(email)
    await page.locator('[name=password]').fill('TestPassw0rd!')
    await page.getByRole('button', { name: 'Anmelden' }).click()
    await page.waitForURL(`${BASE}/case`, { timeout: 20_000 })
    await page.waitForLoadState('networkidle')

    // 3. pre-step: care-home selector (only before it is confirmed)
    const selector = page.locator('#care_home_id')
    if (await selector.isVisible({ timeout: 1500 }).catch(() => false)) {
      await shot('03-pre-carehome')
      await selector.selectOption({ index: 1 })
      await page.getByRole('button', { name: 'Pflegeheim bestätigen' }).click()
      await page.waitForTimeout(2500)
    }
    // 4. pre-step: PLZ
    const plz = page.locator('#plz_input')
    if (await plz.isVisible({ timeout: 1500 }).catch(() => false)) {
      await shot('04-pre-plz')
      await plz.fill('13187')
      await page.getByRole('button', { name: 'Postleitzahl bestätigen' }).click()
      await page.waitForTimeout(3500)
    }

    // 5. questionnaire (Fragen tab), fresh
    await page.goto(`${BASE}/case`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)
    await shot('05-fragen-fresh')

    // 6. questionnaire with history — answer three questions with synthetic data
    const answerText = async (value) => {
      const footer = page.locator('[data-testid=answer-footer]').last()
      const input = footer.locator('input[type=text]').first()
      if (await input.isVisible({ timeout: 1200 }).catch(() => false)) {
        await input.fill(value)
        await page.getByRole('button', { name: 'Weiter', exact: true }).click()
        await page.waitForTimeout(1600)
        return true
      }
      return false
    }
    await answerText('Maria')
    await answerText('Musterfrau')
    await answerText('Musterfrau')
    await shot('06-fragen-history')

    // 7. documents tab
    await page.getByRole('tab', { name: 'Dokumente' }).click()
    await page.waitForTimeout(1000)
    await shot('07-dokumente')

    await ctx.close()
  }
} finally {
  await browser.close()
  const { error } = await admin.auth.admin.deleteUser(userId)
  console.log(error ? `[gallery] CLEANUP FAILED: ${error.message}` : `[gallery] deleted ${email}`)
}
console.log(`\n[gallery] ${shots.length} screenshots written to ${OUT}`)
