import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Supabase Auth callback — handles the PKCE code exchange.
 *
 * Used by:
 *   - Password-reset emails: link contains ?code=xxx&next=/update-password
 *   - Any future OAuth / magic-link flows
 *
 * On success: redirects to `next` (default /case).
 * On failure: redirects to /login with an error flag.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/case'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`)
}
