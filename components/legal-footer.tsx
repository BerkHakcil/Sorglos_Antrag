import { LEGAL_URLS } from '@/lib/legal-links'
import { de } from '@/lib/strings/de'

/**
 * App-wide legal footer (post-Batch-C mini round): Impressum · Datenschutz ·
 * AGB, all external on the marketing site, opened in a new tab.
 *
 * Placement is per-surface rather than in the root layout on purpose: the
 * case screen is a locked h-dvh flex column with its own internal scrolling
 * (a root-layout footer would extend the document below the viewport and
 * break its app-like no-page-scroll design), so the footer mounts as a
 * shrink-0 row INSIDE that column, and inside the auth column with mt-auto.
 * It never overlays content — the chat area (with its answer footer) simply
 * ends above it.
 */
/**
 * `variant` (R2-1): the mockup has no legal-links spec, so D6 extrapolates —
 * on desktop the links join the sidebar foot ('sidebar'), everywhere else they
 * stay the full-width bar ('bar'). Only the chrome differs; both variants keep
 * the same testid, the same three links and the same link attributes, which is
 * what legal-footer.spec asserts.
 */
export function LegalFooter({ variant = 'bar' }: { variant?: 'bar' | 'sidebar' }) {
  const links = [
    { href: LEGAL_URLS.impressum, label: de.footer.impressum },
    { href: LEGAL_URLS.datenschutz, label: de.footer.datenschutz },
    { href: LEGAL_URLS.agb, label: de.footer.agb },
  ]
  const isSidebar = variant === 'sidebar'
  return (
    <footer
      data-testid="legal-footer"
      className={isSidebar ? 'shrink-0' : 'border-border/60 bg-background shrink-0 border-t'}
    >
      <nav
        className={`text-graphite-soft flex items-center gap-2 text-[11px] leading-tight ${
          isSidebar ? 'flex-wrap' : 'mx-auto max-w-2xl justify-center px-4 py-2'
        }`}
      >
        {links.map((link, i) => (
          <span key={link.href} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true">·</span>}
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              /* R2-6 sweep: the audit measured these at 14px high — under
                 WCAG 2.5.8's 24x24 minimum. The visual size stays (this row
                 lives inside the viewport-locked shell, where a 44px bar would
                 cost the chat real height); the HIT AREA is padded out to 24px
                 instead, which is what 2.5.8 actually asks for. */
              className="hover:text-foreground inline-flex min-h-6 items-center hover:underline"
            >
              {link.label}
            </a>
          </span>
        ))}
      </nav>
    </footer>
  )
}
