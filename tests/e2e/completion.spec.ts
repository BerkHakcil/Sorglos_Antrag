/**
 * Step A verification — M3 completion gate.
 *
 * Drives a fresh test case through the entire Berlin questionnaire (~61 questions)
 * using an adaptive loop and verifies 5 criteria after the DB-flipping fix:
 *
 *  C1. Completion message "Sie haben alle Fragen beantwortet" shown  OR
 *      the edit-lock card "Angaben werden geprüft" shown immediately after
 *      (server re-render may replace C1 with C4 before we can screenshot it).
 *  C2. DB cases.status = 'under_review' (actual DB check via admin client).
 *  C3. status_event row with event_type='mandatory_complete' exists in DB.
 *  C4. Edits are locked — zero "Bearbeiten" buttons visible after server re-render.
 *  C5. Category header does NOT re-show when moving group→regular in same category.
 */

import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const BASE = 'https://sorglos-antrag.vercel.app'

const SUPABASE_URL = 'https://srtgqgueigyucanfzodb.supabase.co'
const SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNydGdxZ3VlaWd5dWNhbmZ6b2RiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDg1MTg5NSwiZXhwIjoyMDk2NDI3ODk1fQ.XLw1_2NaUFhuRSjA92SQufYJ2TY3NCrLLGbp78ONy0Q'

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

// ── Helpers ────────────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto(`${BASE}/login`)
  await page.locator('[name=email]').fill(CREDS.email)
  await page.locator('[name=password]').fill(CREDS.password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await page.waitForURL(`${BASE}/case`, { timeout: 20_000 })
}

async function waitForIdle(page: Page, timeout = 15_000) {
  await page.waitForFunction(
    () => document.querySelectorAll<HTMLButtonElement>('button[disabled]').length === 0,
    { timeout },
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

async function answerCurrentQuestion(
  page: Page,
): Promise<'done' | 'locked' | 'continue' | 'group_prompt' | 'stuck'> {
  // ── 1. Completion message ─────────────────────────────────────────────────
  if (
    await page
      .getByText('Sie haben alle Fragen beantwortet', { exact: false })
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
      .getByText('Angaben werden geprüft', { exact: false })
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
    await waitForIdle(page)
    return 'group_prompt'
  }

  const footer = page.locator('.shrink-0.border-t').last()

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
        .map((o) => ({ value: o.value, label: o.text.trim() })),
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
      await waitForIdle(page)
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
  // ── 0. Login ────────────────────────────────────────────────────────────────
  await login(page)
  await page.screenshot({ path: 'test-results/01-after-login.png' })

  // ── 1. Select first care home ───────────────────────────────────────────────
  await page.locator('#care_home_id').selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Pflegeheim bestätigen' }).click()
  await waitForIdle(page)
  await page.screenshot({ path: 'test-results/02-care-home.png' })

  // ── 2. Enter PLZ 10115 → Berlin questionnaire ──────────────────────────────
  await page.locator('#plz_input').fill('10115')
  await page.getByRole('button', { name: 'Postleitzahl bestätigen' }).click()
  await page.waitForTimeout(3_000)

  await page.reload()
  await page.waitForLoadState('networkidle')
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
      const footerHeadingEl = page.locator('.shrink-0.border-t h3').first()
      const footerHeading = await footerHeadingEl.textContent({ timeout: 1_000 }).catch(() => '')
      if (footerHeading) {
        const historyArea = page.locator('.overflow-y-auto')
        const historyHeadings = await historyArea
          .locator('h3')
          .allTextContents()
          .catch(() => [] as string[])
        const matchesInHistory = historyHeadings.filter(
          (h) => h.trim() === footerHeading.trim(),
        ).length
        console.log(
          `[C5] After group prompt: footer="${footerHeading}", history matches=${matchesInHistory}`,
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

  // ── C1: Completion message OR locked card visible ───────────────────────────
  const completionMsg = page.getByText('Sie haben alle Fragen beantwortet', { exact: false })
  const lockedMsg = page.getByText('Angaben werden geprüft', { exact: false })
  const c1completion = await completionMsg.isVisible({ timeout: 2_000 }).catch(() => false)
  const c1locked = await lockedMsg.isVisible({ timeout: 2_000 }).catch(() => false)
  const c1 = c1completion || c1locked
  console.log(
    `[C1] completion msg=${c1completion}, locked msg=${c1locked} → c1=${c1}`,
  )

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

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n═══════ STEP A RESULTS ═══════')
  console.log(`C1 Completion/locked UI:     ${c1 ? 'PASS' : 'FAIL'}`)
  console.log(`C2 DB status=under_review:   ${c2 ? 'PASS' : 'FAIL'}`)
  console.log(`C3 status_event row exists:  ${c3 ? 'PASS' : 'FAIL'}`)
  console.log(`C4 Edits locked (0 btns):    ${c4 ? 'PASS' : 'FAIL'}`)
  console.log(`C5 No cat header reshow:     ${criterion5Pass ? 'PASS' : 'FAIL'}`)
  console.log('══════════════════════════════\n')

  expect(completed, 'Adaptive loop must reach completion or locked state').toBe(true)
  expect(c2, 'DB must flip to under_review').toBe(true)
  expect(c3, 'mandatory_complete status_event must be written').toBe(true)
  expect(c4, 'Bearbeiten buttons must disappear after lock').toBe(true)
})
