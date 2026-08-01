/**
 * Feedback-pass verification (items 1 + 2 + 3), driven live on prod.
 *
 *  L1/L2  Berlin ledig + verwitwet full drives: fresh denominator 53, case
 *         completes, and ZERO spouse/Partner questions were ever asked —
 *         asserted at the DB level: a completed case has answered every
 *         visible required question, so "no spouse-ish answer rows" proves
 *         "no spouse-ish question was shown".
 *  L3/L4  Essen ledig + verwitwet: same property (denominator 49 since
 *         pass 4 / D4 made birth_name optional). The
 *         maintenance/Unterhalt block is answered with its none-option (the
 *         ex_partner_* questions are BY DESIGN reachable for any status when a
 *         real maintenance option is chosen — CP3 decision, not a leak).
 *  T1     Tabs from first login (Pankow): Dokumente tab + badge visible before
 *         any answer; spouse slots appear LIVE mid-questionnaire when
 *         marital_status=verheiratet is saved (router.refresh recompute);
 *         upload works pre-completion; badge visible at 375px.
 *
 * The married regression (spouse section still works end to end) is
 * tests/e2e/documents-m6.spec.ts — unchanged, run alongside.
 */

import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { purgeCasePrefix } from './storage-cleanup'

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

const BERLIN = '30000000-0000-0000-0000-000000000001'
const ESSEN = '30000000-0000-0000-0000-000000000003'

let cleanupUserId: string | null = null
let cleanupCaseId: string | null = null
test.afterEach(async () => {
  if (cleanupCaseId) {
    // Recursive — Phase D nests uploads under a category folder.
    await purgeCasePrefix(adminDb, cleanupCaseId).catch((e) =>
      console.error('[cleanup] storage remove FAILED:', e?.message)
    )
    cleanupCaseId = null
  }
  if (cleanupUserId) {
    await adminDb.auth.admin
      .deleteUser(cleanupUserId)
      .catch((e) => console.error('[cleanup] deleteUser FAILED - user may be leaked:', e?.message))
    console.log(`[cleanup] deleted test user ${cleanupUserId}`)
    cleanupUserId = null
  }
})

// ── Shared helpers (m7-regression pattern) ────────────────────────────────────

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

async function questionsOf(questionnaireId: string) {
  const { data: cats } = await adminDb
    .from('category')
    .select('id')
    .eq('questionnaire_id', questionnaireId)
  const ids = (cats ?? []).map((c: { id: string }) => c.id)
  const { data: qs } = await adminDb
    .from('question')
    .select('id, key, prompt_de')
    .in('category_id', ids)
  return (qs ?? []) as { id: string; key: string; prompt_de: string }[]
}

function promptMapOf(qs: { key: string; prompt_de: string }[]) {
  return qs
    .map((q) => ({ prompt: q.prompt_de, key: q.key }))
    .sort((a, b) => b.prompt.length - a.prompt.length)
}

async function makeUserAndLogin(page: Page, tag: string) {
  const email = `pw-fb-${tag}+${Date.now()}@hzp-test.invalid`
  const password = 'TestPassw0rd!'
  const { data, error } = await adminDb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: 'Playwright', last_name: `FB${tag}` },
  })
  if (error) throw new Error(`createUser: ${error.message}`)
  cleanupUserId = data.user.id
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
    .eq('id', data.user.id)
  await page.goto(`${BASE}/login`)
  await page.locator('[name=email]').fill(email)
  await page.locator('[name=password]').fill(password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await page.waitForURL(`${BASE}/case`, { timeout: 20_000 })
  return data.user.id
}

async function setupCase(page: Page, plz: string) {
  await page.locator('#care_home_id').selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Pflegeheim bestätigen' }).click()
  await page.waitForTimeout(2_000)
  await page.locator('#plz_input').fill(plz)
  await page.getByRole('button', { name: 'Postleitzahl bestätigen' }).click()
  await page.waitForTimeout(3_000)
  await page.reload()
  // Deterministic: the questionnaire is ready when its answer area renders.
  await expect(page.locator('[data-testid=answer-footer]')).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(1_500)
}

/** One adaptive step; select answers can be overridden by question key. */
async function answerStep(
  page: Page,
  promptMap: { prompt: string; key: string }[],
  overrides: Record<string, string>
): Promise<'continue' | 'done' | 'stuck'> {
  const locked = await page
    .getByText('In Prüfung', { exact: false })
    .isVisible({ timeout: 200 })
    .catch(() => false)
  if (locked) return 'done'

  const footer = page.locator('[data-testid=answer-footer]').last()
  const footerText = (await footer.textContent({ timeout: 500 }).catch(() => '')) ?? ''

  const neinWeiter = page.getByRole('button', { name: 'Nein, weiter' })
  if (await neinWeiter.isVisible({ timeout: 250 }).catch(() => false)) {
    await neinWeiter.click()
    await page.waitForTimeout(200)
    await waitForIdle(page)
    return 'continue'
  }
  const neinRadio = footer.locator('input[type=radio][value="Nein"]')
  if (await neinRadio.isVisible({ timeout: 250 }).catch(() => false)) {
    await neinRadio.click()
    await clickWeiter(page)
    return 'continue'
  }
  const sel = footer.locator('select')
  if (await sel.isVisible({ timeout: 250 }).catch(() => false)) {
    const key = promptMap.find((p) => footerText.includes(p.prompt))?.key
    const options = await sel.evaluate((s: HTMLSelectElement) =>
      Array.from(s.options)
        .filter((o) => o.value !== '')
        .map((o) => o.value)
    )
    const wanted = key ? overrides[key] : undefined
    const chosen =
      wanted && options.includes(wanted)
        ? wanted
        : options.includes('Nein')
          ? 'Nein'
          : (options[0] ?? '')
    if (chosen) await sel.selectOption({ value: chosen })
    if (wanted) console.log(`  [override] ${key} → "${chosen}"`)
    await clickWeiter(page)
    return 'continue'
  }
  for (const [selector, fill] of [
    ['input[type=date]', '1960-06-15'],
    ['input[type=month]', '2020-05'],
    ['input[type=number]', '100'],
  ] as const) {
    const el = footer.locator(selector)
    if (await el.isVisible({ timeout: 250 }).catch(() => false)) {
      await el.fill(fill)
      await clickWeiter(page)
      return 'continue'
    }
  }
  const textarea = footer.locator('textarea')
  if (await textarea.isVisible({ timeout: 250 }).catch(() => false)) {
    await textarea.fill('Keine weiteren Angaben')
    await clickWeiter(page)
    return 'continue'
  }
  const textIn = footer.locator('input[type=text]').first()
  if (await textIn.isVisible({ timeout: 250 }).catch(() => false)) {
    const value = footerText.includes('IBAN')
      ? 'DE89370400440532013000'
      : footerText.includes('BIC')
        ? 'MARKDEF1100'
        : /PLZ|Postleitzahl/i.test(footerText)
          ? '10115'
          : footerText.toLowerCase().includes('e-mail')
            ? 'test@example.org'
            : 'Müller'
    await textIn.fill(value)
    await clickWeiter(page)
    return 'continue'
  }
  const chk = footer.locator('input[type=checkbox]').first()
  if (await chk.isVisible({ timeout: 250 }).catch(() => false)) {
    await chk.click()
    await clickWeiter(page)
    return 'continue'
  }
  return 'stuck'
}

/** Full drive to completion, then DB-assert zero spouse-ish answers. */
async function leakDrive(
  page: Page,
  tag: string,
  plz: string,
  questionnaireId: string,
  marital: string,
  denominator: number,
  allowedKeys: string[]
) {
  const qs = await questionsOf(questionnaireId)
  const promptMap = promptMapOf(qs)
  const overrides: Record<string, string> = { marital_status: marital }
  if (questionnaireId === ESSEN) {
    // Answer the maintenance select with its none-option so the BY-DESIGN
    // ex_partner block stays closed (its reachability is a CP3 decision, not
    // part of the leak class). None-option = the one NOT in the ex_partner
    // gate's in_values.
    const gate = await adminDb
      .from('question')
      .select('visibility_rule')
      .eq('key', 'ex_partner_first_name')
      .in(
        'category_id',
        (await adminDb.from('category').select('id').eq('questionnaire_id', ESSEN)).data!.map(
          (c: { id: string }) => c.id
        )
      )
      .single()
    const inValues: string[] = gate.data!.visibility_rule.in_values
    const mq = qs.find((q) => q.key === 'maintenance_claims_status')!
    const { data: opts } = await adminDb
      .from('question_option')
      .select('value')
      .eq('question_id', mq.id)
    const none = (opts ?? [])
      .map((o: { value: string }) => o.value)
      .find((v) => !inValues.includes(v))
    if (none) overrides['maintenance_claims_status'] = none
  }

  const userId = await makeUserAndLogin(page, tag)
  await setupCase(page, plz)
  await expect(page.getByText(`von ${denominator} Fragen`, { exact: false })).toBeVisible({
    timeout: 10_000,
  })

  let stuck = 0
  for (let step = 1; step <= 300 && stuck < 5; step++) {
    const r = await answerStep(page, promptMap, overrides)
    if (r === 'done') break
    if (r === 'stuck') {
      stuck++
      await page.screenshot({ path: `test-results/fb-${tag}-stuck-${step}.png` })
      await page.waitForTimeout(2_000)
    } else stuck = 0
  }

  const { data: caseRow } = await adminDb
    .from('cases')
    .select('id, status')
    .eq('user_id', userId)
    .single()
  expect(caseRow!.status, `${tag}: case completed`).toBe('under_review')

  // The leak assert: no spouse-ish question ever became visible ⇒ none answered.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ans } = await (adminDb as any)
    .from('answer')
    .select('question_id')
    .eq('case_id', caseRow!.id)
  const qById = new Map(qs.map((q) => [q.id, q]))
  const spouseish = (ans as { question_id: string }[])
    .map((a) => qById.get(a.question_id))
    .filter(
      (q) =>
        q &&
        !allowedKeys.includes(q.key) &&
        (q.key.startsWith('spouse_') || /\b(Ehe|Ex-)?Partner(s|in)?\b/.test(q.prompt_de))
    )
  expect(
    spouseish.map((q) => q!.key),
    `${tag}: zero spouse/Partner questions asked under ${marital}`
  ).toEqual([])
  console.log(`[${tag}] ${marital}: completed, ${ans.length} answers, zero spouse-ish — PASS`)
}

// ── Leak drives ───────────────────────────────────────────────────────────────

test.setTimeout(600_000)

test('L1: Berlin ledig — 53 questions, zero Partner prompts', async ({ page }) => {
  await leakDrive(page, 'bledig', '13187', BERLIN, 'ledig', 53, [])
})

test('L2: Berlin verwitwet — 53 questions, zero Partner prompts', async ({ page }) => {
  await leakDrive(page, 'bwitwe', '13187', BERLIN, 'verwitwet', 53, [])
})

test('L3: Essen ledig — 49 questions, zero Partner prompts', async ({ page }) => {
  await leakDrive(page, 'eledig', '45127', ESSEN, 'ledig', 49, ['maintenance_claims_status'])
})

test('L4: Essen verwitwet — 49 questions, zero Partner prompts', async ({ page }) => {
  await leakDrive(page, 'ewitwe', '45127', ESSEN, 'verwitwet', 49, ['maintenance_claims_status'])
})

// ── T1: tabs from first login + live conditional slots + mobile badge ─────────

test('T1: Dokumente tab from first login, live spouse slots on marital save, pre-completion upload, mobile badge', async ({
  page,
}) => {
  const qs = await questionsOf(BERLIN)
  const promptMap = promptMapOf(qs)
  const userId = await makeUserAndLogin(page, 'tabs')
  await setupCase(page, '13187')
  const { data: caseRow } = await adminDb.from('cases').select('id').eq('user_id', userId).single()
  cleanupCaseId = caseRow!.id

  // Tab + badge visible BEFORE any answer; mandatory slots present.
  await expect(page.locator('[data-testid=tab-documents]')).toBeVisible({ timeout: 10_000 })
  const badge = page.locator('[data-testid=docs-tab-badge]')
  await expect(badge, 'badge visible from first login').toBeVisible()
  const initialMissing = Number(await badge.textContent())
  expect(initialMissing, 'mandatory slots counted before any answer').toBeGreaterThan(0)

  await page.locator('[data-testid=tab-documents]').click()
  await expect(page.locator('[data-testid=document-area]')).toBeVisible()
  await expect(
    page.getByText('Personaldokument').first(),
    'mandatory slot listed pre-completion'
  ).toBeVisible()
  await expect(
    page.getByText('Unterlagen Ihres Partners'),
    'no spouse slots before marital is answered'
  ).toHaveCount(0)

  // Drive the chat until marital_status=verheiratet is saved.
  await page.locator('[data-testid=tab-questions]').click()
  const maritalQ = qs.find((q) => q.key === 'marital_status')!
  for (let step = 1; step <= 25; step++) {
    const { count } = await adminDb
      .from('answer')
      .select('id', { count: 'exact', head: true })
      .eq('case_id', caseRow!.id)
      .eq('question_id', maritalQ.id)
    if ((count ?? 0) > 0) break
    await answerStep(page, promptMap, { marital_status: 'verheiratet' })
  }

  // LIVE recompute: spouse slots + a larger badge, with no manual reload.
  await expect
    .poll(async () => Number(await badge.textContent().catch(() => '0')), { timeout: 20_000 })
    .toBeGreaterThan(initialMissing)
  await page.locator('[data-testid=tab-documents]').click()
  await expect(
    page.getByText('Unterlagen Ihres Partners'),
    'spouse slots appeared LIVE mid-questionnaire'
  ).toBeVisible({ timeout: 10_000 })

  // Pre-completion upload works (M6 independence extends).
  const firstMissing = page
    .locator('[data-testid=doc-slot]')
    .filter({ has: page.getByText('Fehlt', { exact: true }) })
    .first()
  await firstMissing.locator('input[type=file]').setInputFiles({
    name: 'pre-completion.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n%%EOF\n'),
  })
  const afterSpouse = Number(await badge.textContent())
  await expect
    .poll(async () => Number(await badge.textContent().catch(() => '0')), { timeout: 30_000 })
    .toBe(afterSpouse - 1)

  // Case status untouched by the upload (still in progress, pre-completion).
  const { data: c } = await adminDb.from('cases').select('status').eq('id', caseRow!.id).single()
  expect(c!.status, 'upload does not change case status').toBe('in_progress')

  // Mobile viewport: badge still visible at 375px.
  await page.setViewportSize({ width: 375, height: 812 })
  await expect(badge, 'badge visible at 375px').toBeVisible()
  console.log('[T1] tabs from first login, live spouse slots, pre-completion upload — PASS')
})
