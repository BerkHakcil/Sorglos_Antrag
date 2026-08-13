/**
 * Step A verification — M3 completion gate.
 *
 * Drives a fresh test case through the entire Berlin questionnaire (~61 questions)
 * using an adaptive loop and verifies 5 criteria after the DB-flipping fix:
 *
 *  C1. Completion card ([data-testid=all-answered]) shown  OR
 *      the locked card ([data-testid=locked-banner]) shown immediately after
 *      (server re-render may replace C1 with C4 before we can screenshot it).
 *  C2. DB cases.status = 'under_review' (actual DB check via admin client).
 *  C3. status_event row with event_type='mandatory_complete' exists in DB.
 *  C4. Edits are locked — zero "Bearbeiten" buttons visible after server re-render.
 *  C5. Category header does NOT re-show when moving group→regular in same category.
 *
 * SETUP REQUIRED **BEFORE EVERY RUN**: `node scripts/create-test-user.mjs`.
 * This spec logs in as the user recorded in `.playwright-test-user.json` and
 * drives its case all the way to `under_review`, which the M3 edit lock then
 * freezes — so **the fixture is single-use**.
 *
 * The fixture is consumed EARLIER than "completed", though: the spec's step 1
 * needs the care-home pre-step, which stops rendering the moment
 * `cases.care_home_id` is set. So ANY previous run that got past login — a
 * successful one, or one that failed at question 40 — leaves the fixture
 * unusable, and `#care_home_id` then never appears. The precondition below
 * checks `care_home_id IS NULL`, not just the status, for exactly that reason
 * (verified 2026-07-31 against a fixture with care_home_id + plz set, status
 * still `in_progress`, 0 answers). Re-seeding is the fix; this is not a
 * regression in the app.
 *
 * ⚠ HOW A STALE FIXTURE PRESENTS (cost an hour on 2026-07-30): if that user's
 * CASE row was deleted while the auth user survived (cleanup sweeps delete
 * cases; `create-test-user.mjs` only garbage-collects the previous *user*),
 * login still succeeds, `/case` then throws "Kein Fall gefunden" from
 * getCase(), the app renders its global error boundary, and the failure
 * surfaces as a 10-minute timeout on `waiting for locator('#care_home_id')` —
 * which reads like a selector bug and is not one. Check the server log for
 * "Kein Fall gefunden" and re-run the setup script.
 */

import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'fs'
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

const CREDS = (() => {
  try {
    return JSON.parse(readFileSync('.playwright-test-user.json', 'utf-8')) as {
      email: string
      password: string
      userId: string
      caseId: string
    }
  } catch {
    throw new Error('Run node scripts/create-test-user.mjs first')
  }
})()

// C7 uploads ~a dozen files into the fixture case's storage prefix; the
// fixture's auth user survives the run (single-use, re-seeded next time), so
// without this purge every run would orphan those objects in the live bucket
// (review-pass finding, 2026-08-13). The DB upload rows go too — the fixture
// case outlives the run, and rows pointing at purged storage objects would
// dangle until the next re-seed. Runs even on failure; mirrors
// feedback-pass.spec's pattern.
test.afterAll(async () => {
  await purgeCasePrefix(adminDb, CREDS.caseId).catch((e) =>
    console.error('[cleanup] purgeCasePrefix FAILED - storage may be leaked:', e?.message)
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adminDb as any)
    .from('document_upload')
    .delete()
    .eq('case_id', CREDS.caseId)
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) console.error('[cleanup] upload-row delete FAILED:', error.message)
    })
})

// ── Helpers ────────────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto(`${BASE}/login`)
  await page.locator('[name=email]').fill(CREDS.email)
  await page.locator('[name=password]').fill(CREDS.password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await page.waitForURL(`${BASE}/case`, { timeout: 20_000 })
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

async function answerCurrentQuestion(
  page: Page
): Promise<'done' | 'locked' | 'continue' | 'group_prompt' | 'stuck'> {
  // ── 1. Completion card ─────────────────────────────────────────────────────
  // Anchored on the E-0 testid, not the German: pass 4 (D1) gave the two
  // terminal states DISTINCT DB-authored copy, so the old text matcher
  // ('Sie haben alle Fragen beantwortet') would only ever match the transient
  // all-answered body — and its locked twin ('Angaben werden geprüft') never
  // matched ANY copy that has been live (a dead branch since FP2).
  if (
    await page
      .locator('[data-testid=all-answered]')
      .isVisible({ timeout: 500 })
      .catch(() => false)
  ) {
    return 'done'
  }

  // ── 1b. Edit-locked footer (server already re-rendered after last save) ───
  // After the DB flips, revalidatePath causes a server re-render that replaces
  // the completion card with the locked card before we can see C1.
  if (
    await page
      .locator('[data-testid=locked-banner]')
      .isVisible({ timeout: 500 })
      .catch(() => false)
  ) {
    return 'locked'
  }

  // ── 2. Group prompt ("Nein, weiter") ─────────────────────────────────────
  const neinWeiter = page.getByRole('button', { name: 'Nein, weiter' })
  if (await neinWeiter.isVisible({ timeout: 500 }).catch(() => false)) {
    await neinWeiter.click()
    await page.waitForTimeout(200)
    await waitForFooterSettled(page)
    return 'group_prompt'
  }

  const footer = page.locator('[data-testid=answer-footer]').last()

  // ── 3. yes_no ─────────────────────────────────────────────────────────────
  const neinRadio = footer.locator('input[type=radio][value="Nein"]')
  if (await neinRadio.isVisible({ timeout: 500 }).catch(() => false)) {
    await neinRadio.click()
    await clickWeiter(page)
    return 'continue'
  }

  // ── 4. single_select ──────────────────────────────────────────────────────
  const sel = footer.locator('select')
  if (await sel.isVisible({ timeout: 500 }).catch(() => false)) {
    const options = await sel.evaluate((s: HTMLSelectElement) =>
      Array.from(s.options)
        .filter((o) => o.value !== '')
        .map((o) => ({ value: o.value, label: o.text.trim() }))
    )
    const neinOpt = options.find((o) => o.label === 'Nein')
    const ledigOpt = options.find((o) => o.label === 'ledig' || o.label === 'Ledig')
    const chosen = neinOpt ? neinOpt.value : ledigOpt ? ledigOpt.value : (options[0]?.value ?? '')
    if (chosen) await sel.selectOption({ value: chosen })
    await clickWeiter(page)
    return 'continue'
  }

  // ── 5. date ───────────────────────────────────────────────────────────────
  const dateIn = footer.locator('input[type=date]')
  if (await dateIn.isVisible({ timeout: 500 }).catch(() => false)) {
    await dateIn.fill('1960-06-15')
    await clickWeiter(page)
    return 'continue'
  }

  // ── 6. number / amount ────────────────────────────────────────────────────
  const numIn = footer.locator('input[type=number]')
  if (await numIn.isVisible({ timeout: 500 }).catch(() => false)) {
    await numIn.fill('100')
    await clickWeiter(page)
    return 'continue'
  }

  // ── 7. short_text ─────────────────────────────────────────────────────────
  const textIn = footer.locator('input[type=text]').first()
  if (await textIn.isVisible({ timeout: 500 }).catch(() => false)) {
    await textIn.fill('Müller')
    await clickWeiter(page)
    return 'continue'
  }

  // ── 8. multi_select – skip ────────────────────────────────────────────────
  const chk = footer.locator('input[type=checkbox]').first()
  if (await chk.isVisible({ timeout: 500 }).catch(() => false)) {
    const skip = page.getByRole('button', { name: 'Weiß ich gerade nicht' })
    if (await skip.isVisible({ timeout: 500 }).catch(() => false)) {
      await skip.click()
      await waitForFooterSettled(page)
      return 'continue'
    }
  }

  return 'stuck'
}

// ── Test ───────────────────────────────────────────────────────────────────────

test.setTimeout(600_000)

test('complete all Berlin questionnaire questions → DB flips to under_review + edits locked', async ({
  page,
}) => {
  // ── 0. Fixture precondition ────────────────────────────────────────────────
  // Fail in seconds with the actual cause instead of after a ten-minute
  // timeout on a selector that will never appear (see the header).
  const { data: fixtureCase } = await adminDb
    .from('cases')
    .select('status, care_home_id')
    .eq('id', CREDS.caseId)
    .maybeSingle()
  const reseed = 'Re-seed with: node scripts/create-test-user.mjs'
  expect(fixtureCase, `Fixture case ${CREDS.caseId} no longer exists — ${reseed}`).not.toBeNull()
  expect(
    fixtureCase?.status,
    `Fixture case is already "${fixtureCase?.status}" — this spec drives its case to under_review, ` +
      `so the fixture is single-use. ${reseed}`
  ).toBe('in_progress')
  // A partially-advanced case is just as unusable as a completed one: once
  // care_home_id is set the care-home pre-step stops rendering, so step 1's
  // `#care_home_id` never appears and the test burns its full 10-minute
  // timeout. Any earlier run that got past login — including one that failed
  // later — leaves the fixture in exactly this state, so status alone is not
  // a sufficient precondition. (Observed 2026-07-31: care_home_id and
  // plz_before_move both set, status still in_progress, 0 answers.)
  expect(
    fixtureCase?.care_home_id,
    `Fixture case already has a care home selected, so the care-home pre-step will not render. ` +
      `A previous run consumed this fixture. ${reseed}`
  ).toBeNull()

  // ── 0b. Login ───────────────────────────────────────────────────────────────
  await login(page)
  await page.screenshot({ path: 'test-results/01-after-login.png' })

  // ── 1. Select first care home ───────────────────────────────────────────────
  await page.locator('#care_home_id').selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Pflegeheim bestätigen' }).click()
  await waitForFooterSettled(page)
  await page.screenshot({ path: 'test-results/02-care-home.png' })

  // ── 2. Enter PLZ 10115 → Berlin questionnaire ──────────────────────────────
  await page.locator('#plz_input').fill('10115')
  await page.getByRole('button', { name: 'Postleitzahl bestätigen' }).click()
  await page.waitForTimeout(3_000)

  await page.reload()
  // Deterministic: the questionnaire is ready when its answer area renders.
  await expect(page.locator('[data-testid=answer-footer]')).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(1_500)
  await page.screenshot({ path: 'test-results/03-questionnaire-loaded.png' })

  // ── 3. Adaptive answer loop ─────────────────────────────────────────────────
  const MAX_STEPS = 150
  let steps = 0
  let completed = false
  let stuckCount = 0

  let criterion5Captured = false
  let criterion5Pass = true

  while (steps < MAX_STEPS && stuckCount < 3) {
    steps++
    const result = await answerCurrentQuestion(page)
    console.log(`[step ${steps}] result=${result}`)

    if (result === 'done' || result === 'locked') {
      completed = true
      break
    }

    if (result === 'stuck') {
      stuckCount++
      await page.screenshot({ path: `test-results/stuck-step-${steps}.png` })
      console.log(`[step ${steps}] Stuck (count=${stuckCount})`)
      await page.waitForTimeout(2_000)
      continue
    } else {
      stuckCount = 0
    }

    // ── C5: Check category heading after group prompt dismissal ───────────
    if (result === 'group_prompt' && !criterion5Captured) {
      await page.waitForTimeout(500)
      const footerHeadingEl = page.locator('[data-testid=answer-footer] h3').first()
      const footerHeading = await footerHeadingEl.textContent({ timeout: 1_000 }).catch(() => '')
      if (footerHeading) {
        const historyArea = page.locator('[data-testid=chat-history]')
        const historyHeadings = await historyArea
          .locator('h3')
          .allTextContents()
          .catch(() => [] as string[])
        const matchesInHistory = historyHeadings.filter(
          (h) => h.trim() === footerHeading.trim()
        ).length
        console.log(
          `[C5] After group prompt: footer="${footerHeading}", history matches=${matchesInHistory}`
        )
        if (matchesInHistory > 0) {
          criterion5Pass = false
          await page.screenshot({ path: 'test-results/c5-header-reshow.png' })
        }
        criterion5Captured = true
      }
    }

    if (steps % 15 === 0) {
      await page.screenshot({ path: `test-results/progress-step-${steps}.png` })
    }
  }

  await page.screenshot({ path: 'test-results/04-after-loop.png' })
  console.log(`Adaptive loop: ${steps} steps, completed=${completed}`)

  // Wait for server re-render to settle after last save
  await page.waitForTimeout(2_000)
  await page.screenshot({ path: 'test-results/05-post-settle.png', fullPage: true })

  // ── C1: Completion card OR locked card visible ──────────────────────────────
  // Testid anchors (see the driver comment): survives DB-authored copy changes.
  const completionMsg = page.locator('[data-testid=all-answered]')
  const lockedMsg = page.locator('[data-testid=locked-banner]')
  const c1completion = await completionMsg.isVisible({ timeout: 2_000 }).catch(() => false)
  const c1locked = await lockedMsg.isVisible({ timeout: 2_000 }).catch(() => false)
  const c1 = c1completion || c1locked
  console.log(`[C1] completion msg=${c1completion}, locked msg=${c1locked} → c1=${c1}`)

  // ── C2: DB status = under_review ────────────────────────────────────────────
  const { data: caseRow } = await adminDb
    .from('cases')
    .select('id, status')
    .eq('id', CREDS.caseId)
    .single()
  const c2 = caseRow?.status === 'under_review'
  console.log(`[C2] DB cases.status = "${caseRow?.status}" → c2=${c2}`)

  // ── C3: status_event mandatory_complete ─────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: eventCount } = await (adminDb as any)
    .from('status_event')
    .select('id', { count: 'exact', head: true })
    .eq('case_id', CREDS.caseId)
    .eq('event_type', 'mandatory_complete')
  const c3 = (eventCount ?? 0) > 0
  console.log(`[C3] status_event mandatory_complete count=${eventCount} → c3=${c3}`)

  // ── C4: Zero Bearbeiten buttons (edit locked) ───────────────────────────────
  const editBtns = await page.locator('button', { hasText: 'Bearbeiten' }).count()
  const c4 = editBtns === 0
  console.log(`[C4] Bearbeiten buttons=${editBtns} → locked=${c4}`)

  await page.screenshot({ path: 'test-results/06-edit-lock.png', fullPage: true })

  // ── C5 ───────────────────────────────────────────────────────────────────────
  console.log(`[C5] criterion5Pass=${criterion5Pass} (captured=${criterion5Captured})`)

  // ── C6: docs-aware locked-card VARIANT (item 3, go-live round 2) ─────────────
  // The drive uploads nothing, so the locked case has missing > 0 and must show
  // the variant: variant heading/body (content-compared against the DB rows —
  // PLACEHOLDER_DE German is never hardcoded here), the petrol
  // "Zu den Dokumenten" button, and 4 next steps (upload step prefixed).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: scRows } = await (adminDb as any)
    .from('static_content')
    .select('key, value_de')
    .in('key', [
      'case.locked_heading',
      'case.locked_docs_heading',
      'case.locked_docs_button',
      'case.next_steps_upload',
    ])
  const sc: Record<string, string> = {}
  for (const r of (scRows ?? []) as { key: string; value_de: string }[]) sc[r.key] = r.value_de
  expect(
    sc['case.locked_docs_heading'],
    'variant content rows must exist (migration 20260813000002)'
  ).toBeTruthy()

  await page.reload()
  const lockedCard = page.locator('[data-testid=locked-banner]')
  await expect(lockedCard).toBeVisible({ timeout: 20_000 })
  const missingAttr = await lockedCard.getAttribute('data-docs-missing')
  console.log(`[C6] data-docs-missing=${missingAttr}`)
  expect(Number(missingAttr), 'locked with zero uploads must report missing > 0').toBeGreaterThan(0)
  await expect(lockedCard).toContainText(sc['case.locked_docs_heading'])
  const docsBtn = page.locator('[data-testid=locked-docs-button]')
  await expect(docsBtn).toBeVisible()
  await expect(docsBtn).toHaveText(sc['case.locked_docs_button'])
  await expect(page.locator('[data-testid=next-steps] li')).toHaveCount(4)
  await expect(page.locator('[data-testid=next-steps] li').first()).toContainText(
    sc['case.next_steps_upload']
  )

  // Button switches to the Dokumente tab (context-based setTab).
  await docsBtn.click()
  await expect(page.locator('[data-testid=tab-documents]')).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('[data-testid=missing-docs-counter]')).toBeVisible({ timeout: 10_000 })
  console.log('[C6] variant + tab switch PASS')

  // ── C7: 0 missing → today's approved card, byte-identical ────────────────────
  // Upload one file into every missing slot (uploads stay allowed while locked
  // by design), then the card must drop the variant: original heading, no
  // button, exactly the 3 original next steps.
  const PDF_BYTES = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF'
  )
  for (let round = 0; round < 40; round++) {
    const missingSlot = page
      .locator('[data-testid=doc-slot]')
      .filter({ has: page.getByText('Fehlt', { exact: true }) })
      .first()
    const anyMissing = await missingSlot.isVisible({ timeout: 1_000 }).catch(() => false)
    if (!anyMissing) break
    const before = await page
      .locator('[data-testid=doc-slot]')
      .filter({ has: page.getByText('Fehlt', { exact: true }) })
      .count()
    await missingSlot.locator('input[type=file]').setInputFiles({
      name: `c7-fill-${round}.pdf`,
      mimeType: 'application/pdf',
      buffer: PDF_BYTES,
    })
    await expect(async () => {
      const now = await page
        .locator('[data-testid=doc-slot]')
        .filter({ has: page.getByText('Fehlt', { exact: true }) })
        .count()
      expect(now).toBeLessThan(before)
    }).toPass({ timeout: 20_000 })
  }
  await expect(
    page.locator('[data-testid=doc-slot]').filter({ has: page.getByText('Fehlt', { exact: true }) })
  ).toHaveCount(0)

  await page.reload()
  const lockedCard0 = page.locator('[data-testid=locked-banner]')
  await expect(lockedCard0).toBeVisible({ timeout: 20_000 })
  await expect(lockedCard0).toHaveAttribute('data-docs-missing', '0')
  await expect(lockedCard0).toContainText(sc['case.locked_heading'])
  await expect(page.locator('[data-testid=locked-docs-button]')).toHaveCount(0)
  await expect(page.locator('[data-testid=next-steps] li')).toHaveCount(3)
  console.log('[C7] zero-missing approved card PASS')

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n═══════ STEP A RESULTS ═══════')
  console.log(`C1 Completion/locked UI:     ${c1 ? 'PASS' : 'FAIL'}`)
  console.log(`C2 DB status=under_review:   ${c2 ? 'PASS' : 'FAIL'}`)
  console.log(`C3 status_event row exists:  ${c3 ? 'PASS' : 'FAIL'}`)
  console.log(`C4 Edits locked (0 btns):    ${c4 ? 'PASS' : 'FAIL'}`)
  console.log(`C5 No cat header reshow:     ${criterion5Pass ? 'PASS' : 'FAIL'}`)
  console.log('C6 Docs-variant + tab switch: asserted inline')
  console.log('C7 Zero-missing approved card: asserted inline')
  console.log('══════════════════════════════\n')

  expect(completed, 'Adaptive loop must reach completion or locked state').toBe(true)
  expect(c2, 'DB must flip to under_review').toBe(true)
  expect(c3, 'mandatory_complete status_event must be written').toBe(true)
  expect(c4, 'Bearbeiten buttons must disappear after lock').toBe(true)
})
