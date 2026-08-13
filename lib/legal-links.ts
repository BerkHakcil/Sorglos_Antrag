/**
 * Canonical external legal pages on the marketing site (go-live, 2026-08-09).
 * The www host is the canonical one — the apex 308-redirects to it (verified
 * at wiring time; both URLs returned HTTP 200). One constant per document so
 * the signup consent links and the legacy /agb + /datenschutz routes cannot
 * drift apart.
 *
 * These are hrefs, not user-facing German — de.ts owns all visible text.
 */
export const LEGAL_URLS = {
  agb: 'https://www.sorglosantrag.de/hzp/agb',
  datenschutz: 'https://www.sorglosantrag.de/hzp/datenschutz',
  // Impressum lives under /hzp/ like the other two — the bare /impressum
  // returns 404 on the marketing site (probed 2026-08-13; /hzp/impressum 200).
  impressum: 'https://www.sorglosantrag.de/hzp/impressum',
} as const
