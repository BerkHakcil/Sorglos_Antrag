/**
 * Go-live round 2, item 5 — split date bounds (lib/date-bounds.ts).
 *
 * D1: on a fresh Berlin case, geburtsdatum (past-only) REJECTS a 2031 date via
 *     the SERVER path ("Ungültiges Datum.") and stays on the same question —
 *     Playwright's fill() bypasses the native picker's max attribute, so the
 *     rejection proves validateAnswerValue, not browser chrome. A valid past
 *     date then advances. The client max attribute is also asserted
 *     ((currentYear+1)-12-31 — the pass-2 bound, deliberately unchanged).
 *
 * D2: id_expiry_date (future-oriented) ACCEPTS 2031-05-01 — the answer lands
 *     in the DB and the drive advances. Client max attribute = today+10y.
 *
 * Runs against production (or E2E_BASE_URL). One throwaway user, cleaned in
 * afterEach (survives failures — the pw-vis leftover lesson).
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

/**
 * Drives the front of the Berlin flow until the footer prompt matches
 * `targetFragment` (lowercase substring). Answers everything before it
 * minimally (the front block is names/dates/selects only). Throws if the
 * target is not reached within `maxSteps`.
 */
async function driveTo(page: Page, targetFragment: string, maxSteps = 30) {
  for (let step = 1; step <= maxSteps; step++) {
    const text = (await footerText(page)).toLowerCase()
    if (text.includes(targetFragment)) return
    const footer = page.locator('[data-testid=answer-footer]').last()

    const sel = footer.locator('select')
    if (await sel.isVisible({ timeout: 300 }).catch(() => false)) {
      const options = await sel.evaluate((s: HTMLSelectElement) =>
        Array.from(s.options)
          .filter((o) => o.value !== '')
          .map((o) => ({ value: o.value, label: o.text.trim() }))
      )
      // ledig keeps the path shortest; otherwise prefer Nein, else first option
      const chosen =
        options.find((o) => o.label === 'ledig')?.value ??
        options.find((o) => o.label === 'Nein')?.value ??
        options[0].value
      await sel.selectOption({ value: chosen })
      await clickWeiter(page)
      continue
    }
    const neinRadio = footer.locator('input[type=radio][value="Nein"]')
    if (await neinRadio.isVisible({ timeout: 300 }).catch(() => false)) {
      await neinRadio.click()
      await clickWeiter(page)
      continue
    }
    const dateIn = footer.locator('input[type=date]')
    if (await dateIn.isVisible({ timeout: 300 }).catch(() => false)) {
      await dateIn.fill('1960-06-15')
      await clickWeiter(page)
      continue
    }
    const textIn = footer.locator('input[type=text]').first()
    if (await textIn.isVisible({ timeout: 300 }).catch(() => false)) {
      await textIn.fill('Müller')
      await clickWeiter(page)
      continue
    }
    throw new Error(`driveTo(${targetFragment}): unhandled input at step ${step}: ${text}`)
  }
  throw new Error(`driveTo(${targetFragment}): not reached in ${maxSteps} steps`)
}

test.setTimeout(240_000)

test('D1+D2: past-only birth date rejects 2031 (server), expiry accepts 2031', async ({ page }) => {
  const { userId, email, caseId } = await createUser('datebounds')
  cleanupUserId = userId

  await login(page, email)
  await setupCareHomeAndPlz(page)

  // ── D1: geburtsdatum ("Wann wurden Sie geboren?") — past-only ──────────────
  await driveTo(page, 'geboren')
  const footer = page.locator('[data-testid=answer-footer]').last()
  const birthInput = footer.locator('input[type=date]')

  // Client bound: the pass-2 max, unchanged for past-only fields.
  await expect(birthInput).toHaveAttribute('max', `${new Date().getFullYear() + 1}-12-31`)

  // Server rejection: fill() bypasses the native max, so the submit reaches
  // validateAnswerValue and must come back with the German error.
  await birthInput.fill('2031-01-01')
  await page.getByRole('button', { name: 'Weiter' }).click()
  await expect(page.locator('[data-testid=answer-footer]').last()).toContainText(
    'Ungültiges Datum.',
    { timeout: 10_000 }
  )
  // Still on the same question — nothing advanced, nothing saved.
  expect((await footerText(page)).toLowerCase()).toContain('geboren')

  // Valid past date advances.
  await birthInput.fill('1960-06-15')
  await clickWeiter(page)

  // ── D2: id_expiry_date ("Bis wann ist Ihr Personaldokument gültig?") ───────
  await driveTo(page, 'personaldokument gültig')
  const expiryInput = page.locator('[data-testid=answer-footer]').last().locator('input[type=date]')

  // Client bound: today+10y (computed like lib/date-bounds.ts dateMaxFor).
  const tenYears = new Date()
  tenYears.setFullYear(tenYears.getFullYear() + 10)
  await expect(expiryInput).toHaveAttribute('max', tenYears.toISOString().slice(0, 10))

  await expiryInput.fill('2031-05-01')
  await clickWeiter(page)

  // The 2031 expiry LANDED: no error, drive moved on, and the DB holds it.
  const { data: q } = await adminDb
    .from('question')
    .select('id')
    .eq('key', 'id_expiry_date')
    .single()
  const { data: a } = await adminDb
    .from('answer')
    .select('value')
    .eq('case_id', caseId)
    .eq('question_id', q!.id)
    .single()
  expect(a?.value).toBe('2031-05-01')
})
