/**
 * App-wide legal footer (post-Batch-C mini round, 2026-08-13): Impressum ·
 * Datenschutz · AGB on every screen — auth and case (pre-steps and
 * questionnaire states share the same slot, outside the content ternary).
 *
 * URLs are deliberately hardcoded rather than imported from lib/legal-links.ts
 * (asserting the constant against itself would prove nothing — auth.spec
 * precedent). All three probed HTTP 200 on 2026-08-13; the bare /impressum is
 * 404 on the marketing site, /hzp/impressum is the live page.
 *
 * The mobile no-collision guarantee is structural (the footer is a sibling
 * BELOW the chat column inside the h-dvh shell, not an overlay) and is proven
 * end-to-end by mobile-footer.spec.ts running against the same build; here we
 * assert the footer itself stays in-viewport at the mobile size.
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

const LINKS = [
  { label: 'Impressum', href: 'https://www.sorglosantrag.de/hzp/impressum' },
  { label: 'Datenschutz', href: 'https://www.sorglosantrag.de/hzp/datenschutz' },
  { label: 'AGB', href: 'https://www.sorglosantrag.de/hzp/agb' },
]

async function expectFooterLinks(page: Page) {
  const footer = page.locator('[data-testid=legal-footer]')
  await expect(footer).toBeVisible()
  for (const { label, href } of LINKS) {
    const link = footer.locator(`a[href="${href}"]`)
    await expect(link).toBeVisible()
    await expect(link).toHaveText(label)
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', /noopener/)
    await expect(link).toHaveAttribute('rel', /noreferrer/)
  }
  await expect(footer.locator('a')).toHaveCount(3)
}

let cleanupUserId: string | null = null
test.afterEach(async () => {
  if (cleanupUserId) {
    await adminDb.auth.admin
      .deleteUser(cleanupUserId)
      .catch((e) => console.error('[cleanup] deleteUser FAILED - user may be leaked:', e?.message))
    cleanupUserId = null
  }
})

test.describe('Legal footer + SVG logo', () => {
  test('F1: /login shows the footer (3 exact external links) and the SVG logo loads', async ({
    page,
  }) => {
    await page.goto(`${BASE}/login`)
    await expectFooterLinks(page)

    // Logo swap: the header/auth mark is now Roman's SVG, served as-is.
    const logo = page.locator('img[src="/logo.svg"]')
    await expect(logo).toBeVisible()
    const naturalWidth = await logo.evaluate((el: HTMLImageElement) => el.naturalWidth)
    expect(naturalWidth, 'logo.svg must actually load (naturalWidth > 0)').toBeGreaterThan(0)
  })

  test('F2: case screen (pre-steps) shows the footer inside the h-dvh shell, no page scroll', async ({
    page,
  }) => {
    const email = `pw-footer+${Date.now()}@hzp-test.invalid`
    const password = 'TestPassw0rd!'
    const { data, error } = await adminDb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: 'Playwright', last_name: 'Footer' },
    })
    if (error) throw new Error(`createUser: ${error.message}`)
    cleanupUserId = data.user.id
    const now = new Date().toISOString()
    await adminDb
      .from('profiles')
      .update({
        phone: '+4915100000011',
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

    await expectFooterLinks(page)
    // SVG logo also swapped in the case header.
    await expect(page.locator('header img[src="/logo.svg"]')).toBeVisible()

    // The footer sits inside the viewport-locked shell: fully visible with
    // the document unscrolled (desktop and mobile widths).
    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 375, height: 667 },
    ]) {
      await page.setViewportSize(viewport)
      await page.waitForTimeout(300)
      const box = await page.locator('[data-testid=legal-footer]').boundingBox()
      expect(box, 'footer must render').not.toBeNull()
      expect(
        box!.y + box!.height,
        `footer bottom must fit the ${viewport.height}px viewport`
      ).toBeLessThanOrEqual(viewport.height + 1)
      expect(await page.evaluate(() => window.scrollY)).toBe(0)
    }
  })
})
