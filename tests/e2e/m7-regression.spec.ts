/**
 * M7 condensed regression — the two legs the M6 documents suite doesn't cover:
 *
 *  R1  Essen: PLZ 45127 loads the Essen questionnaire (denominator 50), a full
 *      single-path drive completes it, and NO document area appears (D5 — the
 *      office has no rules).
 *  R2  Fallback: an unmapped PLZ (66606) silently serves the Berlin
 *      questionnaire (denominator 57, no warning banner), answers persist
 *      across reload.
 *
 * The Pankow leg (signup→questionnaire→completion→uploads→counter) is
 * tests/e2e/documents-m6.spec.ts — run both for the full M7 regression.
 * Auth-email leg: npm run smoke:signup.
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

const ESSEN_QUESTIONNAIRE = '30000000-0000-0000-0000-000000000003'

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

async function makeUserAndLogin(page: Page, tag: string) {
  const email = `pw-m7-${tag}+${Date.now()}@hzp-test.invalid`
  const password = 'TestPassw0rd!'
  const { data, error } = await adminDb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: 'Playwright', last_name: `M7${tag}` },
  })
  if (error) throw new Error(`createUser: ${error.message}`)
  cleanupUserId = data.user.id
  const now = new Date().toISOString()
  await adminDb
    .from('profiles')
    .update({
      phone: '+4915100000008',
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
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1_500)
}

/** Generic adaptive answer step. Returns 'done' once the case is completed —
 *  signaled by the "In Prüfung" status chip (the locked-banner copy is
 *  DB-authored static_content since FP2 and not a stable anchor). */
async function answerStep(page: Page): Promise<'continue' | 'done' | 'stuck'> {
  const locked = await page
    .getByText('In Prüfung', { exact: false })
    .isVisible({ timeout: 200 })
    .catch(() => false)
  if (locked) return 'done'

  const footer = page.locator('.shrink-0.border-t').last()
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
    const options = await sel.evaluate((s: HTMLSelectElement) =>
      Array.from(s.options)
        .filter((o) => o.value !== '')
        .map((o) => o.value)
    )
    const chosen = options.includes('Nein') ? 'Nein' : (options[0] ?? '')
    if (chosen) await sel.selectOption({ value: chosen })
    await clickWeiter(page)
    return 'continue'
  }
  const dateIn = footer.locator('input[type=date]')
  if (await dateIn.isVisible({ timeout: 250 }).catch(() => false)) {
    await dateIn.fill('1960-06-15')
    await clickWeiter(page)
    return 'continue'
  }
  const monthIn = footer.locator('input[type=month]')
  if (await monthIn.isVisible({ timeout: 250 }).catch(() => false)) {
    await monthIn.fill('2020-05')
    await clickWeiter(page)
    return 'continue'
  }
  const numIn = footer.locator('input[type=number]')
  if (await numIn.isVisible({ timeout: 250 }).catch(() => false)) {
    await numIn.fill('100')
    await clickWeiter(page)
    return 'continue'
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

// ── R1: Essen full drive, no document area ────────────────────────────────────

test.setTimeout(600_000)

test('R1: Essen — 45127 loads Essen (50 questions), completes, NO document area', async ({
  page,
}) => {
  const userId = await makeUserAndLogin(page, 'essen')
  await setupCase(page, '45127')

  // Essen questionnaire loaded: routing + denominator
  const { data: caseRow } = await adminDb
    .from('cases')
    .select('id, questionnaire_id')
    .eq('user_id', userId)
    .single()
  expect(caseRow!.questionnaire_id, '45127 must route to the Essen questionnaire').toBe(
    ESSEN_QUESTIONNAIRE
  )
  await expect(page.getByText('von 50 Fragen', { exact: false })).toBeVisible({ timeout: 10_000 })

  let stuck = 0
  for (let step = 1; step <= 300 && stuck < 5; step++) {
    const r = await answerStep(page)
    if (r === 'done') break
    if (r === 'stuck') {
      stuck++
      await page.screenshot({ path: `test-results/m7-essen-stuck-${step}.png` })
      await page.waitForTimeout(2_000)
    } else stuck = 0
  }

  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('In Prüfung', { exact: false })).toBeVisible({ timeout: 15_000 })
  const { data: after } = await adminDb
    .from('cases')
    .select('status')
    .eq('id', caseRow!.id)
    .single()
  expect(after!.status, 'Essen case completed').toBe('under_review')

  // The M7 assert: no document area for Essen (office has no rules — D5)
  await expect(
    page.locator('[data-testid=document-area]'),
    'Essen must have NO document area'
  ).toHaveCount(0)
  console.log('[R1] Essen completed under_review; document area absent — PASS')
})

// ── R2: unmapped PLZ falls back to Berlin silently ────────────────────────────

test('R2: fallback — 66606 serves the Berlin questionnaire, answers persist', async ({ page }) => {
  const userId = await makeUserAndLogin(page, 'fallback')
  await setupCase(page, '66606')

  await expect(page.getByText('von 57 Fragen', { exact: false })).toBeVisible({ timeout: 10_000 })
  const { data: caseRow } = await adminDb
    .from('cases')
    .select('id, plz_resolution_status, questionnaire_id')
    .eq('user_id', userId)
    .single()
  expect(caseRow!.questionnaire_id, 'fallback serves Berlin').toBe(
    '30000000-0000-0000-0000-000000000001'
  )
  // 66606 MATCHES a postal_code_rule (St. Wendel), so the office resolves and
  // the Berlin fallback comes from the office-without-questionnaire path (D12)
  // → status 'resolved'. 'unsupported' is written only when NO rule matches.
  expect(caseRow!.plz_resolution_status, 'office matched, questionnaire fell back').toBe('resolved')

  // No warning banner (the amber notice is suppressed by design)
  await expect(page.getByText('nicht unterstützt', { exact: false })).toHaveCount(0)

  // Answer a few questions, reload, confirm persistence
  for (let step = 1; step <= 4; step++) await answerStep(page)
  const { count } = await adminDb
    .from('answer')
    .select('id', { count: 'exact', head: true })
    .eq('case_id', caseRow!.id)
  expect(count ?? 0, 'answers saved').toBeGreaterThanOrEqual(3)
  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(page.getByText('von 57 Fragen', { exact: false })).toBeVisible({ timeout: 10_000 })
  console.log(`[R2] fallback PLZ → Berlin, ${count} answers persisted — PASS`)
})
