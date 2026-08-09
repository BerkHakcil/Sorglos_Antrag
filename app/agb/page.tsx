import { redirect } from 'next/navigation'
import { LEGAL_URLS } from '@/lib/legal-links'

/**
 * The AGB live on the marketing site since go-live (lib/legal-links.ts).
 * This route only exists for old bookmarks/deep links from the placeholder
 * era — it must never serve the retired "wird in Kürze veröffentlicht" text
 * while the real document is published. Temporary (307) on purpose: the
 * external URL is owned outside this repo and may move.
 */
export default function AgbPage() {
  redirect(LEGAL_URLS.agb)
}
