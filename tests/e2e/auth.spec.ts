import { test, expect, type Page } from '@playwright/test'

/**
 * Auth flow — end-to-end test.
 *
 * Prerequisite: Supabase Auth must have email confirmation DISABLED
 * (Dashboard → Auth → Email → "Confirm email" toggle off) so that
 * signUp returns a session immediately and the test can redirect to /case.
 *
 * Each CI run creates one test user. Users accumulate in the Supabase project
 * and can be deleted in bulk via the Auth dashboard when needed.
 */

// Unique email per test run prevents conflicts on re-runs.
const RUN_EMAIL = `playwright+${Date.now()}@hzp-test.invalid`
const PASSWORD = 'TestPassw0rd!'
// Valid German mobile number in national format (PhoneInput adds +49).
const VALID_PHONE_NATIONAL = '015123456789'

/**
 * Fills all signup fields using the visible form controls.
 * Phone is typed into the react-phone-number-input number input
 * (data-testid="phone-input") in national format; the library converts
 * it to E.164 (+4915123456789) and updates RHF state.
 */
async function fillSignupForm(
  page: Page,
  overrides: {
    firstName?: string
    lastName?: string
    phone?: string | false
    email?: string
    password?: string
    checkDatenschutz?: boolean
    checkAgb?: boolean
    checkDataProcessing?: boolean
    checkAuthorityToAct?: boolean
  } = {}
) {
  const {
    firstName = 'Playwright',
    lastName = 'Test',
    phone = VALID_PHONE_NATIONAL,
    email = RUN_EMAIL,
    password = PASSWORD,
    checkDatenschutz = true,
    checkAgb = true,
    checkDataProcessing = true,
    checkAuthorityToAct = true,
  } = overrides

  await page.locator('[name=first_name]').fill(firstName)
  await page.locator('[name=last_name]').fill(lastName)
  if (phone !== false) {
    await page.locator('[data-testid=phone-input]').fill(phone)
  }
  await page.locator('[name=email]').fill(email)
  await page.locator('[name=password]').fill(password)
  if (checkDatenschutz) await page.locator('[name=consent_datenschutz]').check()
  if (checkAgb) await page.locator('[name=consent_agb]').check()
  if (checkDataProcessing) await page.locator('[name=consent_data_processing]').check()
  if (checkAuthorityToAct) await page.locator('[name=consent_authority_to_act]').check()
}

// serial: tests 2–8 depend on the user created in test 1.
test.describe.serial('Auth flow', () => {
  // ── 1. Signup ────────────────────────────────────────────

  test('signup → redirects to /case, shows case id', async ({ page }) => {
    await page.goto('/signup')
    await fillSignupForm(page)
    await page.getByRole('button', { name: 'Registrieren' }).click()

    // Email confirmation must be off; otherwise the test user sees a success
    // message and never reaches /case — the test would time out here.
    await page.waitForURL('/case', { timeout: 15_000 })

    await expect(page.getByRole('heading', { name: 'Mein Antrag' })).toBeVisible()

    const caseIdCell = page.locator('dl dd').first()
    await expect(caseIdCell).toHaveText(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
    )
  })

  // ── 2. Email already registered → German error, inline ────
  //
  // Depends on test 1 having created the user with RUN_EMAIL.
  // Tests the Supabase "User already registered" → German mapping.

  test('signup with existing email → German "already registered" error inline', async ({
    page,
  }) => {
    await page.goto('/signup')
    await fillSignupForm(page) // same RUN_EMAIL
    await page.getByRole('button', { name: 'Registrieren' }).click()

    // Server responds with emailTaken mapped to German.
    const emailError = page.locator('#email-error')
    await expect(emailError).toBeVisible({ timeout: 10_000 })
    await expect(emailError).toContainText('bereits registriert')
    await expect(page).toHaveURL(/\/signup/)
  })

  // ── 3. Invalid email format → German error inline (no browser bubble) ───

  test('invalid email format → German error inline, not a native browser bubble', async ({
    page,
  }) => {
    await page.goto('/signup')
    await fillSignupForm(page, { email: 'kein-at-zeichen' })
    await page.getByRole('button', { name: 'Registrieren' }).click()

    // noValidate means the browser never shows its own bubble.
    // Zod shows our German message inline below the email field.
    const emailError = page.locator('#email-error')
    await expect(emailError).toBeVisible()
    await expect(emailError).toContainText('E-Mail')
    // Verify it is NOT the browser's native "Please include an '@' in the email address."
    await expect(emailError).not.toContainText('@')
    await expect(page).toHaveURL(/\/signup/)
  })

  // ── 4. Phone missing → German error inline ──────────────────────────────

  test('signup without phone → German phone-required error inline', async ({ page }) => {
    await page.goto('/signup')
    await fillSignupForm(page, {
      phone: false,
      email: `no-phone+${Date.now()}@hzp-test.invalid`,
    })
    await page.getByRole('button', { name: 'Registrieren' }).click()

    const phoneError = page.locator('#phone-error')
    await expect(phoneError).toBeVisible()
    await expect(phoneError).toContainText('Telefonnummer')
    await expect(page).toHaveURL(/\/signup/)
  })

  // ── 5. Phone invalid → German error inline ──────────────────────────────

  test('signup with invalid phone → German invalid-phone error inline', async ({ page }) => {
    await page.goto('/signup')
    await fillSignupForm(page, {
      phone: '12', // too short to be a valid number
      email: `bad-phone+${Date.now()}@hzp-test.invalid`,
    })
    await page.getByRole('button', { name: 'Registrieren' }).click()

    const phoneError = page.locator('#phone-error')
    await expect(phoneError).toBeVisible()
    await expect(phoneError).toContainText('gültige Telefonnummer')
    await expect(page).toHaveURL(/\/signup/)
  })

  // ── 6. Failed submit preserves all field values ──────────────────────────
  //
  // After a validation error, no field should be cleared.

  test('failed submit preserves all entered values and checkbox states', async ({ page }) => {
    await page.goto('/signup')

    const testEmail = `preserve+${Date.now()}@hzp-test.invalid`

    await page.locator('[name=first_name]').fill('EinVorname')
    await page.locator('[name=last_name]').fill('EinNachname')
    await page.locator('[data-testid=phone-input]').fill(VALID_PHONE_NATIONAL)
    await page.locator('[name=email]').fill(testEmail)
    await page.locator('[name=password]').fill('kurz') // too short — triggers error
    await page.locator('[name=consent_datenschutz]').check()
    await page.locator('[name=consent_agb]').check()
    await page.locator('[name=consent_data_processing]').check()
    await page.locator('[name=consent_authority_to_act]').check()

    await page.getByRole('button', { name: 'Registrieren' }).click()

    // Password error shown inline.
    await expect(page.locator('#password-error')).toBeVisible()

    // All text fields still have their values.
    await expect(page.locator('[name=first_name]')).toHaveValue('EinVorname')
    await expect(page.locator('[name=last_name]')).toHaveValue('EinNachname')
    await expect(page.locator('[name=email]')).toHaveValue(testEmail)
    await expect(page.locator('[name=password]')).toHaveValue('kurz')

    // Phone input is not blank.
    await expect(page.locator('[data-testid=phone-input]')).not.toHaveValue('')

    // All four checkboxes remain checked.
    await expect(page.locator('[name=consent_datenschutz]')).toBeChecked()
    await expect(page.locator('[name=consent_agb]')).toBeChecked()
    await expect(page.locator('[name=consent_data_processing]')).toBeChecked()
    await expect(page.locator('[name=consent_authority_to_act]')).toBeChecked()
  })

  // ── 7a. Missing Datenschutz → German error ──────────────────────────────

  test('signup without Datenschutz consent → German consent error shown', async ({ page }) => {
    await page.goto('/signup')
    await fillSignupForm(page, {
      email: `no-dsgvo+${Date.now()}@hzp-test.invalid`,
      checkDatenschutz: false,
    })
    await page.getByRole('button', { name: 'Registrieren' }).click()

    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText('Bedingungen')
    await expect(page).toHaveURL(/\/signup/)
  })

  // ── 7b. Missing AGB (but Datenschutz checked) → German error ────────────

  test('signup without AGB consent → German consent error shown', async ({ page }) => {
    await page.goto('/signup')
    await fillSignupForm(page, {
      email: `no-agb+${Date.now()}@hzp-test.invalid`,
      checkAgb: false,
    })
    await page.getByRole('button', { name: 'Registrieren' }).click()

    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText('Bedingungen')
    await expect(page).toHaveURL(/\/signup/)
  })

  // ── 7c. Missing authority-to-act → German error ──────────────────────────

  test('signup without authority-to-act consent → German consent error shown', async ({
    page,
  }) => {
    await page.goto('/signup')
    await fillSignupForm(page, {
      email: `no-auth+${Date.now()}@hzp-test.invalid`,
      checkAuthorityToAct: false,
    })
    await page.getByRole('button', { name: 'Registrieren' }).click()

    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText('Bedingungen')
    await expect(page).toHaveURL(/\/signup/)
  })

  // ── 8. Logout ────────────────────────────────────────────

  test('logout → redirects to /login', async ({ page }) => {
    await page.goto('/login')
    await page.locator('[name=email]').fill(RUN_EMAIL)
    await page.locator('[name=password]').fill(PASSWORD)
    await page.getByRole('button', { name: 'Anmelden' }).click()
    await page.waitForURL('/case', { timeout: 15_000 })

    await page.getByRole('button', { name: 'Abmelden' }).click()
    await expect(page).toHaveURL(/\/login/)
  })

  // ── 9. Login ─────────────────────────────────────────────

  test('login → redirects to /case', async ({ page }) => {
    await page.goto('/login')
    await page.locator('[name=email]').fill(RUN_EMAIL)
    await page.locator('[name=password]').fill(PASSWORD)
    await page.getByRole('button', { name: 'Anmelden' }).click()

    await page.waitForURL('/case', { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Mein Antrag' })).toBeVisible()
  })

  // ── 10. Auth guard ────────────────────────────────────────

  test('unauthenticated GET /case → redirects to /login', async ({ page }) => {
    await page.goto('/case')
    await expect(page).toHaveURL(/\/login/)
  })

  // ── 11. Wrong password ───────────────────────────────────

  test('login with wrong password → shows error', async ({ page }) => {
    await page.goto('/login')
    await page.locator('[name=email]').fill(RUN_EMAIL)
    await page.locator('[name=password]').fill('WrongPassw0rd!')
    await page.getByRole('button', { name: 'Anmelden' }).click()

    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })
})
