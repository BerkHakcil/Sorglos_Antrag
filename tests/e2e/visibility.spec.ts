/**
 * Step B verification — visibility rule fixes.
 *
 * Verifies two fixes live against the production questionnaire:
 *
 *  V1. rentenbetrag appears when hat_rente = "Ja"
 *      (the visibility rule had {"value": true} — a JS boolean — which never
 *      matched the stored string "Ja". Fixed by 20260701000001 migration.)
 *
 *  V2. spouse_wohngeld_amount and spouse_wohngeld_id appear when
 *      spouse_wohngeld_yes_no = "Ja"
 *      (rules had self-references; fixed by 20260628000002 migration.)
 *
 * Also performs DB assertions on all three visibility rules as ground truth.
 */

import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const BASE = process.env.E2E_BASE_URL ?? 'https://sorglos-antrag.vercel.app'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local')
}

const adminDb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function waitForIdle(page: Page, timeout = 15_000) {
  await page.waitForFunction(
    () => document.querySelectorAll<HTMLButtonElement>('button[disabled]').length === 0,
    { timeout }
  )
}

async function clickWeiter(page: Page) {
  await page.waitForTimeout(150)
  const weiter = page.getByRole('button', { name: 'Weiter' })
  await weiter.waitFor({ state: 'visible', timeout: 8_000 })
  await weiter.click()
  await page.waitForTimeout(200)
  await waitForIdle(page)
}

/** Returns all visible text in the current footer question area. */
async function getFooterText(page: Page): Promise<string> {
  const footer = page.locator('.shrink-0.border-t').last()
  return (await footer.textContent({ timeout: 500 }).catch(() => '')) ?? ''
}

// ── Test ───────────────────────────────────────────────────────────────────────

test.setTimeout(360_000)

// Cleanup must survive a mid-test failure (assertion or timeout in the adaptive
// loop) — an inline delete at the end of the body leaks the user on any failure,
// which is how the pw-vis leftovers of 2026-07-01 happened. afterEach runs
// regardless of test outcome.
let cleanupUserId: string | null = null
test.afterEach(async () => {
  if (cleanupUserId) {
    await adminDb.auth.admin
      .deleteUser(cleanupUserId)
      .catch((e) => console.error('[cleanup] deleteUser FAILED - user may be leaked:', e?.message))
    console.log(`[cleanup] deleted test user ${cleanupUserId}`)
    cleanupUserId = null
  }
})

test('V1: rentenbetrag appears after hat_rente=Ja  |  V2: spouse_wohngeld fields appear after yes_no=Ja', async ({
  page,
}) => {
  // ── Create fresh test user ──────────────────────────────────────────────────
  const email = `pw-vis+${Date.now()}@hzp-test.invalid`
  const password = 'TestPassw0rd!'

  const { data: userData, error: userErr } = await adminDb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: 'Playwright', last_name: 'Visibility' },
  })
  if (userErr) throw new Error(`Failed to create test user: ${userErr.message}`)
  const userId = userData!.user.id
  cleanupUserId = userId

  const now = new Date().toISOString()
  await adminDb
    .from('profiles')
    .update({
      phone: '+4915100000002',
      consent_datenschutz_at: now,
      consent_agb_at: now,
      consent_data_processing_at: now,
      consent_authority_to_act_at: now,
    })
    .eq('id', userId)

  const { data: caseData } = await adminDb.from('cases').select('id').eq('user_id', userId).single()
  const caseId = caseData!.id
  console.log(`[setup] user=${userId} case=${caseId}`)

  // ── Login ───────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/login`)
  await page.locator('[name=email]').fill(email)
  await page.locator('[name=password]').fill(password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await page.waitForURL(`${BASE}/case`, { timeout: 20_000 })

  // ── Setup: care home + PLZ ──────────────────────────────────────────────────
  await page.locator('#care_home_id').selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Pflegeheim bestätigen' }).click()
  await page.waitForTimeout(2_000)
  await page.locator('#plz_input').fill('10115')
  await page.getByRole('button', { name: 'Postleitzahl bestätigen' }).click()
  await page.waitForTimeout(3_000)
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1_500)

  // ── Adaptive loop with targeted overrides ───────────────────────────────────
  // Strategy for V1 and V2: answer the special questions with "Ja" and let the
  // loop continue to completion. At the end, check the DB to confirm that
  // rentenbetrag and the wohngeld pair were actually saved (proof they appeared).
  let v1HatRenteAnsweredJa = false
  let v2WohngeldYesNoAnsweredJa = false
  let stuckCount = 0

  for (let step = 1; step <= 220 && stuckCount < 5; step++) {
    // Terminal states
    const done = await page
      .getByText('Sie haben alle Fragen beantwortet', { exact: false })
      .isVisible({ timeout: 300 })
      .catch(() => false)
    const locked = await page
      .getByText('Angaben werden geprüft', { exact: false })
      .isVisible({ timeout: 300 })
      .catch(() => false)
    if (done || locked) {
      console.log(`[step ${step}] reached terminal state (done=${done} locked=${locked})`)
      break
    }

    const footer = page.locator('.shrink-0.border-t').last()

    // Group prompt
    const neinWeiter = page.getByRole('button', { name: 'Nein, weiter' })
    if (await neinWeiter.isVisible({ timeout: 300 }).catch(() => false)) {
      await neinWeiter.click()
      await page.waitForTimeout(200)
      await waitForIdle(page)
      stuckCount = 0
      console.log(`[step ${step}] group_prompt → Nein, weiter`)
      continue
    }

    // yes_no
    const jaRadio = footer.locator('input[type=radio][value="Ja"]')
    const neinRadio = footer.locator('input[type=radio][value="Nein"]')
    if (await neinRadio.isVisible({ timeout: 300 }).catch(() => false)) {
      const footerText = await getFooterText(page)

      // V1: Detect hat_rente by pension-specific text
      const isHatRente = footerText.toLowerCase().includes('rente') && !v1HatRenteAnsweredJa
      // V2: Detect spouse_wohngeld_yes_no by wohngeld text
      const isWohngeldYesNo =
        footerText.toLowerCase().includes('wohngeld') && !v2WohngeldYesNoAnsweredJa

      if (isHatRente) {
        console.log(`[step ${step}] hat_rente → Ja ("${footerText.substring(0, 80).trim()}")`)
        await jaRadio.click()
        await clickWeiter(page)
        v1HatRenteAnsweredJa = true
        await page.screenshot({ path: 'test-results/v1-after-hat-rente-ja.png' })
      } else if (isWohngeldYesNo) {
        console.log(`[step ${step}] spouse_wohngeld_yes_no → Ja`)
        await jaRadio.click()
        await clickWeiter(page)
        v2WohngeldYesNoAnsweredJa = true
        await page.screenshot({ path: 'test-results/v2-after-wohngeld-yes-no-ja.png' })
      } else {
        await neinRadio.click()
        await clickWeiter(page)
      }
      stuckCount = 0
      continue
    }

    // single_select — pick "verheiratet" if available (opens spouse section for V2)
    const sel = footer.locator('select')
    if (await sel.isVisible({ timeout: 300 }).catch(() => false)) {
      const options = await sel.evaluate((s: HTMLSelectElement) =>
        Array.from(s.options)
          .filter((o) => o.value !== '')
          .map((o) => ({ value: o.value, label: o.text.trim() }))
      )
      const verheiratet = options.find((o) => o.label === 'verheiratet')
      const ledig = options.find((o) => o.label === 'ledig' || o.label === 'Ledig')
      const chosen = verheiratet
        ? verheiratet.value
        : ledig
          ? ledig.value
          : (options[0]?.value ?? '')
      if (chosen) await sel.selectOption({ value: chosen })
      if (verheiratet) console.log(`[step ${step}] marital_status → "verheiratet"`)
      await clickWeiter(page)
      stuckCount = 0
      continue
    }

    // date
    const dateIn = footer.locator('input[type=date]')
    if (await dateIn.isVisible({ timeout: 300 }).catch(() => false)) {
      await dateIn.fill('1960-06-15')
      await clickWeiter(page)
      stuckCount = 0
      continue
    }

    // number / amount
    const numIn = footer.locator('input[type=number]')
    if (await numIn.isVisible({ timeout: 300 }).catch(() => false)) {
      await numIn.fill('100')
      await clickWeiter(page)
      stuckCount = 0
      continue
    }

    // short_text
    const textIn = footer.locator('input[type=text]').first()
    if (await textIn.isVisible({ timeout: 300 }).catch(() => false)) {
      await textIn.fill('Müller')
      await clickWeiter(page)
      stuckCount = 0
      continue
    }

    // multi_select — skip if button available, else check first box and continue
    const chk = footer.locator('input[type=checkbox]').first()
    if (await chk.isVisible({ timeout: 300 }).catch(() => false)) {
      const skip = page.getByRole('button', { name: 'Weiß ich gerade nicht' })
      if (await skip.isVisible({ timeout: 300 }).catch(() => false)) {
        await skip.click()
        await waitForIdle(page)
      } else {
        // Required multi_select with no skip — check first option and proceed
        await chk.click()
        await clickWeiter(page)
      }
      stuckCount = 0
      console.log(`[step ${step}] multi_select handled`)
      continue
    }

    stuckCount++
    console.log(`[step ${step}] STUCK (count=${stuckCount})`)
    await page.screenshot({ path: `test-results/vis-stuck-${step}.png` })
    await page.waitForTimeout(2_000)
  }

  await page.screenshot({ path: 'test-results/v-final.png', fullPage: true })

  // ── DB assertions: rules (ground truth) ─────────────────────────────────────
  const [{ data: rentenbetragQ }, { data: wohngeldAmountQ }, { data: wohngeldIdQ }] =
    await Promise.all([
      adminDb.from('question').select('visibility_rule').eq('key', 'rentenbetrag').single(),
      adminDb
        .from('question')
        .select('visibility_rule')
        .eq('key', 'spouse_wohngeld_amount')
        .single(),
      adminDb.from('question').select('visibility_rule').eq('key', 'spouse_wohngeld_id').single(),
    ])

  // ── DB assertions: answers saved for this case ───────────────────────────────
  // If rentenbetrag was visible (rule fixed) the loop would have answered it.
  // Same for spouse_wohngeld_amount and spouse_wohngeld_id.
  const [{ data: rentenbetragQRow }, { data: wohngeldAmountQRow }, { data: wohngeldIdQRow }] =
    await Promise.all([
      adminDb.from('question').select('id').eq('key', 'rentenbetrag').single(),
      adminDb.from('question').select('id').eq('key', 'spouse_wohngeld_amount').single(),
      adminDb.from('question').select('id').eq('key', 'spouse_wohngeld_id').single(),
    ])

  const [
    { count: rentenbetragAnswerCount },
    { count: wohngeldAmountAnswerCount },
    { count: wohngeldIdAnswerCount },
  ] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminDb as any)
      .from('answer')
      .select('id', { count: 'exact', head: true })
      .eq('case_id', caseId)
      .eq('question_id', rentenbetragQRow!.id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminDb as any)
      .from('answer')
      .select('id', { count: 'exact', head: true })
      .eq('case_id', caseId)
      .eq('question_id', wohngeldAmountQRow!.id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminDb as any)
      .from('answer')
      .select('id', { count: 'exact', head: true })
      .eq('case_id', caseId)
      .eq('question_id', wohngeldIdQRow!.id),
  ])

  const v1RentenbetragAnswered = (rentenbetragAnswerCount ?? 0) > 0
  const v2WohngeldAmountAnswered = (wohngeldAmountAnswerCount ?? 0) > 0
  const v2WohngeldIdAnswered = (wohngeldIdAnswerCount ?? 0) > 0

  console.log('\n══════════ STEP B VISIBILITY RESULTS ══════════')
  console.log(`V1 rentenbetrag DB rule:       ${JSON.stringify(rentenbetragQ?.visibility_rule)}`)
  console.log(`V1 hat_rente=Ja answered:      ${v1HatRenteAnsweredJa}`)
  console.log(
    `V1 rentenbetrag saved in DB:   ${v1RentenbetragAnswered} (count=${rentenbetragAnswerCount})`
  )
  console.log(`V2 wohngeld_amount DB rule:    ${JSON.stringify(wohngeldAmountQ?.visibility_rule)}`)
  console.log(`V2 wohngeld_id DB rule:        ${JSON.stringify(wohngeldIdQ?.visibility_rule)}`)
  console.log(`V2 spouse_wohngeld yes/no=Ja:  ${v2WohngeldYesNoAnsweredJa}`)
  console.log(
    `V2 wohngeld_amount saved in DB:${v2WohngeldAmountAnswered} (count=${wohngeldAmountAnswerCount})`
  )
  console.log(
    `V2 wohngeld_id saved in DB:    ${v2WohngeldIdAnswered} (count=${wohngeldIdAnswerCount})`
  )
  console.log('════════════════════════════════════════════════\n')

  // DB: rentenbetrag visibility rule value must be the STRING "Ja" (not boolean true)
  expect(
    rentenbetragQ?.visibility_rule?.value,
    'rentenbetrag visibility_rule.value must be string "Ja" not boolean true'
  ).toBe('Ja')

  // DB: wohngeld rules must point to spouse_wohngeld_yes_no (not self-reference)
  expect(
    wohngeldAmountQ?.visibility_rule?.question_key,
    'spouse_wohngeld_amount must reference spouse_wohngeld_yes_no'
  ).toBe('spouse_wohngeld_yes_no')
  expect(
    wohngeldIdQ?.visibility_rule?.question_key,
    'spouse_wohngeld_id must reference spouse_wohngeld_yes_no'
  ).toBe('spouse_wohngeld_yes_no')

  // UI flow: hat_rente must have been reached and answered Ja (logged at step detection)
  expect(v1HatRenteAnsweredJa, 'hat_rente question must have been found and answered Ja').toBe(true)
  // Note: spouse_wohngeld_yes_no detection is best-effort (footer text may be transitioning);
  // the authoritative proof is the DB answer count below.

  // Answer saved in DB proves the question was visible to the loop and rendered
  expect(
    v1RentenbetragAnswered,
    'rentenbetrag answer must exist in DB (proves it was visible after hat_rente=Ja)'
  ).toBe(true)
  expect(
    v2WohngeldAmountAnswered,
    'spouse_wohngeld_amount answer must exist in DB (proves it was visible after yes_no=Ja)'
  ).toBe(true)
  expect(
    v2WohngeldIdAnswered,
    'spouse_wohngeld_id answer must exist in DB (proves it was visible after yes_no=Ja)'
  ).toBe(true)

  // Cleanup happens in afterEach (survives failures).
})
