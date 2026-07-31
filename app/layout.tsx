import type { Metadata } from 'next'
import { Lato, Geist_Mono } from 'next/font/google'
import './globals.css'

/**
 * Lato — the mockup's typeface (Phase E-1).
 *
 * SELF-HOSTED ON PURPOSE. The mockup pulls Lato from fonts.googleapis.com via
 * a <link>; copying that would send every caregiver's IP address to Google on
 * each page load, which is not acceptable for a German care-benefits app
 * handling health and financial data. `next/font/google` downloads the files
 * at build time and serves them from our own origin — zero third-party
 * requests at runtime.
 *
 * WEIGHTS: Lato ships 100/300/400/700/900 — there is no 500 or 600. Tailwind's
 * `font-medium` (500) and `font-semibold` (600), which the mockup uses freely,
 * resolve through normal CSS font matching to 400 and 700 respectively. The
 * mockup has the same situation (its <link> requests only 300;400;700), so
 * this matches its rendering rather than diverging from it.
 */
const lato = Lato({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Hilfe zur Pflege',
  description: 'Antrag auf Hilfe zur Pflege',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de" className={`${lato.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
