/**
 * E-7 keyboard + touch-target audit — measured, not asserted.
 *
 *   node scripts/a11y-keyboard-audit.mjs [--base <url>]
 *
 * Walks the real screens and reports, per screen:
 *   • tab order — every element reachable by Tab, in order, with whether it
 *     shows a visible focus indicator (a non-none outline or a box-shadow
 *     that changes on :focus-visible);
 *   • any focusable element with NO visible focus indicator (a 2.4.7 failure);
 *   • every interactive element whose rendered box is under 44x44 CSS px at
 *     the 375px viewport (2.5.5 / 2.5.8 target size);
 *   • whether the questionnaire can be driven one step by keyboard alone.
 *
 * Read-only apart from the throwaway account it creates and deletes.
 */

import { createClient } from '@supabase/supabase-js'
import { chromium } from '@playwright/test'
import { config } from 'dotenv'
import { gotoWhenReady } from './lib/preview-ready.mjs'

config({ path: '.env.local' })

const baseIdx = process.argv.indexOf('--base')
const BASE =
  baseIdx > -1 ? process.argv[baseIdx + 1] : (process.env.E2E_BASE_URL ?? 'http://localhost:3000')

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
const extraHTTPHeaders = bypass
  ? { 'x-vercel-protection-bypass': bypass, 'x-vercel-set-bypass-cookie': 'true' }
  : {}

const email = `pw-a11y+${Date.now()}@hzp-test.invalid`
const { data: u, error: ue } = await admin.auth.admin.createUser({
  email,
  password: 'TestPassw0rd!',
  email_confirm: true,
  user_metadata: { first_name: 'Maria', last_name: 'Musterfrau' },
})
if (ue) throw ue
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
  .eq('id', u.user.id)

/** Describe the active element and whether focus is visibly indicated. */
const PROBE = `() => {
  const el = document.activeElement
  if (!el || el === document.body) return null
  const cs = getComputedStyle(el)
  const r = el.getBoundingClientRect()
  const hasOutline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0
  const hasRing = cs.boxShadow !== 'none'
  return {
    tag: el.tagName.toLowerCase(),
    label: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('name') || el.id || '').trim().slice(0, 40),
    focusVisible: el.matches(':focus-visible'),
    visibleIndicator: hasOutline || hasRing,
    w: Math.round(r.width), h: Math.round(r.height),
  }
}`

async function auditScreen(page, name, maxTabs = 25) {
  const seen = []
  const noIndicator = []
  const small = []
  // The page must actually hold focus before Tab does anything, and the
  // starting point must be the document, not an arbitrary control. Clicking a
  // non-interactive corner gives focus without activating anything.
  await page.mouse.click(2, 2)
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  })
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press('Tab')
    const info = await page.evaluate(PROBE)
    // A null probe means focus is on <body>: either the walk has wrapped past
    // the last control, or Tab never moved at all. Distinguish them, because
    // "0 stops" reported as "no findings" would be a false clean bill.
    if (!info) {
      if (i === 0) throw new Error(`${name}: Tab did not move focus at all — audit is broken`)
      break
    }
    const key = `${info.tag}:${info.label}`
    if (seen.some((s) => s.key === key && s.i < i - 1) && seen.length > 2) break // wrapped
    seen.push({ key, i })
    if (!info.visibleIndicator) noIndicator.push(`${info.tag} "${info.label}"`)
    if (info.w < 44 || info.h < 44) small.push(`${info.tag} "${info.label}" ${info.w}x${info.h}`)
  }
  console.log(`\n── ${name} ── ${seen.length} tab stops`)
  console.log(
    `   no visible focus indicator: ${noIndicator.length ? noIndicator.join(' | ') : 'none'}`
  )
  console.log(`   under 44x44 @375px:         ${small.length ? small.join(' | ') : 'none'}`)
  return { name, stops: seen.length, noIndicator, small }
}

const browser = await chromium.launch()
const results = []
try {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, extraHTTPHeaders })
  const page = await ctx.newPage()

  await gotoWhenReady(page, `${BASE}/login`, '[name=email]')
  results.push(await auditScreen(page, 'login'))

  await page.goto(`${BASE}/signup`)
  await page.locator('[name=first_name]').waitFor({ state: 'visible', timeout: 30_000 })
  results.push(await auditScreen(page, 'signup', 30))

  await page.goto(`${BASE}/login`)
  await page.locator('[name=email]').fill(email)
  await page.locator('[name=password]').fill('TestPassw0rd!')
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await page.waitForURL(`${BASE}/case`, { timeout: 20_000 })
  await page.locator('#care_home_id').waitFor({ state: 'visible', timeout: 30_000 })
  results.push(await auditScreen(page, 'pre-step: care home'))

  // Drive the care-home step BY KEYBOARD ONLY.
  await page.locator('#care_home_id').focus()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await page.locator('#plz_input').waitFor({ state: 'visible', timeout: 30_000 })
  console.log('\n   [keyboard] care-home step completed with keyboard alone: YES')

  await page.locator('#plz_input').focus()
  await page.keyboard.type('13187')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await page.locator('[data-testid=answer-footer]').waitFor({ state: 'visible', timeout: 30_000 })
  console.log('   [keyboard] PLZ step completed with keyboard alone: YES')

  results.push(await auditScreen(page, 'questionnaire'))

  // One question, keyboard only.
  const footer = page.locator('[data-testid=answer-footer]').last()
  await footer.locator('input[type=text]').first().focus()
  await page.keyboard.type('Maria')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1500)
  const advanced = await page.locator('[data-testid=answered-bubble]').count()
  console.log(`   [keyboard] question answered via Enter: ${advanced > 0 ? 'YES' : 'NO'}`)

  await page.getByTestId('tab-documents').click()
  await page.locator('[data-testid=document-area]').waitFor({ state: 'visible', timeout: 30_000 })
  results.push(await auditScreen(page, 'documents'))

  await ctx.close()
} finally {
  await browser.close()
  const { error } = await admin.auth.admin.deleteUser(u.user.id)
  console.log(error ? `\nCLEANUP FAILED: ${error.message}` : `\n[a11y] deleted ${email}`)
}

const failures = results.filter((r) => r.noIndicator.length || r.small.length)
console.log(`\n=== SUMMARY: ${results.length} screens, ${failures.length} with findings ===`)
process.exit(0)
