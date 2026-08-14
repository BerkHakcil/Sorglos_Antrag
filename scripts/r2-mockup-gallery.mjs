/**
 * UI Round 2 Phase 1 — reference-gallery capture of the LIVE Lovable mockup
 * (https://sorglos-antrag-stellen.lovable.app/), repo commit 8ea545f.
 * Read-only against our own product; drives only the mockup's client-side
 * demo state. Output: docs/feedback/ui-gallery/R2-mockup-reference/.
 */
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = 'https://sorglos-antrag-stellen.lovable.app'
const OUT = 'C:/Users/Berk/Desktop/hilfe-zur-pflege/docs/feedback/ui-gallery/R2-mockup-reference'
mkdirSync(OUT, { recursive: true })

const VIEWPORTS = [
  { tag: 'desktop', width: 1280, height: 800 },
  { tag: 'mobile', width: 375, height: 812 },
]

// Tiny valid 1x1 PNG for the upload rows (synthetic, no real data).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)
const pngPath = join(process.env.TEMP ?? '.', 'r2-upload-sample.png')
writeFileSync(pngPath, PNG)

const shot = async (page, tag, name) => {
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/${name}-${tag}.png`, fullPage: false })
  console.log(`captured ${name}-${tag}`)
}

const saveBtn = (page) => page.getByRole('button', { name: 'Antwort speichern' })

async function answerText(page, value) {
  const input = page.locator('input:visible').last()
  await input.fill(value)
  await saveBtn(page).click()
}

async function run(vp) {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } })
  const t = vp.tag

  // ── Angaben: fresh ──────────────────────────────────────────────
  await page.goto(BASE + '/', { waitUntil: 'load' })
  await page.getByText('Wie lautet der Vorname').waitFor({ timeout: 20000 })
  await shot(page, t, '01-angaben-fresh')

  // Q1 vorname, Q2 nachname → Q3 date visible
  await answerText(page, 'Maria')
  await page.getByText('Und der Nachname?').waitFor()
  await answerText(page, 'Musterfrau')
  await page.getByText('Wann wurde sie geboren?').waitFor()
  await shot(page, t, '02-angaben-date-input')
  await answerText(page, '1942-03-15')

  // Q4 familienstand — choice chips
  await page.getByText('Wie ist der Familienstand?').waitFor()
  await shot(page, t, '03-angaben-choice-chips')
  await page.getByRole('button', { name: 'verheiratet' }).click()

  // Q5 einzugsdatum. NOTE: the demo's "Später beantworten" is broken —
  // a skipped entry keeps status 'skipped', and activeId returns the first
  // entry !== 'answered', so the skipped question never yields the input and
  // the italic skipped-marker state is UNREACHABLE on the live demo.
  await page.getByText('Wann ist der Einzug').waitFor()
  await answerText(page, '2026-09-01')

  // Q6 eigenesKonto — yes/no chips
  await page.getByText('eigenes Girokonto').waitFor()
  await shot(page, t, '04-angaben-yesno-chips')
  await page.getByRole('button', { name: 'Ja', exact: true }).click()

  // Q7 bank — answer, then EDIT it for the flash
  await page.getByText('Bei welcher Bank').waitFor()
  await answerText(page, 'Sparkasse Testhausen')
  await page.getByText('Wie lautet die IBAN').waitFor()
  await shot(page, t, '05-angaben-history-bubbles-aendern')

  // Edit affordance: click the last "Ändern"
  await page.getByRole('button', { name: 'Ändern' }).last().click()
  await page.locator('input:visible').last().waitFor()
  await shot(page, t, '06-angaben-edit-mode')
  await answerText(page, 'Volksbank Testhausen')
  // Flash pill "Antwort geändert" (1600 ms window)
  try {
    await page.getByText('Antwort geändert').waitFor({ timeout: 1500 })
    await page.screenshot({ path: `${OUT}/07-angaben-flash-antwort-geaendert-${t}.png` })
    console.log(`captured 07-angaben-flash-antwort-geaendert-${t}`)
  } catch {
    console.log(`WARN: flash not captured (${t})`)
  }

  // Finish remaining questions quickly
  const finish = [
    ['Wie lautet die IBAN', () => answerText(page, 'DE12 3456 7890 1234 5678 90')],
    ['monatliche Rente', () => answerText(page, '1.250,00')],
    [
      'weitere monatliche',
      () => page.getByRole('button', { name: 'Nein', exact: true }).click(),
    ],
    ['Ersparnisse', () => answerText(page, '4.800,00')],
    ['Immobilie', () => page.getByRole('button', { name: 'Nein', exact: true }).click()],
  ]
  for (const [text, act] of finish) {
    await page.getByText(text).waitFor()
    await act()
  }
  await page.getByText('Alle Fragen sind beantwortet').waitFor({ timeout: 10000 })
  await shot(page, t, '08-angaben-all-answered')

  // ── Unterlagen ─────────────────────────────────────────────────
  await page.goto(BASE + '/unterlagen', { waitUntil: 'load' })
  await page.getByText('Personalausweis').waitFor({ timeout: 20000 })
  await shot(page, t, '09-unterlagen-empty')

  // Upload into the first two rows → partial state
  const fileInputs = page.locator('input[type=file]')
  await fileInputs.nth(0).setInputFiles(pngPath)
  await page.getByText('Hochgeladen').first().waitFor()
  await fileInputs.nth(1).setInputFiles(pngPath)
  await shot(page, t, '10-unterlagen-partial-uploaded')

  // Upload the rest → all-uploaded banner, then auto-nav to /fertig (800 ms)
  const count = await fileInputs.count()
  for (let i = 2; i < count; i++) await fileInputs.nth(i).setInputFiles(pngPath)
  try {
    await page.getByText('Alle Unterlagen hochgeladen').waitFor({ timeout: 2000 })
    await page.screenshot({ path: `${OUT}/11-unterlagen-all-uploaded-banner-${t}.png` })
    console.log(`captured 11-unterlagen-all-uploaded-banner-${t}`)
  } catch {
    console.log(`WARN: all-uploaded banner not captured (${t})`)
  }
  await page.waitForURL('**/fertig', { timeout: 10000 })
  await page.getByText('Nächste Schritte').waitFor()
  await shot(page, t, '12-fertig-completion')

  // ── Hilfe sheet / mobile menu ──────────────────────────────────
  await page.goto(BASE + '/', { waitUntil: 'load' })
  await page.getByText('Wie lautet der Vorname').waitFor({ timeout: 20000 })
  if (vp.tag === 'desktop') {
    await page.getByRole('button', { name: 'Hilfe' }).click()
    await page.getByText('Persönliche Begleitung').waitFor()
    await shot(page, t, '13-hilfe-sheet')
  } else {
    await page.getByRole('button', { name: 'Menü öffnen' }).click()
    await page.getByText('Roman Pfeiffer').waitFor()
    await shot(page, t, '13-mobile-menu-sheet')
  }

  // ── Auth screens + 404 ─────────────────────────────────────────
  for (const [path, probe, name] of [
    ['/login', 'Willkommen zurück', '14-login'],
    ['/register', 'Konto erstellen', '15-register'],
    ['/email-sent', 'E-Mail bestätigen', '16-email-sent'],
    ['/definitely-not-a-page', 'Seite nicht gefunden', '17-notfound-404'],
  ]) {
    await page.goto(BASE + path, { waitUntil: 'load' })
    await page.getByText(probe).first().waitFor({ timeout: 20000 })
    await shot(page, t, name)
  }

  await browser.close()
}

for (const vp of VIEWPORTS) {
  console.log(`\n=== ${vp.tag} ${vp.width}x${vp.height} ===`)
  await run(vp)
}
console.log('\nDone.')
