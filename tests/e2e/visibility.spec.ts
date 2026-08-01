/**
 * Visibility verification, live against the production questionnaire.
 *
 *  V1 (pass 4 / D15 — replaces the retired hat_rente/rentenbetrag pair this
 *     spec was originally built on): the Berlin pension group is COUNT-DRIVEN.
 *     Answering pension_count = "2" must render exactly TWO detail-group
 *     instances (proven by two pension_type answers on distinct instances in
 *     the DB) with NO add-another prompt for the group. Ground truth asserts:
 *     pension_count is required with a NULL visibility rule, pension_amount's
 *     old in_values gate is NULL, the retired pair carries active = false,
 *     and the drive saved ZERO hat_rente answers (a retired question is
 *     never asked).
 *     The count question is detected STRUCTURALLY (a select whose option
 *     values start "0","1","2",…), not by its German prompt — no copy
 *     coupling.
 *
 *  V2. spouse_wohngeld_amount and spouse_wohngeld_id appear when
 *      spouse_wohngeld_yes_no = "Ja"
 *      (rules had self-references; fixed by 20260628000002 migration.)
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

/**
 * Waits until the ANSWER FOOTER has no disabled control — the specific state
 * every drive step needs before its next interaction (a pending save
 * disables exactly the footer's buttons). Replaces waitForIdle, which
 * counted button[disabled] across the WHOLE document: a global condition no
 * assertion depended on — the same primitive family as the removed
 * networkidle (53fdf73). Flagged in pass-3 backlog item 4; replaced in
 * pass 4 after the stall recurrences during the Batch-1 spot-checks.
 */
async function waitForFooterSettled(page: Page, timeout = 15_000) {
  await expect(page.locator('[data-testid=answer-footer] button[disabled]')).toHaveCount(0, {
    timeout,
  })
}

async function clickWeiter(page: Page) {
  await page.waitForTimeout(150)
  const weiter = page.getByRole('button', { name: 'Weiter' })
  await weiter.waitFor({ state: 'visible', timeout: 8_000 })
  await weiter.click()
  await page.waitForTimeout(200)
  await waitForFooterSettled(page)
}

/** Returns all visible text in the current footer question area. */
async function getFooterText(page: Page): Promise<string> {
  const footer = page.locator('[data-testid=answer-footer]').last()
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

test('V1: pension_count=2 renders exactly two pension instances (D15)  |  V2: spouse_wohngeld fields appear after yes_no=Ja', async ({
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
  // Deterministic: the questionnaire is ready when its answer area renders.
  await expect(page.locator('[data-testid=answer-footer]')).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(1_500)

  // ── Adaptive loop with targeted overrides ───────────────────────────────────
  // Strategy for V1 and V2: answer the special questions with "Ja" and let the
  // loop continue to completion. At the end, check the DB to confirm that
  // rentenbetrag and the wohngeld pair were actually saved (proof they appeared).
  let v1CountSetTo2 = false
  let v1PensionTypeSelects = 0
  let v1PensionPromptSeen = false
  let v2WohngeldYesNoAnsweredJa = false
  let stuckCount = 0

  for (let step = 1; step <= 220 && stuckCount < 5; step++) {
    // Terminal states — testid anchors since pass 4 (D1 made the two states'
    // German distinct; the old text matchers were copy-coupled and the locked
    // one never matched any live copy at all).
    const done = await page
      .locator('[data-testid=all-answered]')
      .isVisible({ timeout: 300 })
      .catch(() => false)
    const locked = await page
      .locator('[data-testid=locked-banner]')
      .isVisible({ timeout: 300 })
      .catch(() => false)
    if (done || locked) {
      console.log(`[step ${step}] reached terminal state (done=${done} locked=${locked})`)
      break
    }

    const footer = page.locator('[data-testid=answer-footer]').last()

    // Group prompt (classic groups only — V1 asserts the count-driven pension
    // group NEVER prompts; seeing its prompt is a D15 regression).
    const neinWeiter = page.getByRole('button', { name: 'Nein, weiter' })
    if (await neinWeiter.isVisible({ timeout: 300 }).catch(() => false)) {
      const footerText = await getFooterText(page)
      if (footerText.includes('Möchten Sie weitere Renten hinzufügen?')) {
        v1PensionPromptSeen = true
      }
      await neinWeiter.click()
      await page.waitForTimeout(200)
      await waitForFooterSettled(page)
      stuckCount = 0
      console.log(`[step ${step}] group_prompt → Nein, weiter`)
      continue
    }

    // yes_no (generic: Berlin has none since the pass-4 retirement)
    const jaRadio = footer.locator('input[type=radio][value="Ja"]')
    const neinRadio = footer.locator('input[type=radio][value="Nein"]')
    if (await neinRadio.isVisible({ timeout: 300 }).catch(() => false)) {
      const footerText = await getFooterText(page)
      const isWohngeldYesNo =
        footerText.toLowerCase().includes('wohngeld') && !v2WohngeldYesNoAnsweredJa
      if (isWohngeldYesNo) {
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

    // single_select — targeted picks, detected STRUCTURALLY where possible:
    //  - the count question by its numeric option values (V1 → "2")
    //  - marital_status by its "verheiratet" option (opens spouse for V2)
    //  - pension_type by its "Altersrente" option (counts V1 instances)
    const sel = footer.locator('select')
    if (await sel.isVisible({ timeout: 300 }).catch(() => false)) {
      const options = await sel.evaluate((s: HTMLSelectElement) =>
        Array.from(s.options)
          .filter((o) => o.value !== '')
          .map((o) => ({ value: o.value, label: o.text.trim() }))
      )
      const values = options.map((o) => o.value)
      const isCountSelect = values.length >= 3 && values[0] === '0' && values[1] === '1'
      // Applicant pension_type only: the spouse variant still carries the
      // "Keine Rente" option (D15 removed it from the applicant group alone).
      const isPensionType = values.includes('Altersrente') && !values.includes('Keine Rente')
      const verheiratet = options.find((o) => o.label === 'verheiratet')
      const ledig = options.find((o) => o.label === 'ledig' || o.label === 'Ledig')
      let chosen: string
      if (isCountSelect && !v1CountSetTo2) {
        chosen = '2'
        v1CountSetTo2 = true
        console.log(`[step ${step}] pension_count → "2"`)
      } else if (verheiratet) {
        chosen = verheiratet.value
        console.log(`[step ${step}] marital_status → "verheiratet"`)
      } else if (ledig) {
        chosen = ledig.value
      } else {
        chosen = options[0]?.value ?? ''
      }
      if (isPensionType) {
        v1PensionTypeSelects++
        console.log(`[step ${step}] pension_type select #${v1PensionTypeSelects}`)
        if (v1PensionTypeSelects === 2) {
          await page.screenshot({ path: 'test-results/v1-second-instance.png' })
        }
      }
      if (chosen) await sel.selectOption({ value: chosen })
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
        await waitForFooterSettled(page)
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

  // ── DB assertions: ground truth for D15 + the V2 rules ──────────────────────
  const [
    { data: countQ },
    { data: amountQ },
    { data: retiredPair },
    { data: wohngeldAmountQ },
    { data: wohngeldIdQ },
  ] = await Promise.all([
    adminDb
      .from('question')
      .select('id, is_required, visibility_rule')
      .eq('key', 'pension_count')
      .single(),
    adminDb.from('question').select('visibility_rule').eq('key', 'pension_amount').single(),
    adminDb.from('question').select('key, active').in('key', ['hat_rente', 'rentenbetrag']),
    adminDb.from('question').select('visibility_rule').eq('key', 'spouse_wohngeld_amount').single(),
    adminDb.from('question').select('visibility_rule').eq('key', 'spouse_wohngeld_id').single(),
  ])

  const [{ data: pensionTypeQRow }, { data: hatRenteQRow }] = await Promise.all([
    adminDb.from('question').select('id').eq('key', 'pension_type').eq('active', true).single(),
    adminDb.from('question').select('id').eq('key', 'hat_rente').single(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: countAnswer } = await (adminDb as any)
    .from('answer')
    .select('value')
    .eq('case_id', caseId)
    .eq('question_id', countQ!.id)
    .maybeSingle()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: typeAnswers } = await (adminDb as any)
    .from('answer')
    .select('group_instance')
    .eq('case_id', caseId)
    .eq('question_id', pensionTypeQRow!.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: hatRenteAnswers } = await (adminDb as any)
    .from('answer')
    .select('id', { count: 'exact', head: true })
    .eq('case_id', caseId)
    .eq('question_id', hatRenteQRow!.id)

  const distinctInstances = new Set(
    (typeAnswers ?? []).map((a: { group_instance: string }) => a.group_instance)
  )

  console.log('\n══════════ VISIBILITY RESULTS ══════════')
  console.log(`V1 pension_count set to 2:     ${v1CountSetTo2}`)
  console.log(`V1 pension_type selects seen:  ${v1PensionTypeSelects}`)
  console.log(`V1 distinct instances in DB:   ${distinctInstances.size}`)
  console.log(`V1 pension prompt seen:        ${v1PensionPromptSeen} (must be false)`)
  console.log(`V1 hat_rente answers saved:    ${hatRenteAnswers} (must be 0 — retired)`)
  console.log(`V2 spouse_wohngeld yes/no=Ja:  ${v2WohngeldYesNoAnsweredJa}`)
  console.log('══════════════════════════════════════════\n')

  // Ground truth: the count question is required and unconditional; the old
  // in_values gate on pension_amount is gone; the pair is retired.
  expect(countQ?.is_required, 'pension_count must be required').toBe(true)
  expect(countQ?.visibility_rule, 'pension_count must be unconditional').toBeNull()
  expect(amountQ?.visibility_rule, 'pension_amount in_values gate must be NULL (D15)').toBeNull()
  expect(retiredPair?.every((q) => q.active === false)).toBe(true)

  // The drive: count set to 2 → exactly two instances rendered and answered,
  // never an add-another prompt for the pension group.
  expect(v1CountSetTo2, 'the count select must have been found and set to 2').toBe(true)
  expect(v1PensionTypeSelects, 'exactly two pension_type instances must render').toBe(2)
  expect(distinctInstances.size, 'exactly two pension instances must be saved in DB').toBe(2)
  expect(countAnswer?.value, 'pension_count answer must be saved as "2"').toBe('2')
  expect(v1PensionPromptSeen, 'the count-driven group must never show its prompt').toBe(false)
  expect(hatRenteAnswers ?? 0, 'a retired question must never be asked or saved').toBe(0)

  // V2 (unchanged): wohngeld rules point at spouse_wohngeld_yes_no, and the
  // dependents were answered (proves they appeared after Ja).
  expect(
    wohngeldAmountQ?.visibility_rule?.question_key,
    'spouse_wohngeld_amount must reference spouse_wohngeld_yes_no'
  ).toBe('spouse_wohngeld_yes_no')
  expect(
    wohngeldIdQ?.visibility_rule?.question_key,
    'spouse_wohngeld_id must reference spouse_wohngeld_yes_no'
  ).toBe('spouse_wohngeld_yes_no')

  const [{ data: wohngeldAmountQRow }, { data: wohngeldIdQRow }] = await Promise.all([
    adminDb.from('question').select('id').eq('key', 'spouse_wohngeld_amount').single(),
    adminDb.from('question').select('id').eq('key', 'spouse_wohngeld_id').single(),
  ])
  const [{ count: wohngeldAmountAnswerCount }, { count: wohngeldIdAnswerCount }] =
    await Promise.all([
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
  expect(
    (wohngeldAmountAnswerCount ?? 0) > 0,
    'spouse_wohngeld_amount answer must exist in DB (proves it was visible after yes_no=Ja)'
  ).toBe(true)
  expect(
    (wohngeldIdAnswerCount ?? 0) > 0,
    'spouse_wohngeld_id answer must exist in DB (proves it was visible after yes_no=Ja)'
  ).toBe(true)

  // Cleanup happens in afterEach (survives failures).
})
