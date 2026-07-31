import Image from 'next/image'
import Link from 'next/link'
import { de } from '@/lib/strings/de'

/**
 * E-5: the mockup's AuthShell — cream page, the logo centred above the card,
 * a max-w-lg column (was max-w-md; the signup form's two-column name row was
 * cramped at 28rem). The logo is `public/logo.jpg` as agreed; an SVG from
 * Roman is an upgrade when it arrives, not a dependency.
 *
 * The logo links to /login rather than "/" because "/" redirects to /case,
 * which bounces a signed-out visitor straight back to /login — a link that
 * appears to do nothing. /login is the honest destination from an auth page.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-background flex min-h-screen justify-center px-4 py-10 sm:py-16">
      <div className="flex w-full max-w-lg flex-col items-center">
        <Link href="/login" className="shrink-0">
          <Image
            src="/logo.jpg"
            alt={de.brand.name}
            width={1052}
            height={262}
            priority
            className="h-10 w-auto rounded-md"
          />
        </Link>
        <div className="mt-8 w-full sm:mt-10">{children}</div>
      </div>
    </main>
  )
}
