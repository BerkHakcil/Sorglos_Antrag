import type { NextConfig } from 'next'
import { LEGAL_URLS } from './lib/legal-links'

const nextConfig: NextConfig = {
  /**
   * Legacy legal routes → the published documents on the marketing site
   * (go-live, 2026-08-09). Routing-layer redirects give a real HTTP 307;
   * without them the statically prerendered page fallback serves a 200 with
   * a 1-second meta refresh — a blank flash on a legally load-bearing route.
   * The page components keep their own redirect() as defense-in-depth; both
   * read lib/legal-links.ts so the targets cannot drift. permanent: false
   * (307) on purpose — the external URLs are owned outside this repo.
   */
  async redirects() {
    return [
      { source: '/agb', destination: LEGAL_URLS.agb, permanent: false },
      { source: '/datenschutz', destination: LEGAL_URLS.datenschutz, permanent: false },
    ]
  },
}

export default nextConfig
