import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    /**
     * Vercel preview deployments are behind Vercel Authentication
     * (ssoProtection: all_except_custom_domains), so an unauthenticated
     * request 302s to vercel.com/sso-api. With a Protection-Bypass-for-
     * Automation secret in .env.local the suite can drive the real preview.
     *
     * `x-vercel-set-bypass-cookie` is not optional: without it only the first
     * document request is bypassed and every client-side navigation bounces
     * back to SSO. The secret is a credential — .env.local only, never
     * committed, never echoed into logs or screenshots.
     */
    extraHTTPHeaders: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? {
          'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
          'x-vercel-set-bypass-cookie': 'true',
        }
      : {},
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  /**
   * Only spin up a local dev server when the suite is actually pointed at
   * localhost. With E2E_BASE_URL set to a preview or prod URL, starting a
   * local server is pointless (and, on a machine with :3000 busy, fatal).
   */
  webServer:
    process.env.E2E_BASE_URL && !process.env.E2E_BASE_URL.includes('localhost')
      ? undefined
      : {
          command: 'npm run dev',
          url: 'http://localhost:3000',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
})
