/**
 * Widowed → Sterbeurkunde-Partner slot, end to end (widowed pass, GATE 1
 * 2026-08-29: coverage-only Phase 2; the rule itself is PAN-025, live since
 * M5R2, plus ESS-056 for Essen).
 *
 *  W1: a Berlin case answers Familienstand = verwitwet → the Unterlagen
 *      checklist shows the Sterbeurkunde-Partner slot.
 *  W2: editing the answer to ledig removes it on the next render (the
 *      checklist recomputes display-time), while the rest of the checklist
 *      keeps rendering.
 *
 * The drive uses PLZ 10115 (Berlin-Mitte — an office WITHOUT own rules), so
 * the case is FALLBACK-served: exactly the shape of the three real widowed
 * prod cases, and the end-to-end version of the governance tripwire (PAN-025
 * must never join fallback_excluded_rule_ids — asserted against the live
 * config in the readiness block).
 *
 * All German (the question prompt, the option value, the document name) is
 * read from the DB at runtime — nothing user-facing is hardcoded here.
 * One throwaway user, deleted in afterEach (survives failures).
 * Structure mirrors disability-gate.spec.ts (the conditional-gate precedent).
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
// Berlin questionnaire, applicant marital status (Phase-1 survey, verified
// against prod in the readiness block below).
const BERLIN_MARITAL_ID = '60000000-0000-0000-0000-00000000000a'

let cleanupUserId: string | null = null

test.afterEach(async () => {
  if (cleanupUserId) {
    await adminDb.auth.admin
      .deleteUser(cleanupUserId)
      .catch((e) => console.error('[cleanup] deleteUser FAILED - user may be leaked:', e?.message))
    cleanupUserId = null
  }
})

async function createUser(tag: string): Promise<{ userId: string; email: string }> {
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
      phone: '+4915100000012',
      consent_datenschutz_at: now,
      consent_agb_at: now,
      consent_data_processing_at: now,
      consent_authority_to_act_at: now,
    })
    .eq('id', userId)
  return { userId, email }
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
  await page.locator('#plz_input').fill('10115') // Berlin questionnaire, fallback-served office
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

async function clickSave(page: Page) {
  await page.waitForTimeout(150)
  const save = page.getByTestId('save-answer')
  await save.waitFor({ state: 'visible', timeout: 8_000 })
  await save.click()
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

/** Answers everything minimally until the footer prompt contains `target`
 *  (lower-cased). Identical drive shape to disability-gate.spec.ts. */
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
      await clickSave(page)
      continue
    }
    const neinRadio = footer.locator('input[type=radio][value="Nein"]')
    if (await neinRadio.isVisible({ timeout: 300 }).catch(() => false)) {
      await neinRadio.click()
      await clickSave(page)
      continue
    }
    const dateIn = footer.locator('input[type=date]')
    if (await dateIn.isVisible({ timeout: 300 }).catch(() => false)) {
      await dateIn.fill('1955-04-20')
      await clickSave(page)
      continue
    }
    const textIn = footer.locator('input[type=text]').first()
    if (await textIn.isVisible({ timeout: 300 }).catch(() => false)) {
      await textIn.fill('Schneider')
      await clickSave(page)
      continue
    }
    throw new Error(`driveTo(${target}): unhandled input at step ${step}: ${text}`)
  }
  throw new Error(`driveTo(${target}): not reached in ${maxSteps} steps`)
}

async function openDocumentsTab(page: Page) {
  await page.locator('[data-testid=tab-documents]:visible').click()
  await expect(page.locator('[data-testid=document-area]')).toBeVisible({ timeout: 15_000 })
}

test.setTimeout(300_000)

test('W1+W2: verwitwet surfaces the Sterbeurkunde slot on the fallback checklist; editing to ledig removes it', async ({
  page,
}) => {
  // ── Readiness + lockstep (read-only): the DB must hold the surveyed shape ──
  const { data: q } = await adminDb
    .from('question')
    .select('id, key, prompt_de, active')
    .eq('id', BERLIN_MARITAL_ID)
    .maybeSingle()
  if (!q) throw new Error('Berlin marital_status question 60…000a absent — survey drifted, re-check')
  expect(q.key).toBe('marital_status')
  expect(q.active).toBe(true)
  const maritalPrompt = q.prompt_de as string

  const { data: opt } = await adminDb
    .from('question_option')
    .select('value, label_de')
    .eq('question_id', BERLIN_MARITAL_ID)
    .eq('value', 'verwitwet')
    .maybeSingle()
  if (!opt) throw new Error('widowed option value is not exactly "verwitwet" — rule/option drifted')
  const widowedLabel = opt.label_de as string

  const { data: rule } = await adminDb
    .from('office_document_rule')
    .select('id, document_id, requirement_type, subject, condition, active')
    .eq('id', 'PAN-025')
    .maybeSingle()
  if (!rule || !rule.active) throw new Error('PAN-025 absent or inactive — the rule this spec pins')
  expect(rule.condition).toEqual({ field: 'marital_status', operator: 'equals', value: 'verwitwet' })

  const { data: doc } = await adminDb
    .from('document_catalog')
    .select('name_de, active')
    .eq('id', 'DOC-0016')
    .maybeSingle()
  if (!doc || !doc.active) throw new Error('DOC-0016 absent or inactive')
  const slotName = doc.name_de as string

  // Governance tripwire, end to end: the fallback exclusions must not name
  // PAN-025 — otherwise fallback-served widowed cases (this spec's shape,
  // and all three real widowed prod cases) would silently lose the slot.
  const { data: excl } = await adminDb
    .from('app_config')
    .select('value')
    .eq('key', 'fallback_excluded_rule_ids')
    .maybeSingle()
  if (Array.isArray(excl?.value)) expect(excl.value).not.toContain('PAN-025')

  const { userId, email } = await createUser('widowed')
  cleanupUserId = userId

  await login(page, email)
  await setupCareHomeAndPlz(page)

  // ── W1: answer Familienstand = verwitwet → the slot appears ────────────────
  await driveTo(page, maritalPrompt.toLowerCase())
  await selectInFooter(page, widowedLabel)
  await clickSave(page)
  console.log('[W1] marital_status answered verwitwet')

  await openDocumentsTab(page)
  const area = page.locator('[data-testid=document-area]')
  await expect(area.getByText(slotName).first()).toBeVisible({ timeout: 10_000 })
  console.log(`[W1] "${slotName}" slot visible on the fallback checklist`)

  // ── W2: edit to ledig → the slot disappears, the checklist stays alive ─────
  await page.locator('[data-testid=tab-questions]:visible').click()
  const bubble = page
    .locator('[data-testid=answered-bubble]')
    .filter({ hasText: maritalPrompt })
    .first()
  await bubble.scrollIntoViewIfNeeded()
  await bubble.getByRole('button', { name: 'Bearbeiten' }).click()
  await selectInFooter(page, 'ledig')
  await clickButton(page, 'Änderung speichern')
  console.log('[W2] marital_status edited to ledig')

  await openDocumentsTab(page)
  await expect(area.getByText(slotName)).toHaveCount(0, { timeout: 10_000 })
  // The absence must come from the recompute, not a dead pane: other slots
  // still render.
  await expect(area.locator('[data-testid=doc-slot]').first()).toBeVisible()
  console.log(`[W2] "${slotName}" gone after the edit; checklist still renders`)
})
