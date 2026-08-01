/**
 * Live verification for the transitive-visibility + stale-answer fix
 * (commit "fix(engine): transitive visibility + clear stale answers on hide"
 *  + migration 20260703000001). Runs against production.
 *
 *  T1 (BUG A + migration, married): drive a "verheiratet" user, answering the
 *      spouse "Sonderstatus" and spouse life-insurance selects with a non-"Nein"
 *      option. Assert the three previously-broken dependents received answers —
 *      proving they now appear (were permanently hidden under value:"Ja"):
 *        spouse_special_origin_rights_issued / _issued_by / spouse_life_insurance_amount
 *
 *  T2 (BUG A, single): drive a "ledig" user to completion. Assert the same three
 *      spouse questions have NO answers and the case still reached under_review —
 *      i.e. they stayed hidden and did not count toward the required total.
 *
 *  T3 (BUG B, Haftpflicht toggle): seed an in-progress case with
 *      general_liablity_insurance_yes_no="Ja" + provider + amount, then edit the
 *      trigger to "Nein" in the UI. Assert the provider + amount answers are
 *      deleted from the DB (not merely hidden).
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

// ── Shared helpers ───────────────────────────────────────────────────────────

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
  // Deterministic: the questionnaire is ready when its answer area renders.
  await expect(page.locator('[data-testid=answer-footer]')).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(1_500)
}

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

async function footerText(page: Page): Promise<string> {
  const footer = page.locator('[data-testid=answer-footer]').last()
  return (await footer.textContent({ timeout: 500 }).catch(() => '')) ?? ''
}

async function answerCountByKey(caseId: string, key: string): Promise<number> {
  const { data: q } = await adminDb.from('question').select('id').eq('key', key).single()
  if (!q) return -1
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (adminDb as any)
    .from('answer')
    .select('id', { count: 'exact', head: true })
    .eq('case_id', caseId)
    .eq('question_id', q.id)
  return res.count ?? 0
}

/**
 * Adaptive questionnaire driver. `maritalChoice` picks the Familienstand value;
 * `reveal` selects a non-"Nein" option for the Sonderstatus + life-insurance
 * selects so their dependents surface. Everything else is answered minimally.
 */
async function driveQuestionnaire(page: Page, opts: { maritalChoice: string; reveal: boolean }) {
  let stuck = 0
  for (let step = 1; step <= 260 && stuck < 5; step++) {
    // Testid anchors since pass 4 (D1 made the two terminal states' German
    // distinct — the old text matchers were copy-coupled).
    const done = await page
      .locator('[data-testid=all-answered]')
      .isVisible({ timeout: 300 })
      .catch(() => false)
    const locked = await page
      .locator('[data-testid=locked-banner]')
      .isVisible({ timeout: 300 })
      .catch(() => false)
    if (done || locked) return

    const footer = page.locator('[data-testid=answer-footer]').last()

    const neinWeiter = page.getByRole('button', { name: 'Nein, weiter' })
    if (await neinWeiter.isVisible({ timeout: 300 }).catch(() => false)) {
      await neinWeiter.click()
      await page.waitForTimeout(150)
      await waitForFooterSettled(page)
      stuck = 0
      continue
    }

    // yes_no → always "Nein" to keep the path short
    const neinRadio = footer.locator('input[type=radio][value="Nein"]')
    if (await neinRadio.isVisible({ timeout: 300 }).catch(() => false)) {
      await neinRadio.click()
      await clickWeiter(page)
      stuck = 0
      continue
    }

    // single_select
    const sel = footer.locator('select')
    if (await sel.isVisible({ timeout: 300 }).catch(() => false)) {
      const text = (await footerText(page)).toLowerCase()
      const options = await sel.evaluate((s: HTMLSelectElement) =>
        Array.from(s.options)
          .filter((o) => o.value !== '')
          .map((o) => ({ value: o.value, label: o.text.trim() }))
      )
      // ⚠ COPY-COUPLED BY DESIGN (accepted trade-off): the branches below
      // recognise specific questions from their German prompt text, because
      // the DOM carries no question key. Reword a prompt and the matching
      // heuristic silently stops firing — for the reveal branch that means
      // the drive answers "Nein", the dependents never appear, and T1 fails
      // with "must have been shown+answered / Received: 0" rather than with
      // an obvious selector error. Exactly that happened when CP3 renamed the
      // Sonderstatus question to "Vertriebenen- oder Spätaussiedlerausweis":
      // the old match term ('sonderstatus') is a key name that appears in no
      // user-facing string.
      let chosen: string
      if (text.includes('familienstand')) {
        chosen = options.find((o) => o.label === opts.maritalChoice)?.value ?? options[0].value
      } else if (
        opts.reveal &&
        (text.includes('vertriebenen') ||
          text.includes('spätaussiedler') ||
          (text.includes('lebens') && text.includes('sterbe')))
      ) {
        chosen = options.find((o) => o.label !== 'Nein')?.value ?? options[0].value
      } else {
        chosen = options.find((o) => o.label === 'Nein')?.value ?? options[0].value
      }
      await sel.selectOption({ value: chosen })
      await clickWeiter(page)
      stuck = 0
      continue
    }

    const dateIn = footer.locator('input[type=date]')
    if (await dateIn.isVisible({ timeout: 300 }).catch(() => false)) {
      await dateIn.fill('1960-06-15')
      await clickWeiter(page)
      stuck = 0
      continue
    }
    const numIn = footer.locator('input[type=number]')
    if (await numIn.isVisible({ timeout: 300 }).catch(() => false)) {
      await numIn.fill('100')
      await clickWeiter(page)
      stuck = 0
      continue
    }
    const textIn = footer.locator('input[type=text]').first()
    if (await textIn.isVisible({ timeout: 300 }).catch(() => false)) {
      await textIn.fill('Müller')
      await clickWeiter(page)
      stuck = 0
      continue
    }
    const chk = footer.locator('input[type=checkbox]').first()
    if (await chk.isVisible({ timeout: 300 }).catch(() => false)) {
      const skip = page.getByRole('button', { name: 'Weiß ich gerade nicht' })
      if (await skip.isVisible({ timeout: 300 }).catch(() => false)) {
        await skip.click()
        await waitForFooterSettled(page)
      } else {
        await chk.click()
        await clickWeiter(page)
      }
      stuck = 0
      continue
    }
    stuck++
    await page.waitForTimeout(1_500)
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.setTimeout(420_000)

test('T1 married: spouse Sonderstatus + life-insurance dependents now appear', async ({ page }) => {
  const { userId, email, caseId } = await createUser('vis-married')
  try {
    await login(page, email)
    await setupCareHomeAndPlz(page)
    await driveQuestionnaire(page, { maritalChoice: 'verheiratet', reveal: true })

    const issued = await answerCountByKey(caseId, 'spouse_special_origin_rights_issued')
    const issuedBy = await answerCountByKey(caseId, 'spouse_special_origin_rights_issued_by')
    const lifeAmt = await answerCountByKey(caseId, 'spouse_life_insurance_amount')
    console.log(
      `T1 answered counts → issued=${issued} issued_by=${issuedBy} life_amount=${lifeAmt}`
    )

    expect(
      issued,
      'spouse_special_origin_rights_issued must have been shown+answered'
    ).toBeGreaterThan(0)
    expect(
      issuedBy,
      'spouse_special_origin_rights_issued_by must have been shown+answered'
    ).toBeGreaterThan(0)
    expect(lifeAmt, 'spouse_life_insurance_amount must have been shown+answered').toBeGreaterThan(0)
  } finally {
    await adminDb.auth.admin.deleteUser(userId)
  }
})

test('T2 single: the three spouse dependents stay hidden and do not block completion', async ({
  page,
}) => {
  const { userId, email, caseId } = await createUser('vis-single')
  try {
    await login(page, email)
    await setupCareHomeAndPlz(page)
    await driveQuestionnaire(page, { maritalChoice: 'ledig', reveal: false })

    const issued = await answerCountByKey(caseId, 'spouse_special_origin_rights_issued')
    const issuedBy = await answerCountByKey(caseId, 'spouse_special_origin_rights_issued_by')
    const lifeAmt = await answerCountByKey(caseId, 'spouse_life_insurance_amount')
    const { data: c } = await adminDb.from('cases').select('status').eq('id', caseId).single()
    console.log(
      `T2 counts → issued=${issued} issued_by=${issuedBy} life_amount=${lifeAmt} status=${c?.status}`
    )

    expect(issued, 'spouse_special_origin_rights_issued must stay hidden for ledig').toBe(0)
    expect(issuedBy, 'spouse_special_origin_rights_issued_by must stay hidden for ledig').toBe(0)
    expect(lifeAmt, 'spouse_life_insurance_amount must stay hidden for ledig').toBe(0)
    expect(c?.status, 'case still completes without the hidden spouse questions').toBe(
      'under_review'
    )
  } finally {
    await adminDb.auth.admin.deleteUser(userId)
  }
})

test('T3 Haftpflicht toggle Ja→Nein deletes the dependent answers (BUG B)', async ({ page }) => {
  const { userId, email, caseId } = await createUser('vis-stale')
  try {
    // Assign the Berlin questionnaire + a care home directly, then seed the chain.
    const { data: qRow } = await adminDb
      .from('question')
      .select('id, category:category_id(questionnaire_id)')
      .eq('key', 'general_liablity_insurance_yes_no')
      .single()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const questionnaireId = (qRow as any).category.questionnaire_id
    const { data: home } = await adminDb
      .from('care_home')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()
    await adminDb
      .from('cases')
      .update({
        care_home_id: home!.id,
        questionnaire_id: questionnaireId,
        plz_before_move: '10115',
        plz_resolution_status: 'resolved',
      })
      .eq('id', caseId)

    const { data: qs } = await adminDb
      .from('question')
      .select('id, key')
      .in('key', [
        'general_liablity_insurance_yes_no',
        'general_liablity_insurance_provider',
        'general_liability_amount',
      ])
    const idByKey = Object.fromEntries((qs ?? []).map((q) => [q.key, q.id]))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminDb as any).from('answer').insert([
      {
        case_id: caseId,
        question_id: idByKey['general_liablity_insurance_yes_no'],
        group_instance: 'default',
        value: 'Ja',
      },
      {
        case_id: caseId,
        question_id: idByKey['general_liablity_insurance_provider'],
        group_instance: 'default',
        value: 'AXA Test',
      },
      {
        case_id: caseId,
        question_id: idByKey['general_liability_amount'],
        group_instance: 'default',
        value: 50,
      },
    ])

    await login(page, email)
    await page.waitForTimeout(1_000)

    // Edit the trigger bubble in history: Ja → Nein
    const triggerPrompt = 'Haben Sie eine Haftpflichtversicherung?'
    // Anchored on the testid, not on layout classes: this wrapper used to be
    // matched as `div.space-y-1`, which E-3's flex layout silently invalidated.
    const group = page.locator('[data-testid=answered-bubble]', {
      has: page.getByText(triggerPrompt, { exact: true }),
    })
    await group.getByRole('button', { name: 'Bearbeiten' }).click()
    await page.waitForTimeout(300)
    const footer = page.locator('[data-testid=answer-footer]').last()
    await footer.locator('select').selectOption({ value: 'Nein' })
    await footer.getByRole('button', { name: 'Änderung speichern' }).click()
    await page.waitForTimeout(1_500)
    await waitForFooterSettled(page)
    await page.waitForTimeout(1_000)

    const providerCount = await answerCountByKey(caseId, 'general_liablity_insurance_provider')
    const amountCount = await answerCountByKey(caseId, 'general_liability_amount')
    const { data: trig } = await adminDb
      .from('answer')
      .select('value')
      .eq('case_id', caseId)
      .eq('question_id', idByKey['general_liablity_insurance_yes_no'])
      .single()
    console.log(
      `T3 after toggle → trigger=${JSON.stringify(trig?.value)} provider=${providerCount} amount=${amountCount}`
    )

    expect(trig?.value, 'trigger now Nein').toBe('Nein')
    expect(providerCount, 'provider answer must be deleted (BUG B)').toBe(0)
    expect(amountCount, 'amount answer must be deleted (BUG B)').toBe(0)
  } finally {
    await adminDb.auth.admin.deleteUser(userId)
  }
})
