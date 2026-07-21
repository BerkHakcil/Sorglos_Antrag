/**
 * M6 acceptance suite — dynamic document requirements, driven live on prod.
 *
 * Maps 1:1 to the M6 acceptance criteria:
 *  A1  multiple pensions → multiple pension-notice slots (re-assert of M5)
 *  A2  disability_card = Nein → NO disability-card slot
 *  A3  married path → spouse slots: PAN-002 identity, PAN-004 pension per
 *      spouse pension instance, PAN-006 bank per spouse account
 *  A4  missing-documents counter: initial n == missing slots; upload → n-1;
 *      delete → n+1; all uploaded → complete string; one missing → singular
 *  A5  LIVENESS: flipping a trigger answer on the COMPLETED case changes the
 *      checklist on reload — requirements are computed live, never snapshotted.
 *      The flip is a service-role DB write: TEST-ONLY technique, answers stay
 *      locked in the product (M3 edit lock).
 *  A6  upload/delete never changes case status or any answer
 *
 * Setup drives the Berlin questionnaire (Pankow PLZ 13187) on the married path
 * with 2 applicant pensions via an adaptive loop; question-specific answers are
 * keyed by a prompt→key map loaded from the DB (no brittle text heuristics).
 *
 * Counter asserts degrade: the numeric data-missing attribute is always
 * asserted when the counter element exists; the exact German strings are only
 * asserted once static_content has the docs.missing_* keys (pre-migration they
 * render '' — reported as SKIPPED, not failed).
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

const BERLIN_QUESTIONNAIRE = '30000000-0000-0000-0000-000000000001'
const PANKOW_PLZ = '13187'
const PENSION_LOOP_PROMPT = 'Möchten Sie weitere Renten hinzufügen?' // applicant group (exact)

// Tiny but valid PDF for uploads.
const PDF_BYTES = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 10 10]>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\n%%EOF\n'
)

// ── Cleanup (survives failures — the 2026-07-21 leak lesson) ──────────────────
let cleanupUserId: string | null = null
let cleanupCaseId: string | null = null

test.afterEach(async () => {
  if (cleanupCaseId) {
    const { data: objects } = await adminDb.storage.from('case-documents').list(cleanupCaseId)
    if (objects && objects.length > 0) {
      await adminDb.storage
        .from('case-documents')
        .remove(objects.map((o) => `${cleanupCaseId}/${o.name}`))
    }
    const { data: after } = await adminDb.storage.from('case-documents').list(cleanupCaseId)
    console.log(
      `[cleanup] bucket prefix ${cleanupCaseId}: removed ${objects?.length ?? 0}, remaining ${after?.length ?? 0}`
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

// ── Drive helpers ─────────────────────────────────────────────────────────────

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

/** All Berlin question prompts, longest first, for footer-text → key lookup. */
async function loadPromptMap(): Promise<{ prompt: string; key: string }[]> {
  const { data: cats } = await adminDb
    .from('category')
    .select('id')
    .eq('questionnaire_id', BERLIN_QUESTIONNAIRE)
  const ids = (cats ?? []).map((c: { id: string }) => c.id)
  const { data: qs } = await adminDb
    .from('question')
    .select('key, prompt_de')
    .in('category_id', ids)
  return ((qs ?? []) as { key: string; prompt_de: string }[])
    .map((q) => ({ prompt: q.prompt_de, key: q.key }))
    .sort((a, b) => b.prompt.length - a.prompt.length)
}

/** DOM snapshot of the document area: slots grouped under their headings. */
async function readSlots(page: Page) {
  return page.$$eval('section[data-testid=document-area] > div', (groups) => {
    const out: { heading: string; name: string; status: string }[] = []
    for (const g of groups) {
      const heading = g.querySelector('h3')?.textContent?.trim() ?? ''
      for (const slot of g.querySelectorAll('[data-testid=doc-slot]')) {
        out.push({
          heading,
          name: slot.querySelector('p')?.textContent?.trim() ?? '',
          status: slot.querySelector('[data-testid=slot-status]')?.textContent?.trim() ?? '',
        })
      }
    }
    return out
  })
}

async function counterState(page: Page) {
  const el = page.locator('[data-testid=missing-docs-counter]')
  if ((await el.count()) === 0) return null
  return {
    missing: Number(await el.getAttribute('data-missing')),
    text: (await el.textContent())?.trim() ?? '',
  }
}

/** Answer rows as comparable value tuples (updated_at deliberately excluded —
 *  the A5 flip rewrites one value and restores it; values must round-trip). */
async function answerSnapshot(caseId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (adminDb as any)
    .from('answer')
    .select('question_id, group_instance, value')
    .eq('case_id', caseId)
  return JSON.stringify(
    (data as { question_id: string; group_instance: string; value: unknown }[])
      .map((r) => [r.question_id, r.group_instance, JSON.stringify(r.value)])
      .sort((a, b) => (a[0] + a[1] < b[0] + b[1] ? -1 : 1))
  )
}

async function uploadToFirstMissingSlot(page: Page) {
  const slot = page
    .locator('[data-testid=doc-slot]', { has: page.locator('[data-testid=slot-status]') })
    .filter({ has: page.getByText('Fehlt', { exact: true }) })
    .first()
  const name = (await slot.locator('p').first().textContent())?.trim()
  await slot.locator('input[type=file]').setInputFiles({
    name: 'm6-test.pdf',
    mimeType: 'application/pdf',
    buffer: PDF_BYTES,
  })
  return name
}

// ── The suite ─────────────────────────────────────────────────────────────────

test.setTimeout(900_000)

test('M6: slots (A1-A3), counter (A4), liveness (A5), independence (A6)', async ({ page }) => {
  const promptMap = await loadPromptMap()

  // Document names asserted below come from the live catalog, not hardcoded.
  const { data: docs } = await adminDb
    .from('document_catalog')
    .select('id, name_de')
    .in('id', ['DOC-0001', 'DOC-0002', 'DOC-0003', 'DOC-0018'])
  const docName = Object.fromEntries(
    (docs as { id: string; name_de: string }[]).map((d) => [d.id, d.name_de])
  )
  console.log('[setup] catalog names:', docName)

  // ── Create test user ────────────────────────────────────────────────────────
  const email = `pw-m6docs+${Date.now()}@hzp-test.invalid`
  const password = 'TestPassw0rd!'
  const { data: userData, error: userErr } = await adminDb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: 'Playwright', last_name: 'M6' },
  })
  if (userErr) throw new Error(`createUser failed: ${userErr.message}`)
  const userId = userData!.user.id
  cleanupUserId = userId

  const now = new Date().toISOString()
  await adminDb
    .from('profiles')
    .update({
      phone: '+4915100000006',
      consent_datenschutz_at: now,
      consent_agb_at: now,
      consent_data_processing_at: now,
      consent_authority_to_act_at: now,
    })
    .eq('id', userId)
  const { data: caseRow } = await adminDb.from('cases').select('id').eq('user_id', userId).single()
  const caseId = caseRow!.id as string
  cleanupCaseId = caseId
  console.log(`[setup] user=${userId} case=${caseId}`)

  // ── Login + pre-questionnaire (care home, Pankow PLZ) ───────────────────────
  await page.goto(`${BASE}/login`)
  await page.locator('[name=email]').fill(email)
  await page.locator('[name=password]').fill(password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await page.waitForURL(`${BASE}/case`, { timeout: 20_000 })
  await page.locator('#care_home_id').selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Pflegeheim bestätigen' }).click()
  await page.waitForTimeout(2_000)
  await page.locator('#plz_input').fill(PANKOW_PLZ)
  await page.getByRole('button', { name: 'Postleitzahl bestätigen' }).click()
  await page.waitForTimeout(3_000)
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1_500)

  // ── Adaptive drive: married, 2 applicant pensions, disability Nein ──────────
  // Select answers by question KEY (via prompt map): deterministic fixture.
  const selectOverrides: Record<string, string> = {
    marital_status: 'verheiratet',
    pension_type: 'Altersrente',
    spouse_pension_type: 'Altersrente',
    disability_card: 'Nein',
    spouse_disability_card: 'Nein',
    disablity_card_application: 'Nein', // live DB key (typo is historical, D8)
    spouse_disability_card_application: 'Nein',
  }
  let pensionAdds = 0
  let stuckCount = 0

  for (let step = 1; step <= 300 && stuckCount < 5; step++) {
    if (
      await page
        .locator('[data-testid=document-area]')
        .isVisible({ timeout: 200 })
        .catch(() => false)
    ) {
      console.log(`[step ${step}] document area visible — questionnaire complete`)
      break
    }
    const done = await page
      .getByText('Angaben werden geprüft', { exact: false })
      .isVisible({ timeout: 200 })
      .catch(() => false)
    if (done) {
      console.log(`[step ${step}] locked banner — complete`)
      break
    }

    const footer = page.locator('.shrink-0.border-t').last()
    const footerText = (await footer.textContent({ timeout: 500 }).catch(() => '')) ?? ''

    // Group prompt: add a 2nd applicant pension once, otherwise continue.
    const neinWeiter = page.getByRole('button', { name: 'Nein, weiter' })
    if (await neinWeiter.isVisible({ timeout: 250 }).catch(() => false)) {
      const isPensionPrompt = footerText.includes(PENSION_LOOP_PROMPT)
      if (isPensionPrompt && pensionAdds < 1) {
        await page.getByRole('button', { name: 'Ja, hinzufügen' }).click()
        pensionAdds++
        console.log(`[step ${step}] pension group → Ja, hinzufügen (instance 2)`)
      } else {
        await neinWeiter.click()
      }
      await page.waitForTimeout(200)
      await waitForIdle(page)
      stuckCount = 0
      continue
    }

    // yes_no radios (hat_rente is Berlin's only yes_no) → Ja to open pensions.
    const jaRadio = footer.locator('input[type=radio][value="Ja"]')
    if (await jaRadio.isVisible({ timeout: 250 }).catch(() => false)) {
      await jaRadio.click()
      await clickWeiter(page)
      console.log(`[step ${step}] yes_no → Ja ("${footerText.substring(0, 60).trim()}")`)
      stuckCount = 0
      continue
    }

    // single_select
    const sel = footer.locator('select')
    if (await sel.isVisible({ timeout: 250 }).catch(() => false)) {
      const key = promptMap.find((p) => footerText.includes(p.prompt))?.key
      const options = await sel.evaluate((s: HTMLSelectElement) =>
        Array.from(s.options)
          .filter((o) => o.value !== '')
          .map((o) => o.value)
      )
      const wanted = key ? selectOverrides[key] : undefined
      const chosen =
        wanted && options.includes(wanted)
          ? wanted
          : options.includes('Nein')
            ? 'Nein'
            : (options[0] ?? '')
      if (chosen) await sel.selectOption({ value: chosen })
      if (wanted) console.log(`[step ${step}] ${key} → "${chosen}"`)
      await clickWeiter(page)
      stuckCount = 0
      continue
    }

    // date
    const dateIn = footer.locator('input[type=date]')
    if (await dateIn.isVisible({ timeout: 250 }).catch(() => false)) {
      await dateIn.fill('1960-06-15')
      await clickWeiter(page)
      stuckCount = 0
      continue
    }

    // number / amount
    const numIn = footer.locator('input[type=number]')
    if (await numIn.isVisible({ timeout: 250 }).catch(() => false)) {
      await numIn.fill('100')
      await clickWeiter(page)
      stuckCount = 0
      continue
    }

    // short_text — realistic values where the field is recognizable
    const textIn = footer.locator('input[type=text]').first()
    if (await textIn.isVisible({ timeout: 250 }).catch(() => false)) {
      const value = footerText.includes('IBAN')
        ? 'DE89370400440532013000'
        : footerText.includes('BIC')
          ? 'MARKDEF1100'
          : footerText.toLowerCase().includes('e-mail')
            ? 'test@example.org'
            : 'Müller'
      await textIn.fill(value)
      await clickWeiter(page)
      stuckCount = 0
      continue
    }

    // multi_select (only disability markers in Berlin — hidden on this path)
    const chk = footer.locator('input[type=checkbox]').first()
    if (await chk.isVisible({ timeout: 250 }).catch(() => false)) {
      await chk.click()
      await clickWeiter(page)
      console.log(`[step ${step}] multi_select → first option`)
      stuckCount = 0
      continue
    }

    stuckCount++
    console.log(`[step ${step}] STUCK (count=${stuckCount})`)
    await page.screenshot({ path: `test-results/m6-stuck-${step}.png` })
    await page.waitForTimeout(2_000)
  }

  await page.reload()
  await page.waitForLoadState('networkidle')
  const area = page.locator('[data-testid=document-area]')
  await expect(area, 'document area must render after completion').toBeVisible({ timeout: 15_000 })

  // ── Ground truth: case is under_review ──────────────────────────────────────
  const { data: c0 } = await adminDb.from('cases').select('status').eq('id', caseId).single()
  expect(c0!.status, 'case must be under_review after the drive').toBe('under_review')

  // ── A1 / A2 / A3 — slot asserts ─────────────────────────────────────────────
  const slots = await readSlots(page)
  console.log(`[slots] ${slots.length} total:`)
  for (const s of slots) console.log(`   [${s.heading}] ${s.name} (${s.status})`)

  const person1 = slots.filter((s) => s.heading === 'Ihre Unterlagen')
  const person2 = slots.filter((s) => s.heading === 'Unterlagen Ihres Partners')
  expect(person2.length, 'married path must produce person_2 slots').toBeGreaterThan(0)

  // A1: two applicant pensions → two pension-notice slots
  const p1Pension = person1.filter((s) => s.name.startsWith(docName['DOC-0002']))
  expect(p1Pension, 'A1: exactly 2 applicant pension-notice slots').toHaveLength(2)
  expect(p1Pension.map((s) => s.name).join(' | ')).toContain('Rente 1')
  expect(p1Pension.map((s) => s.name).join(' | ')).toContain('Rente 2')

  // A2: disability Nein → no disability-card slot anywhere
  const disabilitySlots = slots.filter((s) => s.name.includes(docName['DOC-0018']))
  expect(disabilitySlots, 'A2: no disability-card slot when disability_card=Nein').toHaveLength(0)

  // A3: spouse identity (PAN-002), spouse pension per instance (PAN-004),
  //     spouse bank per account (PAN-006 — giro only on this fixture)
  expect(
    person2.filter((s) => s.name.startsWith(docName['DOC-0001'])),
    'A3: PAN-002 spouse identity slot'
  ).toHaveLength(1)
  expect(
    person2.filter((s) => s.name.startsWith(docName['DOC-0002'])),
    'A3: PAN-004 one slot per spouse pension instance (1 driven)'
  ).toHaveLength(1)
  const spouseBank = person2.filter((s) => s.name.startsWith(docName['DOC-0003']))
  expect(spouseBank, 'A3: PAN-006 one slot per spouse bank account (giro only)').toHaveLength(1)
  expect(spouseBank[0].name, 'A3: spouse bank slot is the Girokonto').toContain('Girokonto')

  // ── A4 — counter vs DOM ─────────────────────────────────────────────────────
  const missingInDom = slots.filter((s) => s.status === 'Fehlt').length
  let counter = await counterState(page)
  const stringsLive = counter !== null && counter.text.length > 0
  if (counter === null) {
    console.log('[A4] SKIPPED — counter not deployed yet')
  } else {
    expect(counter.missing, 'A4: data-missing == DOM missing-slot count').toBe(missingInDom)
    if (stringsLive) {
      expect(counter.text, 'A4: plural missing string').toBe(
        `Es fehlen noch ${counter.missing} Dokumente.`
      )
    } else {
      console.log('[A4] counter numeric OK; German strings SKIPPED (migration not applied yet)')
    }
  }

  // ── A6 setup: snapshot answers + status ─────────────────────────────────────
  const answersBefore = await answerSnapshot(caseId)

  // ── A4: upload one → n-1; delete it → n+1 ───────────────────────────────────
  const n0 = missingInDom
  const uploadedSlotName = await uploadToFirstMissingSlot(page)
  await expect
    .poll(async () => (await readSlots(page)).filter((s) => s.status === 'Fehlt').length, {
      timeout: 30_000,
    })
    .toBe(n0 - 1)
  counter = await counterState(page)
  if (counter) expect(counter.missing, 'A4: counter decrements on upload').toBe(n0 - 1)
  console.log(`[A4] uploaded to "${uploadedSlotName}" → missing ${n0} → ${n0 - 1}`)

  await page.getByRole('button', { name: 'Entfernen' }).first().click()
  await expect
    .poll(async () => (await readSlots(page)).filter((s) => s.status === 'Fehlt').length, {
      timeout: 30_000,
    })
    .toBe(n0)
  counter = await counterState(page)
  if (counter) expect(counter.missing, 'A4: counter increments on delete').toBe(n0)
  console.log(`[A4] deleted upload → missing back to ${n0}`)

  // ── A6: upload/delete changed neither status nor answers ────────────────────
  const { data: c1 } = await adminDb.from('cases').select('status').eq('id', caseId).single()
  expect(c1!.status, 'A6: status unchanged by upload/delete').toBe('under_review')
  expect(await answerSnapshot(caseId), 'A6: answers unchanged by upload/delete').toBe(answersBefore)

  // ── A5 — LIVENESS (service-role DB write: TEST-ONLY, not a product path) ────
  const { data: cats } = await adminDb
    .from('category')
    .select('id')
    .eq('questionnaire_id', BERLIN_QUESTIONNAIRE)
  const { data: dq } = await adminDb
    .from('question')
    .select('id')
    .eq('key', 'disability_card')
    .in(
      'category_id',
      (cats ?? []).map((x: { id: string }) => x.id)
    )
    .single()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: dAnswer } = await (adminDb as any)
    .from('answer')
    .select('id, value')
    .eq('case_id', caseId)
    .eq('question_id', dq!.id)
    .single()
  expect(dAnswer.value, 'fixture answered disability_card=Nein').toBe('Nein')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adminDb as any).from('answer').update({ value: 'Ja' }).eq('id', dAnswer.id)
  await page.reload()
  await page.waitForLoadState('networkidle')
  const slotsFlipped = await readSlots(page)
  const disabilityAfterFlip = slotsFlipped.filter((s) => s.name.includes(docName['DOC-0018']))
  expect(disabilityAfterFlip, 'A5: disability slot APPEARS after Nein→Ja flip').toHaveLength(1)
  expect(
    slotsFlipped.filter((s) => s.status === 'Fehlt').length,
    'A5: missing count incremented by the new slot'
  ).toBe(n0 + 1)
  counter = await counterState(page)
  if (counter) expect(counter.missing, 'A5: counter shows the new requirement').toBe(n0 + 1)
  console.log('[A5] flip Nein→Ja: slot appeared, count incremented')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adminDb as any).from('answer').update({ value: 'Nein' }).eq('id', dAnswer.id)
  await page.reload()
  await page.waitForLoadState('networkidle')
  const slotsRestored = await readSlots(page)
  expect(
    slotsRestored.filter((s) => s.name.includes(docName['DOC-0018'])),
    'A5: slot disappears after flip-back'
  ).toHaveLength(0)
  expect(slotsRestored.filter((s) => s.status === 'Fehlt').length, 'A5: count restored').toBe(n0)
  console.log('[A5] flip back Ja→Nein: slot gone, count restored — requirements are LIVE')

  // ── A4 completion states: fill every slot → 0, delete one → singular ────────
  if (counter !== null) {
    let guard = 0
    while (guard++ < 40) {
      const missing = (await readSlots(page)).filter((s) => s.status === 'Fehlt').length
      if (missing === 0) break
      await uploadToFirstMissingSlot(page)
      await expect
        .poll(async () => (await readSlots(page)).filter((s) => s.status === 'Fehlt').length, {
          timeout: 30_000,
        })
        .toBe(missing - 1)
    }
    counter = await counterState(page)
    expect(counter!.missing, 'A4: all slots filled → 0 missing').toBe(0)
    if (stringsLive) {
      expect(counter!.text, 'A4: complete-state string').toBe(
        'Alle erforderlichen Dokumente sind hochgeladen.'
      )
    }
    console.log('[A4] all slots uploaded → complete state shown')

    await page.getByRole('button', { name: 'Entfernen' }).first().click()
    await expect.poll(async () => (await counterState(page))!.missing, { timeout: 30_000 }).toBe(1)
    if (stringsLive) {
      expect((await counterState(page))!.text, 'A4: singular string').toBe(
        'Es fehlt noch 1 Dokument.'
      )
    }
    console.log('[A4] one deleted → singular state shown')
  } else {
    console.log('[A4] completion-state exercise SKIPPED (counter not deployed)')
  }

  // ── Final A6 re-check after all upload/delete traffic ───────────────────────
  const { data: c2 } = await adminDb.from('cases').select('status').eq('id', caseId).single()
  expect(c2!.status, 'A6: status still under_review at the end').toBe('under_review')
  expect(await answerSnapshot(caseId), 'A6: answers byte-identical at the end').toBe(answersBefore)

  console.log('\n══════════ M6 ACCEPTANCE RESULTS ══════════')
  console.log(`A1 pension slots (2 driven):      PASS`)
  console.log(`A2 no disability slot on Nein:    PASS`)
  console.log(`A3 spouse identity/pension/bank:  PASS`)
  console.log(
    `A4 counter:                       ${counter === null ? 'SKIPPED (not deployed)' : stringsLive ? 'PASS (incl. strings)' : 'PASS numeric (strings pending migration)'}`
  )
  console.log(`A5 liveness (flip via DB write):  PASS — TEST-ONLY technique, not a product path`)
  console.log(`A6 upload independence:           PASS`)
  console.log('════════════════════════════════════════════\n')
})
