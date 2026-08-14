/**
 * E-7 keyboard + touch-target audit — measured, not asserted.
 *
 *   node scripts/a11y-keyboard-audit.mjs [--base <url>]
 *
 * Walks the real screens at the 375px viewport and reports, per screen:
 *   • tab order — every element reachable by Tab, in order;
 *   • any focusable element with NO visible focus indicator while focused
 *     (no outline and no box-shadow — a 2.4.7 failure);
 *   • every tab stop whose rendered box is under 44x44 CSS px
 *     (2.5.5/2.5.8 target size; width gets a pass for full-row text inputs);
 *   • whether the pre-steps and one questionnaire answer can be driven by
 *     keyboard alone, and the terminal locked state after a full drive.
 *
 * ⚠ HISTORY, so nobody re-learns it: the first version passed its probe to
 * page.evaluate as a STRING. Playwright evaluates a string as an expression,
 * and an arrow-function expression evaluates to an unserializable function
 * object → undefined. So the probe NEVER RAN, every screen reported
 * "0 tab stops", and the failure was misattributed to "Tab not moving focus
 * in headless" — which a direct test disproved: headless Chromium moves
 * focus on Tab exactly as expected. The probe is a real function now.
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
function probe() {
  const el = document.activeElement
  if (!el || el === document.body || el.tagName === 'HTML') return null
  const cs = getComputedStyle(el)
  // The measured TARGET is what a finger can hit. For a checkbox/radio inside
  // a <label>, the label is the click target, so its box is the honest
  // measurement — a bare 16x16 tick with a full-width label row is not a
  // 44px failure.
  const targetEl =
    (el.type === 'checkbox' || el.type === 'radio') && el.closest('label')
      ? el.closest('label')
      : el
  const r = targetEl.getBoundingClientRect()
  const hasOutline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0
  // The ring may sit on a child (the popover trigger paints its ring on the
  // inner circle via group-focus-visible) or on a composite parent (the phone
  // wrapper rings on focus-within for its nested input). Both are visible
  // indications; credit them.
  const ringOn = (node) => node && getComputedStyle(node).boxShadow !== 'none'
  const hasRing =
    ringOn(el) ||
    ringOn(el.firstElementChild) ||
    ringOn(el.parentElement?.closest('.ring-2, [class*="focus-within"]'))
  // Links inside running text fall under WCAG 2.5.8's inline exception.
  const isInline = el.tagName === 'A' && !!el.closest('label, p')
  const label = (
    el.getAttribute('aria-label') ||
    el.textContent ||
    el.getAttribute('name') ||
    el.id ||
    el.getAttribute('type') ||
    ''
  )
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 45)
  return {
    tag: el.tagName.toLowerCase(),
    type: el.getAttribute('type') || '',
    label,
    // Position qualifies identity: eleven "Datei hochladen" buttons share a
    // label, and a label-only key made the wrap detector fire on the second
    // one, silently truncating the documents walk to one stop.
    top: Math.round(el.getBoundingClientRect().top + window.scrollY),
    visibleIndicator: hasOutline || hasRing,
    inline: isInline,
    w: Math.round(r.width),
    h: Math.round(r.height),
  }
}

async function auditScreen(page, name, maxTabs = 40) {
  const stops = []
  const noIndicator = []
  const small = []
  // Start the walk from the document, not from an arbitrary control.
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  })
  let firstKey = null
  const inlineExempt = []
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press('Tab')
    let info = await page.evaluate(probe)
    if (!info && i === 0) {
      // Right after a save the page re-renders (router.refresh) and a Tab can
      // land on an element that unmounts under it. One settled retry
      // distinguishes that transient from a genuinely unreachable screen.
      await page.waitForTimeout(1000)
      await page.keyboard.press('Tab')
      info = await page.evaluate(probe)
    }
    if (!info) {
      // focus left the page's controls: wrapped (fine) or never entered (broken)
      if (i === 0)
        throw new Error(
          `${name}: Tab did not reach any control — investigate, do not report as clean`
        )
      break
    }
    const key = `${info.tag}[${info.type}]@${info.top} ${info.label}`
    if (firstKey === null) firstKey = key
    else if (key === firstKey) break // cycled back to the first stop
    stops.push(key)
    if (!info.visibleIndicator) noIndicator.push(`${key}`)
    // Width leniency for full-row text controls; height is the strict axis.
    if (info.h < 44 && !(info.tag === 'input' && info.w >= 200)) {
      if (info.inline) inlineExempt.push(`${key} → ${info.w}x${info.h}`)
      else small.push(`${key} → ${info.w}x${info.h}`)
    }
  }
  console.log(`\n── ${name} — ${stops.length} tab stops ──`)
  stops.forEach((s, i) => console.log(`   ${String(i + 1).padStart(2)} ${s}`))
  if (inlineExempt.length)
    console.log(
      `   ○ inline links, 2.5.8 exception (not failures):\n      ${inlineExempt.join('\n      ')}`
    )
  console.log(
    `   ✖ no visible focus: ${noIndicator.length ? '\n      ' + noIndicator.join('\n      ') : 'none'}`
  )
  console.log(
    `   ✖ under 44px high:  ${small.length ? '\n      ' + small.join('\n      ') : 'none'}`
  )
  return { name, stops: stops.length, noIndicator, small }
}

/** Answer whatever the footer shows — same driver as ui-gallery-chat. */
async function answerOne(page) {
  const footer = page.locator('[data-testid=answer-footer]').last()
  if (
    await page
      .getByTestId('all-answered')
      .isVisible({ timeout: 300 })
      .catch(() => false)
  )
    return 'done'
  if (
    await page
      .getByTestId('locked-banner')
      .isVisible({ timeout: 300 })
      .catch(() => false)
  )
    return 'locked'
  const nein = page.getByRole('button', { name: 'Nein, weiter' })
  if (await nein.isVisible({ timeout: 300 }).catch(() => false)) {
    await nein.click()
    await page.waitForTimeout(400)
    return 'ok'
  }
  const weiter = page.getByTestId('save-answer')
  const radio = footer.locator('input[type=radio][value="Nein"]')
  if (await radio.isVisible({ timeout: 300 }).catch(() => false)) await radio.click()
  else {
    const sel = footer.locator('select')
    if (await sel.isVisible({ timeout: 300 }).catch(() => false)) {
      const opts = await sel.evaluate((s) =>
        Array.from(s.options)
          .filter((o) => o.value !== '')
          .map((o) => ({ v: o.value, t: o.text.trim() }))
      )
      const pick = opts.find((o) => o.t === 'Nein') ?? opts.find((o) => o.t === 'ledig') ?? opts[0]
      if (pick) await sel.selectOption({ value: pick.v })
    } else {
      const date = footer.locator('input[type=date]')
      const num = footer.locator('input[type=number]')
      const text = footer.locator('input[type=text]').first()
      const check = footer.locator('input[type=checkbox]').first()
      if (await date.isVisible({ timeout: 300 }).catch(() => false)) await date.fill('1948-03-12')
      else if (await num.isVisible({ timeout: 300 }).catch(() => false)) await num.fill('100')
      else if (await text.isVisible({ timeout: 300 }).catch(() => false))
        await text.fill('Musterfrau')
      else if (await check.isVisible({ timeout: 300 }).catch(() => false)) {
        const skip = page.getByRole('button', { name: 'Weiß ich gerade nicht' })
        if (await skip.isVisible({ timeout: 300 }).catch(() => false)) {
          await skip.click()
          await page.waitForTimeout(400)
          return 'ok'
        }
      } else return 'stuck'
    }
  }
  await page.waitForTimeout(150)
  if (!(await weiter.isVisible({ timeout: 8000 }).catch(() => false))) return 'stuck'
  await weiter.click()
  await page.waitForTimeout(300)
  await page
    .waitForFunction(() => document.querySelectorAll('button[disabled]').length === 0, {
      timeout: 20_000,
    })
    .catch(() => {})
  return 'ok'
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
  results.push(await auditScreen(page, 'signup', 45))

  await page.goto(`${BASE}/login`)
  await page.locator('[name=email]').fill(email)
  await page.locator('[name=password]').fill('TestPassw0rd!')
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await page.waitForURL(`${BASE}/case`, { timeout: 20_000 })
  await page.locator('#care_home_id').waitFor({ state: 'visible', timeout: 30_000 })
  results.push(await auditScreen(page, 'pre-step: care home'))

  // Pre-steps BY KEYBOARD ONLY (direct drive — proves input works, not order).
  await page.locator('#care_home_id').focus()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await page.locator('#plz_input').waitFor({ state: 'visible', timeout: 30_000 })
  console.log('\n   [keyboard-only] care-home step: COMPLETED')
  results.push(await auditScreen(page, 'pre-step: PLZ'))

  await page.locator('#plz_input').focus()
  await page.keyboard.type('13187')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await page.locator('[data-testid=answer-footer]').waitFor({ state: 'visible', timeout: 30_000 })
  console.log('   [keyboard-only] PLZ step: COMPLETED')

  results.push(await auditScreen(page, 'questionnaire (fresh)'))

  const footer = page.locator('[data-testid=answer-footer]').last()
  await footer.locator('input[type=text]').first().focus()
  await page.keyboard.type('Maria')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1500)
  const advanced = await page.locator('[data-testid=answered-bubble]').count()
  console.log(`   [keyboard-only] answer via Enter: ${advanced > 0 ? 'COMPLETED' : 'FAILED'}`)

  results.push(await auditScreen(page, 'questionnaire (with history)'))

  await page.getByTestId('tab-documents').click()
  await page.locator('[data-testid=document-area]').waitFor({ state: 'visible', timeout: 30_000 })
  results.push(await auditScreen(page, 'documents'))

  // Drive to completion for the terminal states.
  await page.getByTestId('tab-questions').click()
  let state = 'ok'
  for (let i = 0; i < 200 && state === 'ok'; i++) state = await answerOne(page)
  console.log(`\n   [drive] questionnaire ended in state: ${state}`)
  if (state === 'done' || state === 'locked') {
    await page.reload()
    await page.locator('[data-testid=locked-banner]').waitFor({ state: 'visible', timeout: 30_000 })
    results.push(await auditScreen(page, 'completion / locked'))
  } else {
    console.log('   ⚠ completion state NOT audited — drive got stuck')
  }

  await ctx.close()
} finally {
  await browser.close()
  const { error } = await admin.auth.admin.deleteUser(u.user.id)
  console.log(error ? `\nCLEANUP FAILED: ${error.message}` : `\n[a11y] deleted ${email}`)
}

const failing = results.filter((r) => r.noIndicator.length || r.small.length)
console.log(`\n=== SUMMARY: ${results.length} screens audited, ${failing.length} with findings ===`)
for (const f of failing) {
  console.log(`  ${f.name}: ${f.noIndicator.length} focus, ${f.small.length} size`)
}
