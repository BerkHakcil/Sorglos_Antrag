/**
 * Go-live round 2, item 6 — unbefristet gate for the Schwerbehindertenausweis
 * expiry (migration 20260813000003). Runs against production AFTER the
 * migration is pushed (content-based readiness: the spec aborts loudly if the
 * gate question is absent from the DB).
 *
 *  G1: disability_card "Ja" surfaces the GATE question next (prompt compared
 *      against the DB row — German is DB-authored, never hardcoded here).
 *  G2: gate "Ja" (unbefristet) → the expiry question is SKIPPED — the flow
 *      moves straight to the Merkzeichen question and the DB holds no expiry
 *      row.
 *  G3: editing the gate to "Nein" surfaces the expiry as required; a date
 *      saves normally.
 *  G4 (sweep leg): editing the gate back to "Ja" hides the expiry — the
 *      stale-answer sweep must DELETE the expiry row (BUG-B semantics).
 *
 * One throwaway Berlin user, deleted in afterEach (survives failures).
 */

import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const BASE = process.env.E2E_BASE_URL ?? 'https://sorglos-antrag.vercel.app'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Missing Supabase env in .env.local')

const adminDb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PASSWORD = 'TestPassw0rd!'
const BERLIN_GATE_ID = '60000000-0000-0000-0000-000000000101'
const BERLIN_EXPIRY_ID = '60000000-0000-0000-0000-000000000019'

let cleanupUserId: string | null = null

test.afterEach(async () => {
  if (cleanupUserId) {
    await adminDb.auth.admin
      .deleteUser(cleanupUserId)
      .catch((e) => console.error('[cleanup] deleteUser FAILED - user may be leaked:', e?.message))
    cleanupUserId = null
  }
})

async function createUser(tag: string): Promise<{ userId: string; email: string; caseId: string }> {
  const email = `pw-${tag}+${Date.now()}@hzp-test.invalid`
  const { data, error } = await adminDb.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { first_name: 'Playwright', last_name: tag },
  })
  if (error) throw new Error(`createUser: ${error.message}`)
  const userId = data!.user.id
  const now = new Date().toISOString()
  await adminDb
    .from('profiles')
    .update({
      phone: '+4915100000009',
      consent_datenschutz_at: now,
      consent_agb_at: now,
      consent_data_processing_at: now,
      consent_authority_to_act_at: now,
    })
    .eq('id', userId)
  const { data: c } = await adminDb.from('cases').select('id').eq('user_id', userId).single()
  return { userId, email, caseId: c!.id }
}

async function login(page: Page, email: string) {
  await page.goto(`${BASE}/login`)
  await page.locator('[name=email]').fill(email)
  await page.locator('[name=password]').fill(PASSWORD)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await page.waitForURL(`${BASE}/case`, { timeout: 20_000 })
}

async function setupCareHomeAndPlz(page: Page) {
  await page.locator('#care_home_id').selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Pflegeheim bestätigen' }).click()
  await page.waitForTimeout(2_000)
  await page.locator('#plz_input').fill('10115') // Berlin questionnaire
  await page.getByRole('button', { name: 'Postleitzahl bestätigen' }).click()
  await page.waitForTimeout(3_000)
  await page.reload()
  await expect(page.locator('[data-testid=answer-footer]')).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(1_500)
}

async function waitForFooterSettled(page: Page, timeout = 15_000) {
  await expect(page.locator('[data-testid=answer-footer] button[disabled]')).toHaveCount(0, {
    timeout,
  })
}

async function clickButton(page: Page, name: string) {
  await page.waitForTimeout(150)
  const btn = page.getByRole('button', { name })
  await btn.waitFor({ state: 'visible', timeout: 8_000 })
  await btn.click()
  await page.waitForTimeout(200)
  await waitForFooterSettled(page)
}

async function footerText(page: Page): Promise<string> {
  const footer = page.locator('[data-testid=answer-footer]').last()
  return (await footer.textContent({ timeout: 500 }).catch(() => '')) ?? ''
}

async function selectInFooter(page: Page, wantLabel: string) {
  const sel = page.locator('[data-testid=answer-footer]').last().locator('select')
  const options = await sel.evaluate((s: HTMLSelectElement) =>
    Array.from(s.options)
      .filter((o) => o.value !== '')
      .map((o) => ({ value: o.value, label: o.text.trim() }))
  )
  const chosen = options.find((o) => o.label === wantLabel)?.value
  if (!chosen) throw new Error(`option "${wantLabel}" not found in ${JSON.stringify(options)}`)
  await sel.selectOption({ value: chosen })
}

/** Answers everything minimally until the footer prompt contains `target`. */
async function driveTo(page: Page, target: string, maxSteps = 30) {
  for (let step = 1; step <= maxSteps; step++) {
    const text = (await footerText(page)).toLowerCase()
    if (text.includes(target)) return
    const footer = page.locator('[data-testid=answer-footer]').last()

    const sel = footer.locator('select')
    if (await sel.isVisible({ timeout: 300 }).catch(() => false)) {
      const options = await sel.evaluate((s: HTMLSelectElement) =>
        Array.from(s.options)
          .filter((o) => o.value !== '')
          .map((o) => ({ value: o.value, label: o.text.trim() }))
      )
      const chosen =
        options.find((o) => o.label === 'ledig')?.value ??
        options.find((o) => o.label === 'Nein')?.value ??
        options[0].value
      await sel.selectOption({ value: chosen })
      await clickButton(page, 'Weiter')
      continue
    }
    const neinRadio = footer.locator('input[type=radio][value="Nein"]')
    if (await neinRadio.isVisible({ timeout: 300 }).catch(() => false)) {
      await neinRadio.click()
      await clickButton(page, 'Weiter')
      continue
    }
    const dateIn = footer.locator('input[type=date]')
    if (await dateIn.isVisible({ timeout: 300 }).catch(() => false)) {
      await dateIn.fill('1960-06-15')
      await clickButton(page, 'Weiter')
      continue
    }
    const textIn = footer.locator('input[type=text]').first()
    if (await textIn.isVisible({ timeout: 300 }).catch(() => false)) {
      await textIn.fill('Müller')
      await clickButton(page, 'Weiter')
      continue
    }
    throw new Error(`driveTo(${target}): unhandled input at step ${step}: ${text}`)
  }
  throw new Error(`driveTo(${target}): not reached in ${maxSteps} steps`)
}

async function expiryAnswerCount(caseId: string): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (adminDb as any)
    .from('answer')
    .select('id', { count: 'exact', head: true })
    .eq('case_id', caseId)
    .eq('question_id', BERLIN_EXPIRY_ID)
  return res.count ?? 0
}

test.setTimeout(300_000)

test('G1-G4: gate shows on Ja, skips expiry on unbefristet, requires it on Nein, sweep clears on flip-back', async ({
  page,
}) => {
  // Content-based readiness: the gate question must exist (migration pushed).
  const { data: gateRow } = await adminDb
    .from('question')
    .select('id, key, prompt_de, is_required')
    .eq('id', BERLIN_GATE_ID)
    .maybeSingle()
  if (!gateRow) {
    throw new Error(
      'Gate question 60…0101 absent — migration 20260813000003 not applied yet; this spec gates on it.'
    )
  }
  expect(gateRow.key).toBe('disability_card_unlimited')
  expect(gateRow.is_required).toBe(true)
  const gatePrompt = gateRow.prompt_de as string

  const { userId, email, caseId } = await createUser('disgate')
  cleanupUserId = userId

  await login(page, email)
  await setupCareHomeAndPlz(page)

  // ── G1: card "Ja" → the gate question appears next ──────────────────────────
  await driveTo(page, 'schwerbehindertenausweis')
  await selectInFooter(page, 'Ja')
  await clickButton(page, 'Weiter')
  await expect(page.locator('[data-testid=answer-footer]').last()).toContainText(gatePrompt, {
    timeout: 10_000,
  })
  console.log('[G1] gate prompt shown after disability_card=Ja')

  // ── G2: gate "Ja" (unbefristet) → expiry skipped, Merkzeichen next ──────────
  await selectInFooter(page, 'Ja')
  await clickButton(page, 'Weiter')
  await expect(page.locator('[data-testid=answer-footer]').last()).toContainText('Merkzeichen', {
    timeout: 10_000,
  })
  expect(await expiryAnswerCount(caseId), 'no expiry row after unbefristet=Ja').toBe(0)
  console.log('[G2] expiry skipped, Merkzeichen reached, 0 expiry rows')

  // Answer the markers so the case sits past the block (checkbox multi-select).
  const chk = page
    .locator('[data-testid=answer-footer]')
    .last()
    .locator('input[type=checkbox]')
    .first()
  await chk.click()
  await clickButton(page, 'Weiter')

  // ── G3: edit the gate to "Nein" → expiry surfaces as required ───────────────
  const gateBubble = page
    .locator('[data-testid=answered-bubble]')
    .filter({ hasText: gatePrompt })
    .first()
  await gateBubble.scrollIntoViewIfNeeded()
  await gateBubble.getByRole('button', { name: 'Bearbeiten' }).click()
  await selectInFooter(page, 'Nein')
  await clickButton(page, 'Änderung speichern')
  // The expiry is now the earliest open required question — the flow returns
  // to it ("Bis wann ist Ihr Schwerbehindertenausweis gültig?").
  await expect(page.locator('[data-testid=answer-footer]').last()).toContainText(
    'Schwerbehindertenausweis gültig',
    { timeout: 10_000 }
  )
  const dateIn = page.locator('[data-testid=answer-footer]').last().locator('input[type=date]')
  await dateIn.fill('2031-03-01') // also exercises the item-5 widened expiry bound
  await clickButton(page, 'Weiter')
  await expect.poll(async () => expiryAnswerCount(caseId), { timeout: 10_000 }).toBe(1)
  console.log('[G3] gate=Nein → expiry required, 2031 date saved')

  // ── G4: edit the gate back to "Ja" → sweep deletes the expiry row ───────────
  const gateBubble2 = page
    .locator('[data-testid=answered-bubble]')
    .filter({ hasText: gatePrompt })
    .first()
  await gateBubble2.scrollIntoViewIfNeeded()
  await gateBubble2.getByRole('button', { name: 'Bearbeiten' }).click()
  await selectInFooter(page, 'Ja')
  await clickButton(page, 'Änderung speichern')
  await expect.poll(async () => expiryAnswerCount(caseId), { timeout: 10_000 }).toBe(0)
  console.log('[G4] gate flipped back to Ja → sweep deleted the expiry row')
})
