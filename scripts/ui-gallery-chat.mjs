/**
 * E-3 chat-state gallery — the four states the Fragen screen actually has,
 * which the general gallery script does not reach.
 *
 *   node scripts/ui-gallery-chat.mjs <sub-phase> [--base <url>]
 *
 * States captured, each at 1280x800 and 375x812:
 *   fresh         no answers yet — first question, empty history
 *   history       a handful answered — the bubble exchange
 *   locked        every required question answered; the case has flipped to
 *                 under_review and the edit lock is showing
 *   all-answered  the completion card WITHOUT the lock
 *
 * ⚠ How `all-answered` is reached, stated plainly because it is not a state a
 * user lingers in. Completing the last required question flips cases.status
 * to under_review and the server re-render swaps the completion card for the
 * locked card (the C1-vs-C4 race documented in completion.spec), so it must
 * be captured IN-SESSION, immediately after the drive reports done.
 *
 * Two approaches were tried and REJECTED, both verified as failing here:
 *   - reloading the completed case, and
 *   - rewinding cases.status to in_progress and reloading.
 * Neither works, for the same reason: "Nein, weiter" replies to
 * repeatable-group prompts are SESSION state, not stored answers, so any
 * fresh load re-asks them and the group-prompt card claims the footer before
 * the completion card can. If the lock re-render wins the race on a given
 * run, this script logs that and captures nothing rather than substituting
 * some other screen.
 *
 * ⚠ PRIVACY — the repo is PUBLIC. Throwaway account, obviously synthetic
 * answers, deleted in `finally`. A real pilot case is never photographed.
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
  console.error('Usage: node scripts/ui-gallery-chat.mjs <sub-phase> [--base <url>]')
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

const email = `pw-chatgallery+${Date.now()}@hzp-test.invalid`
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

/** Both viewports for one state. Resizing re-lays out the same live page. */
async function shoot(page, name) {
  for (const [tag, vp] of [
    ['desktop', DESKTOP],
    ['mobile', MOBILE],
  ]) {
    await page.setViewportSize(vp)
    await page.waitForTimeout(400)
    await page.screenshot({ path: join(OUT, `${name}-${tag}.png`) })
    console.log(`   ${name}-${tag}.png`)
  }
  await page.setViewportSize(DESKTOP)
}

async function idle(page) {
  await page.waitForFunction(() => document.querySelectorAll('button[disabled]').length === 0, {
    timeout: 20_000,
  })
}

/** Answer whatever control the footer is currently showing. */
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
    await idle(page)
    return 'ok'
  }

  const weiter = page.getByRole('button', { name: 'Weiter' })
  const radio = footer.locator('input[type=radio][value="Nein"]')
  if (await radio.isVisible({ timeout: 300 }).catch(() => false)) {
    await radio.click()
  } else {
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
          await idle(page)
          return 'ok'
        }
      } else {
        const prompt = await footer
          .locator('label')
          .first()
          .textContent()
          .catch(() => '?')
        console.log(`   [drive] stuck on: ${String(prompt).slice(0, 70)}`)
        return 'stuck'
      }
    }
  }
  // Same settle rhythm completion.spec uses: React re-renders between the
  // control change and the button becoming enabled.
  await page.waitForTimeout(150)
  await weiter.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
  if (!(await weiter.isVisible().catch(() => false))) {
    console.log('   [drive] stuck: no Weiter button')
    return 'stuck'
  }
  await weiter.click()
  await page.waitForTimeout(200)
  await idle(page)
  return 'ok'
}

try {
  const ctx = await browser.newContext({ viewport: DESKTOP, extraHTTPHeaders })
  const page = await ctx.newPage()

  await gotoWhenReady(page, `${BASE}/login`, '[name=email]')
  await page.locator('[name=email]').fill(email)
  await page.locator('[name=password]').fill('TestPassw0rd!')
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await page.waitForURL(`${BASE}/case`, { timeout: 20_000 })

  await page.locator('#care_home_id').selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Pflegeheim bestätigen' }).click()
  await page.locator('#plz_input').waitFor({ state: 'visible', timeout: 20_000 })
  await page.locator('#plz_input').fill('13187')
  await page.getByRole('button', { name: 'Postleitzahl bestätigen' }).click()
  await page.locator('[data-testid=answer-footer]').waitFor({ state: 'visible', timeout: 30_000 })

  await shoot(page, '01-chat-fresh')

  for (let i = 0; i < 6; i++) if ((await answerOne(page)) !== 'ok') break
  await shoot(page, '02-chat-history')

  let state = 'ok'
  for (let i = 0; i < 200 && state === 'ok'; i++) state = await answerOne(page)
  console.log(`   [drive] ended in state: ${state}`)

  // all-answered must be shot IN-SESSION, right here. It cannot be reached by
  // reloading a completed case: the "Nein, weiter" replies to repeatable-group
  // prompts are session state, not answers, so a fresh load re-asks them and
  // the group-prompt card takes the footer instead. (Rewinding cases.status
  // was tried and fails for exactly that reason.) If the server re-render has
  // already swapped in the lock, the completion card was never observable on
  // this run - say so rather than fake it.
  if (
    await page
      .getByTestId('all-answered')
      .isVisible()
      .catch(() => false)
  ) {
    await shoot(page, '04-chat-all-answered')
  } else {
    console.log('   [drive] all-answered not observable — lock re-render won the race')
  }

  await page.reload()
  await page.locator('[data-testid=locked-banner]').waitFor({ state: 'visible', timeout: 30_000 })
  await shoot(page, '03-chat-locked')

  // The documents checklist as it appears while the case is locked.
  await page.getByTestId('tab-documents').click()
  await page.locator('[data-testid=document-area]').waitFor({ state: 'visible', timeout: 30_000 })
  await shoot(page, '05-docs-locked')

  await ctx.close()
} finally {
  await browser.close()
  const { error } = await admin.auth.admin.deleteUser(userId)
  console.log(error ? `CLEANUP FAILED: ${error.message}` : `[chat-gallery] deleted ${email}`)
}
console.log(`\n[chat-gallery] written to ${OUT}`)
