/**
 * Go-live out-of-coverage banner (data-testid="fallback-notice").
 *
 * A case served by the DEFAULT-OFFICE fallback branch (dal.ts getDocumentData
 * → rulesSource 'fallback') gets an honesty notice above its checklist: the
 * list shown is the generic default, not its own office's. Cases whose office
 * HAS rules must never see it. The mechanism itself (fallback to the default
 * list) is correct and untested here beyond presence — m7-regression R2 owns
 * the deep fallback drive.
 *
 *  F1  21682 (Stade — no office-specific ruleset): pre-PLZ placeholder shows
 *      NO banner (state unchanged); after PLZ the checklist renders WITH the
 *      banner above the first document group, on desktop and mobile widths.
 *  F2  13187 (Pankow — own rules): checklist, NO banner.
 *  F3  45127 (Essen — own rules): checklist with the "(letzte 4 Monate)"
 *      period suffix intact, NO banner.
 *
 * No questionnaire drive: the checklist is live from PLZ resolution (D5
 * superseded), so each test is login → pre-steps → Dokumente tab.
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

async function makeUserAndLogin(page: Page, tag: string) {
  const email = `pw-fbn-${tag}+${Date.now()}@hzp-test.invalid`
  const password = 'TestPassw0rd!'
  const { data, error } = await adminDb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: 'Playwright', last_name: `Fbn${tag}` },
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
}

/** Pre-questionnaire steps: care home + PLZ, then wait for the questionnaire. */
async function completePreSteps(page: Page, plz: string) {
  await page.locator('#care_home_id').selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Pflegeheim bestätigen' }).click()
  await page.waitForTimeout(2_000)
  await page.locator('#plz_input').fill(plz)
  await page.getByRole('button', { name: 'Postleitzahl bestätigen' }).click()
  await page.waitForTimeout(3_000)
  await page.reload()
  await expect(page.locator('[data-testid=answer-footer]')).toBeVisible({ timeout: 30_000 })
}

async function openDocumentsTab(page: Page) {
  await page.locator('[data-testid=tab-documents]:visible').click()
  await expect(page.locator('[data-testid=document-area]')).toBeVisible({ timeout: 15_000 })
}

test.describe('Out-of-coverage fallback notice', () => {
  test('F1: non-covered PLZ 21682 → banner above the default checklist; absent pre-PLZ', async ({
    page,
  }) => {
    await makeUserAndLogin(page, 'stade')

    // Pre-PLZ state unchanged: placeholder pane, NO banner anywhere.
    await page.locator('[data-testid=tab-documents]:visible').click()
    await expect(page.locator('[data-testid=docs-placeholder]')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[data-testid=fallback-notice]')).toHaveCount(0)

    await page.locator('[data-testid=tab-questions]:visible').click()
    await completePreSteps(page, '21682')
    await openDocumentsTab(page)

    // Banner present, and ABOVE the first document group.
    const notice = page.locator('[data-testid=fallback-notice]')
    await expect(notice).toBeVisible()
    await expect(page.locator('[data-testid=doc-slot]').first()).toBeVisible()
    const noticePrecedesSlots = await page.evaluate(() => {
      const n = document.querySelector('[data-testid=fallback-notice]')
      const s = document.querySelector('[data-testid=doc-slot]')
      return !!n && !!s && !!(n.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING)
    })
    expect(noticePrecedesSlots).toBe(true)

    // Suffix suppression (go-live follow-up): the fallback list carries the
    // default office's bank slot but must NOT make its period claim — the
    // Kontoauszüge slot renders WITHOUT "(letzte …)" while Pankow's own list
    // keeps it (F2) and Essen's keeps it (F3).
    const area = page.locator('[data-testid=document-area]')
    await expect(area.getByText('Kontoauszüge').first()).toBeVisible()
    await expect(area.getByText('(letzte')).toHaveCount(0)

    // Both viewports (the pane is one markup path; this guards regressions
    // that hide it responsively).
    await page.setViewportSize({ width: 375, height: 812 })
    await expect(notice).toBeVisible()
  })

  test('F2: Pankow PLZ 13187 (own rules) → checklist with period suffix, NO banner', async ({
    page,
  }) => {
    await makeUserAndLogin(page, 'pankow')
    await completePreSteps(page, '13187')
    await openDocumentsTab(page)

    await expect(page.locator('[data-testid=doc-slot]').first()).toBeVisible()
    await expect(page.locator('[data-testid=fallback-notice]')).toHaveCount(0)
    // D10 regression guard (Pankow side): own-office rendering is untouched
    // by the fallback suppression — PAN-005/006 keep their 4-month suffix.
    await expect(
      page.locator('[data-testid=document-area]').getByText('(letzte 4 Monate)').first()
    ).toBeVisible()
  })

  test('F3: Essen PLZ 45127 (own rules) → checklist with period suffix, NO banner', async ({
    page,
  }) => {
    await makeUserAndLogin(page, 'essen')
    await completePreSteps(page, '45127')
    await openDocumentsTab(page)

    await expect(page.locator('[data-testid=doc-slot]').first()).toBeVisible()
    await expect(page.locator('[data-testid=fallback-notice]')).toHaveCount(0)
    // D10 regression guard: the Essen bank-statement suffix must survive the
    // banner change untouched.
    await expect(
      page.locator('[data-testid=document-area]').getByText('(letzte 4 Monate)').first()
    ).toBeVisible()
  })
})
