/**
 * E-4 document-state gallery — the checklist at three fill levels, which the
 * general gallery script does not reach (it only ever shows the empty list).
 *
 *   node scripts/ui-gallery-docs.mjs <sub-phase> [--base <url>]
 *
 * States, each at 1280x800 and 375x812:
 *   01-docs-empty   nothing uploaded yet — every row outstanding
 *   02-docs-mixed   two slots filled — the tint/medallion contrast is visible
 *   03-docs-full    every visible slot filled — the all-uploaded counter
 *
 * The uploads are real: a tiny synthetic PDF goes through the actual
 * signed-URL flow, so these shots show the true uploaded-row rendering
 * rather than a mocked one. They are deleted with the account.
 *
 * ⚠ PRIVACY — the repo is PUBLIC. Throwaway account, synthetic answers, a
 * one-page PDF containing only the word "Musterdokument". Deleted in
 * `finally`. A real pilot case is never photographed.
 */

import { createClient } from '@supabase/supabase-js'
import { chromium } from '@playwright/test'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { config } from 'dotenv'

config({ path: '.env.local' })

const subPhase = process.argv[2]
if (!subPhase) {
  console.error('Usage: node scripts/ui-gallery-docs.mjs <sub-phase> [--base <url>]')
  process.exit(1)
}
const baseIdx = process.argv.indexOf('--base')
const BASE =
  baseIdx > -1 ? process.argv[baseIdx + 1] : (process.env.E2E_BASE_URL ?? 'http://localhost:3000')
const OUT = join('docs', 'feedback', 'ui-gallery', subPhase)
mkdirSync(OUT, { recursive: true })

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
const extraHTTPHeaders = bypass
  ? { 'x-vercel-protection-bypass': bypass, 'x-vercel-set-bypass-cookie': 'true' }
  : {}

const DESKTOP = { width: 1280, height: 800 }
const MOBILE = { width: 375, height: 812 }

// Minimal valid one-page PDF.
const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]>>endobj\n' +
    'trailer<</Root 1 0 R>>\n%%EOF\n',
  'utf8'
)

const email = `pw-docsgallery+${Date.now()}@hzp-test.invalid`
const { data: u, error: ue } = await admin.auth.admin.createUser({
  email,
  password: 'TestPassw0rd!',
  email_confirm: true,
  user_metadata: { first_name: 'Maria', last_name: 'Musterfrau' },
})
if (ue) throw ue
const userId = u.user.id
const now = new Date().toISOString()
await admin
  .from('profiles')
  .update({
    phone: '+4915100000000',
    consent_datenschutz_at: now,
    consent_agb_at: now,
    consent_data_processing_at: now,
    consent_authority_to_act_at: now,
  })
  .eq('id', userId)

const browser = await chromium.launch()

async function shoot(page, name) {
  for (const [tag, vp] of [
    ['desktop', DESKTOP],
    ['mobile', MOBILE],
  ]) {
    await page.setViewportSize(vp)
    await page.waitForTimeout(400)
    await page.screenshot({ path: join(OUT, `${name}-${tag}.png`), fullPage: true })
    console.log(`   ${name}-${tag}.png`)
  }
  await page.setViewportSize(DESKTOP)
}

/** Upload the synthetic PDF into the nth outstanding slot. */
async function fillSlot(page, index) {
  const slot = page.locator('[data-testid=doc-slot]').nth(index)
  const input = slot.locator('input[type=file]')
  await input.setInputFiles({
    name: 'Musterdokument.pdf',
    mimeType: 'application/pdf',
    buffer: PDF,
  })
  // The row re-renders through router.refresh() once the metadata row lands.
  await page
    .locator('[data-testid=doc-slot]')
    .nth(index)
    .getByText('Musterdokument.pdf')
    .waitFor({ state: 'visible', timeout: 30_000 })
}

try {
  const ctx = await browser.newContext({ viewport: DESKTOP, extraHTTPHeaders })
  const page = await ctx.newPage()

  await page.goto(`${BASE}/login`)
  await page.locator('[name=email]').fill(email)
  await page.locator('[name=password]').fill('TestPassw0rd!')
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await page.waitForURL(`${BASE}/case`, { timeout: 20_000 })

  await page.locator('#care_home_id').selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Pflegeheim bestätigen' }).click()
  await page.locator('#plz_input').waitFor({ state: 'visible', timeout: 20_000 })
  await page.locator('#plz_input').fill('13187')
  await page.getByRole('button', { name: 'Postleitzahl bestätigen' }).click()
  await page.locator('[data-testid=answer-footer]').waitFor({ state: 'visible', timeout: 30_000 })

  await page.getByTestId('tab-documents').click()
  await page.locator('[data-testid=document-area]').waitFor({ state: 'visible', timeout: 30_000 })
  const total = await page.locator('[data-testid=doc-slot]').count()
  console.log(`   [docs] ${total} slots on a fresh Berlin case`)

  await shoot(page, '01-docs-empty')

  await fillSlot(page, 0)
  await fillSlot(page, 1)
  await shoot(page, '02-docs-mixed')

  for (let i = 2; i < total; i++) await fillSlot(page, i)
  await shoot(page, '03-docs-full')

  await ctx.close()
} finally {
  await browser.close()
  const { error } = await admin.auth.admin.deleteUser(userId)
  console.log(error ? `CLEANUP FAILED: ${error.message}` : `[docs-gallery] deleted ${email}`)
}
console.log(`\n[docs-gallery] written to ${OUT}`)
