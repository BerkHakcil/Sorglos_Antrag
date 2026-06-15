import Link from 'next/link'
import { de } from '@/lib/strings/de'

const s = de.datenschutz

export const metadata = { title: s.pageTitle }

export default function DatenschutzPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{s.heading}</h1>
      <p className="text-muted-foreground mb-8 text-sm leading-relaxed">{s.body}</p>
      <Link href="/signup" className="text-sm underline underline-offset-4">
        {s.backLink}
      </Link>
    </main>
  )
}
