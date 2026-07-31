import Link from 'next/link'
import { de } from '@/lib/strings/de'
import { cardLg, linkPetrol, linkStandalone } from '@/components/ui/styles'

const s = de.notFound

export const metadata = { title: s.pageTitle }

/**
 * E-7: the app had NO 404 — an unknown URL fell through to the framework
 * default, unbranded and English. A missing 404 is a worse experience than
 * placeholder text, so this ships with PLACEHOLDER_DE copy (marked in
 * lib/strings/de.ts, logged for Roman). Minimal by design: heading, one
 * line, a petrol link to /case — which redirects a signed-out visitor to
 * /login, so it is the right destination for everyone.
 */
export default function NotFound() {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4 py-10">
      <div className={`${cardLg} w-full max-w-lg space-y-4 p-8 text-center`}>
        <p aria-hidden className="text-primary text-5xl font-semibold">
          404
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{s.heading}</h1>
        <p className="text-graphite-soft text-base leading-relaxed">{s.body}</p>
        <p>
          <Link href="/case" className={`${linkPetrol} ${linkStandalone}`}>
            {s.backLink}
          </Link>
        </p>
      </div>
    </main>
  )
}
