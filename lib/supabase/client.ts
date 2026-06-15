import { createBrowserClient } from '@supabase/ssr'

/**
 * Returns a Supabase client for use in Client Components.
 * Uses the publishable key — safe to expose to the browser.
 * RLS policies on the database enforce what this client can read/write.
 *
 * Call this inside a Client Component or a custom hook, not in server code.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
