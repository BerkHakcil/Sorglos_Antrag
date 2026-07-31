import { de } from '@/lib/strings/de'

/**
 * E-7: route-level loading state. /case renders entirely on the server
 * (questionnaire + document rules + answers), so navigation shows nothing
 * until the response lands; this fills that gap on the palette. A spinner,
 * not a skeleton — at 20–50 cases/month a skeleton mirror of the case screen
 * is over-engineering (CLAUDE.md rule #10).
 *
 * The sr-only label is PLACEHOLDER_DE (see lib/strings/de.ts), logged for
 * Roman. The spinner itself is aria-hidden; role="status" announces the text.
 */
export default function Loading() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center" role="status">
      <span
        aria-hidden
        className="border-sage-soft border-t-primary size-10 animate-spin rounded-full border-4"
      />
      <span className="sr-only">{de.loading.label}</span>
    </div>
  )
}
