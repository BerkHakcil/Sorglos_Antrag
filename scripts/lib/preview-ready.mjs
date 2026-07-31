/**
 * Preview readiness gate.
 *
 * ⚠ AN HTTP 200 FROM A VERCEL PREVIEW DOES NOT MEAN READY. While a deployment
 * builds, Vercel serves a "Deployment is building" holding page **with status
 * 200**. A poll that waits for 200 therefore returns immediately and everything
 * downstream runs against a page that has none of the app on it.
 *
 * That is not hypothetical: the first E-5 preview suite returned 10 failed /
 * 3 passed in 15.1 minutes, tripping the tripwire, purely because the readiness
 * poll accepted a 200 from that holding page. Re-run against the ready
 * deployment: 13/13 green in 3.3 min.
 *
 * Gate on CONTENT (an element only the real app renders) or on the deployment's
 * readyState from the Vercel API. Never on the status code.
 */

/** Text Vercel renders on its build placeholder. */
const BUILDING_MARKER = 'Deployment is building'

/**
 * Navigate to `url` and return only once the real app is being served.
 * Throws with a clear message on the holding page rather than letting a later
 * selector time out and look like a product failure.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} url            full URL to open
 * @param {string} readySelector  a selector only the real page renders
 */
export async function gotoWhenReady(page, url, readySelector, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    await page.goto(url)
    const building = await page
      .getByText(BUILDING_MARKER, { exact: false })
      .isVisible({ timeout: 1_000 })
      .catch(() => false)
    if (!building) {
      const ok = await page
        .locator(readySelector)
        .isVisible({ timeout: 15_000 })
        .catch(() => false)
      if (ok) return
    }
    if (Date.now() > deadline) {
      throw new Error(
        `Preview never became ready within ${Math.round(timeoutMs / 1000)}s: ${url}\n` +
          (building
            ? 'Still showing Vercel\'s "Deployment is building" page — the deployment is not READY.'
            : `Page loaded but ${readySelector} never appeared.`)
      )
    }
    await page.waitForTimeout(5_000)
  }
}
