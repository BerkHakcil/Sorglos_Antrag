/**
 * Mobile answer-footer reachability (go-live follow-up, 2026-08-11).
 *
 * FIELD REPORT (iPhone, Brave): at the Essen bulk question "Trifft eine
 * dieser besonderen Einkommens- oder Rentensituationen auf Sie zu?"
 * (7 options) the save footer is blocked — the user cannot continue.
 *
 * MECHANISM (verified in code, not vh-vs-dvh): the active question card
 * renders inside [data-testid=answer-footer], a shrink-0 flex item BELOW the
 * only scroll region (chat-history), with no max-height and no overflow of
 * its own, inside overflow-hidden ancestors up to the h-dvh case shell
 * (page.tsx:35). A tall multiselect makes the footer's intrinsic height
 * exceed the viewport remainder; the shell clips the card's bottom — exactly
 * the Weiter/skip buttons — and NO scroll gesture can reveal them. iOS is
 * only the worst case: the document never scrolls, so the browser chrome
 * never collapses and dvh stays at its small-viewport value.
 *
 * This spec drives a full Essen case (PLZ 45326 — the reported PLZ) at
 * 375x812 and asserts, at EVERY multiselect and group prompt, that the
 * action buttons sit fully inside the viewport without any page scrolling.
 * The drive passes through income_bulk_topics (7 opts, the reported one),
 * expense_bulk_topics (7) and wealth_bulk_topics (9 — the tallest
 * multiselect in either questionnaire, found programmatically; Berlin's max
 * is 3 and gated). After completion it sanity-checks the locked card and the
 * Dokumente tab at the same viewport.
 *
 * CAVEAT: chromium viewport emulation approximates iOS (no webkit project is
 * configured). After deploy, the flow should be confirmed once on a real
 * phone — see the session report for the exact taps.
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
 * 375x667 (iPhone SE/8 class), NOT the brief's 375x812: a Playwright
 * viewport is pure content area, while the reported iPhone loses
 * ~150-190px of its 812 CSS points to Brave's URL/tool bars (which never
 * collapse here — the document never scrolls). Measured during repro:
 * at 812 the 7-option bulk card still fits and the bug does not fire;
 * at 667 it clips exactly as reported. 667 is also a real device class
 * still common among caregivers, so this is not an artificial shrink.
 */
const VIEWPORT = { width: 375, height: 667 }

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

/**
 * THE regression assert: the control must sit fully inside the viewport with
 * the page body unscrolled — i.e. reachable without any scrolling at all.
 * Before the fix this fails at the first 7-option bulk (the button row is
 * clipped below the h-dvh shell).
 */
async function expectFullyInViewport(page: Page, locator: ReturnType<Page['locator']>) {
  const box = await locator.boundingBox()
  expect(box, 'control must have a bounding box (rendered)').not.toBeNull()
  expect(box!.y, 'control top must be on-screen').toBeGreaterThanOrEqual(0)
  expect(
    box!.y + box!.height,
    `control bottom (${Math.round(box!.y + box!.height)}px) must be within the ${VIEWPORT.height}px viewport`
  ).toBeLessThanOrEqual(VIEWPORT.height)
  const scrollY = await page.evaluate(() => window.scrollY)
  expect(scrollY, 'page body must not be scrolled').toBe(0)
}

async function makeUserAndLogin(page: Page, tag: string) {
  const email = `pw-mob-${tag}+${Date.now()}@hzp-test.invalid`
  const password = 'TestPassw0rd!'
  const { data, error } = await adminDb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: 'Playwright', last_name: `Mob${tag}` },
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

async function setupCase(page: Page, plz: string) {
  await page.locator('#care_home_id').selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Pflegeheim bestätigen' }).click()
  await page.waitForTimeout(2_000)
  await page.locator('#plz_input').fill(plz)
  await page.getByRole('button', { name: 'Postleitzahl bestätigen' }).click()
  await page.waitForTimeout(3_000)
  await page.reload()
  await expect(page.locator('[data-testid=answer-footer]')).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(1_500)
}

test.describe('Mobile answer-footer reachability', () => {
  test('M1: Essen 45326 at 375x667 — every multiselect/group-prompt action reachable; locked card + docs tab sane', async ({
    page,
  }) => {
    test.setTimeout(540_000)
    await page.setViewportSize(VIEWPORT)
    await makeUserAndLogin(page, '45326')
    await setupCase(page, '45326')

    // 45326 must load the Essen questionnaire (fresh denominator 49).
    await expect(page.getByText('von 49 Fragen')).toBeVisible({ timeout: 10_000 })

    // Multiselect encounters: option counts seen, for the tallest-coverage
    // assert at the end (wealth_bulk_topics has 9 — the max in either
    // questionnaire, found programmatically from prod config).
    const multiselectSizes: number[] = []
    let groupPromptsChecked = 0
    let stuck = 0

    for (let step = 1; step <= 300; step++) {
      const locked = await page
        .getByText('In Prüfung', { exact: false })
        .isVisible({ timeout: 200 })
        .catch(() => false)
      if (locked) break

      const footer = page.locator('[data-testid=answer-footer]').last()

      // Group prompt: assert reachability, then decline.
      const neinWeiter = page.getByRole('button', { name: 'Nein, weiter' })
      if (await neinWeiter.isVisible({ timeout: 250 }).catch(() => false)) {
        await expectFullyInViewport(page, neinWeiter)
        groupPromptsChecked++
        await neinWeiter.click()
        await page.waitForTimeout(200)
        await waitForFooterSettled(page)
        continue
      }

      // Multiselect: THE regression case. Assert the save button is fully
      // in-viewport BEFORE touching anything, then answer via the exclusive
      // "none" option and advance.
      const checkboxes = footer.locator('input[type=checkbox]')
      const boxCount = await checkboxes.count()
      if (boxCount > 0) {
        multiselectSizes.push(boxCount)
        await expectFullyInViewport(page, page.getByRole('button', { name: 'Weiter' }))
        // ⚠ COPY-COUPLED BY DESIGN (transitive-visibility precedent): the
        // exclusive none-option value "Nein, nichts davon" is Roman's data
        // (validation.exclusive_value). A rewording breaks this selector —
        // fall back to the LAST checkbox (the none-option's position on all
        // current bulks) so the drive degrades instead of dying.
        const exclusive = footer.locator('input[type=checkbox][value="Nein, nichts davon"]')
        if (await exclusive.isVisible({ timeout: 250 }).catch(() => false)) {
          await exclusive.click()
        } else {
          await checkboxes.last().click()
        }
        await clickWeiter(page)
        continue
      }

      // Everything else: the proven m7 adaptive branches, condensed.
      const neinRadio = footer.locator('input[type=radio][value="Nein"]')
      if (await neinRadio.isVisible({ timeout: 250 }).catch(() => false)) {
        await neinRadio.click()
        await clickWeiter(page)
        continue
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
        continue
      }
      const dateIn = footer.locator('input[type=date]')
      if (await dateIn.isVisible({ timeout: 250 }).catch(() => false)) {
        await dateIn.fill('1960-06-15')
        await clickWeiter(page)
        continue
      }
      const monthIn = footer.locator('input[type=month]')
      if (await monthIn.isVisible({ timeout: 250 }).catch(() => false)) {
        await monthIn.fill('2020-05')
        await clickWeiter(page)
        continue
      }
      const numIn = footer.locator('input[type=number]')
      if (await numIn.isVisible({ timeout: 250 }).catch(() => false)) {
        await numIn.fill('100')
        await clickWeiter(page)
        continue
      }
      const textarea = footer.locator('textarea')
      if (await textarea.isVisible({ timeout: 250 }).catch(() => false)) {
        await textarea.fill('Keine weiteren Angaben')
        await clickWeiter(page)
        continue
      }
      const textIn = footer.locator('input[type=text]').first()
      if (await textIn.isVisible({ timeout: 250 }).catch(() => false)) {
        const footerText = (await footer.textContent({ timeout: 500 }).catch(() => '')) ?? ''
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
        continue
      }
      // Nothing matched — usually a transient render state (e.g. the locked
      // card just replaced the question but the status chip lags a beat).
      // m7's stuck-retry semantics: wait and retry, throw only when truly
      // wedged.
      stuck++
      if (stuck >= 5) throw new Error(`step ${step}: no known control in the footer (5 retries)`)
      await page.waitForTimeout(1_000)
    }

    // Coverage: the reported 7-option bulks AND the 9-option tallest must
    // have been asserted on the way through.
    console.log(`[M1] multiselect sizes encountered: ${multiselectSizes.join(', ')}`)
    console.log(`[M1] group prompts reachability-checked: ${groupPromptsChecked}`)
    expect(Math.max(...multiselectSizes)).toBeGreaterThanOrEqual(9)
    expect(multiselectSizes.filter((n) => n >= 7).length).toBeGreaterThanOrEqual(3)

    // Locked state at mobile: the card renders in the same footer slot. Its
    // LAST next-steps bullet must be reachable (footer-internal scrolling is
    // fine and intended — scrollIntoViewIfNeeded uses it; the page body must
    // still not scroll).
    await expect(page.getByText('In Prüfung', { exact: false }).first()).toBeVisible({
      timeout: 15_000,
    })
    const lockedFooter = page.locator('[data-testid=answer-footer]')
    await expect(lockedFooter).toBeVisible()
    const lastBullet = lockedFooter.locator('li').last()
    if (await lastBullet.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await lastBullet.scrollIntoViewIfNeeded()
      const box = await lastBullet.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.y + box!.height).toBeLessThanOrEqual(VIEWPORT.height)
      expect(await page.evaluate(() => window.scrollY)).toBe(0)
    }

    // Documents tab at mobile: tab button reachable, checklist renders.
    const docsTab = page.locator('[data-testid=tab-documents]')
    await expectFullyInViewport(page, docsTab)
    await docsTab.click()
    await expect(page.locator('[data-testid=document-area]')).toBeVisible({ timeout: 15_000 })
  })
})
