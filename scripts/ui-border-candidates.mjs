/**
 * E-2 input: renders the SAME screens under each candidate form-control border
 * colour, so the choice is made on real screens rather than swatches.
 *
 *   node scripts/ui-border-candidates.mjs [--base <url>]
 *
 * Candidates for the CONTROL border (measured against white / cream):
 *   #e6e0d0  1.32 / 1.20  — the mockup's value; FAILS WCAG 1.4.11 (needs ≥3:1)
 *   #8c8272  3.78 / 3.44  — lightest value that passes; first choice per the
 *                           tiebreak rule ("closest to the mockup's softness
 *                           that still passes in situ"). SHIPPED in E-2.
 *   #5c6166  6.26 / 5.70  — graphite-soft; safe fallback
 *
 * ⚠ UPDATED FOR E-2. This script previously set --border AND --input to the
 * same value, because our components bound control borders to `border-border`
 * and the two jobs shared one token. E-2 SPLIT them: controls now bind to
 * `border-input`, and `--border` is decorative only. So only --input varies
 * below, with --border pinned at the mockup's #e6e0d0 — which is what each
 * shot must show, since the decision being made is about control edges alone
 * and the dividers are meant to stay soft in every candidate.
 *
 * Same privacy rule as the gallery: throwaway account, synthetic data only.
 */

import { createClient } from '@supabase/supabase-js'
import { chromium } from '@playwright/test'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { config } from 'dotenv'

config({ path: '.env.local' })

const baseIdx = process.argv.indexOf('--base')
const BASE =
  baseIdx > -1 ? process.argv[baseIdx + 1] : (process.env.E2E_BASE_URL ?? 'http://localhost:3000')
const OUT = join('docs', 'feedback', 'ui-gallery', 'E-2-border-candidates')
mkdirSync(OUT, { recursive: true })

const CANDIDATES = [
  { tag: 'a-mockup-e6e0d0', value: '#e6e0d0', note: '1.32:1 vs white — FAILS 3:1' },
  { tag: 'b-8c8272', value: '#8c8272', note: '3.78:1 vs white — passes, first choice' },
  { tag: 'c-graphite-soft-5c6166', value: '#5c6166', note: '6.26:1 vs white — safe fallback' },
]

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
const extraHTTPHeaders = bypass
  ? { 'x-vercel-protection-bypass': bypass, 'x-vercel-set-bypass-cookie': 'true' }
  : {}

const email = `pw-border+${Date.now()}@hzp-test.invalid`
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

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, extraHTTPHeaders })
  const page = await ctx.newPage()

  // log in + reach the questionnaire (an input-bearing screen)
  await page.goto(`${BASE}/login`)
  await page.locator('[name=email]').fill(email)
  await page.locator('[name=password]').fill('TestPassw0rd!')
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await page.waitForURL(`${BASE}/case`, { timeout: 20_000 })
  await page.locator('#care_home_id').selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Pflegeheim bestätigen' }).click()
  await page.waitForTimeout(2500)
  await page.locator('#plz_input').fill('13187')
  await page.getByRole('button', { name: 'Postleitzahl bestätigen' }).click()
  await page.waitForTimeout(3500)

  // Only the CONTROL token varies; the decorative one is pinned so every shot
  // shows the split as shipped.
  const apply = (value) =>
    page.evaluate((v) => {
      document.documentElement.style.setProperty('--border', '#e6e0d0')
      document.documentElement.style.setProperty('--input', v)
    }, value)

  for (const c of CANDIDATES) {
    // questionnaire (single input + card + divider lines)
    await page.goto(`${BASE}/case`)
    // Deterministic: the questionnaire is ready when its answer area renders.
    await page.locator('[data-testid=answer-footer]').waitFor({ state: 'visible', timeout: 30_000 })
    await apply(c.value)
    await page.screenshot({ path: join(OUT, `fragen-${c.tag}.png`) })
    console.log(`   fragen-${c.tag}.png   (${c.note})`)

    // signup (form-dense: many inputs + checkboxes)
    await page.goto(`${BASE}/signup`)
    // Deterministic: the signup form is ready when its first field renders.
    await page.locator('[name=first_name]').waitFor({ state: 'visible', timeout: 30_000 })
    await apply(c.value)
    await page.screenshot({ path: join(OUT, `signup-${c.tag}.png`) })
    console.log(`   signup-${c.tag}.png   (${c.note})`)
  }
  await ctx.close()
} finally {
  await browser.close()
  const { error } = await admin.auth.admin.deleteUser(userId)
  console.log(error ? `CLEANUP FAILED: ${error.message}` : `[border] deleted ${email}`)
}
console.log(`\n[border] candidates written to ${OUT}`)
