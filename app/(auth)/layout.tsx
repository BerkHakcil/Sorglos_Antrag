import Image from 'next/image'
import Link from 'next/link'
import { de } from '@/lib/strings/de'
import { LegalFooter } from '@/components/legal-footer'

/**
 * E-5: the mockup's AuthShell — cream page, the logo centred above the card,
 * a max-w-lg column (was max-w-md; the signup form's two-column name row was
 * cramped at 28rem). The logo is Roman's SVG lockup (`public/logo.svg`,
 * mini round 2026-08-13; `unoptimized` because the Next image optimizer
 * refuses SVG without dangerouslyAllowSVG — the file is served as-is).
 *
 * The logo links to /login rather than "/" because "/" redirects to /case,
 * which bounces a signed-out visitor straight back to /login — a link that
 * appears to do nothing. /login is the honest destination from an auth page.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-background flex min-h-screen justify-center px-4 pt-10 pb-0 sm:pt-16">
      <div className="flex w-full max-w-lg flex-col items-center">
        <Link href="/login" className="inline-flex min-h-11 shrink-0 items-center">
          <Image
            src="/logo.svg"
            alt={de.brand.name}
            width={172}
            height={28}
            priority
            unoptimized
            className="h-10 w-auto"
          />
        </Link>
        <div className="mt-8 w-full sm:mt-10">{children}</div>
        <div className="mt-auto w-full pt-10">
          <LegalFooter />
        </div>
      </div>
    </main>
  )
}
