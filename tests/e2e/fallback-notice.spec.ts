/**
 * Fallback checklist guards (fallback-docs fix, 2026-08-26).
 *
 * The out-of-coverage banner (data-testid="fallback-notice") was REMOVED:
 * fallback-served cases now get the purged generic default list with no
 * caveat. This spec is the banner's never-returns guard (count-0 on every
 * path, fallback and own-office alike), the period-suffix suppression guard
 * (which deliberately survives the banner — Phase-1 report §8 Q5), and the
 * Line-A purge guard.
 *
 *  F1  21682 (Stade — no office-specific ruleset): pre-PLZ placeholder, no
 *      banner; after PLZ the default checklist renders with NO banner, no
 *      "(letzte …)" suffix, on desktop and mobile widths. The Line-A trio
 *      (Nachweis Bedarfsanzeige / Polizeiliche Anmeldung im Heim /
 *      Mobilitätsnachweis) is asserted ABSENT once the migration row
 *      fallback_excluded_rule_ids exists, and PRESENT while it does not —
 *      the spec is green on both sides of the founder's db push and proves
 *      the flip when it lands.
 *  F2  13187 (Pankow — own rules): checklist with period suffix, no banner.
 *  F3  45127 (Essen — own rules): checklist with period suffix, no banner.
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

/** The Line-A trio flips from PRESENT to ABSENT when the founder pushes
 *  migration 20260826000001 (app_config fallback_excluded_rule_ids). The
 *  spec reads the row (read-only select) so it asserts the correct side. */
async function fallbackExclusionsActive(): Promise<boolean> {
  const { data } = await adminDb
    .from('app_config')
    .select('value')
    .eq('key', 'fallback_excluded_rule_ids')
    .maybeSingle()
  return Array.isArray(data?.value) && data.value.length > 0
}

const LINE_A_TRIO = [
  'Nachweis Bedarfsanzeige',
  'Polizeiliche Anmeldung im Heim',
  'Mobilitätsnachweis',
]

test.describe('Fallback checklist (banner removed, Line-A purge)', () => {
  test('F1: non-covered PLZ 21682 → default checklist, NO banner, no suffix; trio per migration state', async ({
    page,
  }) => {
    await makeUserAndLogin(page, 'stade')

    // Pre-PLZ state unchanged: placeholder pane, no banner anywhere.
    await page.locator('[data-testid=tab-documents]:visible').click()
    await expect(page.locator('[data-testid=docs-placeholder]')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[data-testid=fallback-notice]')).toHaveCount(0)

    await page.locator('[data-testid=tab-questions]:visible').click()
    await completePreSteps(page, '21682')
    await openDocumentsTab(page)

    // The banner never returns — the checklist renders directly.
    await expect(page.locator('[data-testid=doc-slot]').first()).toBeVisible()
    await expect(page.locator('[data-testid=fallback-notice]')).toHaveCount(0)

    // Suffix suppression (go-live follow-up) survives the banner removal:
    // the fallback list carries the default office's bank slot but must NOT
    // make its period claim — the Kontoauszüge slot renders WITHOUT
    // "(letzte …)" while Pankow's own list keeps it (F2) and Essen's (F3).
    const area = page.locator('[data-testid=document-area]')
    await expect(area.getByText('Kontoauszüge').first()).toBeVisible()
    await expect(area.getByText('(letzte')).toHaveCount(0)

    // Line-A purge: trio absent once the exclusion row exists, present until
    // then (pre-migration deploy window — the fail-open contract).
    const purged = await fallbackExclusionsActive()
    for (const name of LINE_A_TRIO) {
      if (purged) {
        await expect(area.getByText(name)).toHaveCount(0)
      } else {
        await expect(area.getByText(name).first()).toBeVisible()
      }
    }

    // Both viewports (the pane is one markup path; this guards regressions
    // that hide it responsively).
    await page.setViewportSize({ width: 375, height: 812 })
    await expect(page.locator('[data-testid=doc-slot]').first()).toBeVisible()
    await expect(page.locator('[data-testid=fallback-notice]')).toHaveCount(0)
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
