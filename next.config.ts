import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

// SEG-07 — Content Security Policy (iterative deployment, Report-Only first).
//
// Strategy (per Next.js 16 + Google's recommendation):
//   1. Ship Content-Security-Policy-Report-Only — browsers send violation
//      reports to report-uri but do NOT block content. Iteration phase.
//   2. After 1-2 weeks of clean reports, swap the header name to
//      Content-Security-Policy to enforce.
//   3. Tighten 'unsafe-inline' once the AdSense + GA + Next.js inline
//      bootstrap scripts have been audited (or migrated to nonce-based
//      CSP via proxy.ts — that requires dynamic rendering, see Next.js
//      "CSP" guide; would break ISR on /picks).
//
// Allow-list rationale (every entry has a justification — never widen
// without one):
//   - 'self'                        : own origin
//   - cdn.brawlify.com              : map + brawler images
//   - api.brawlapi.com              : map metadata (browser-side fallback)
//   - *.googlesyndication.com       : AdSense ad slots
//   - *.googletagmanager.com        : GA tag manager (if ever wired)
//   - *.google-analytics.com        : GA tracking endpoint
//   - pagead2.googlesyndication.com : AdSense slot loader
//   - *.googleadservices.com        : AdSense conversion
//   - *.gstatic.com                 : Google fonts + static assets
//   - 'unsafe-inline' (script)      : AdSense ad slot init + Next.js
//                                     bootstrap. To remove: implement
//                                     nonce CSP in proxy.ts (Phase 3).
//   - 'unsafe-inline' (style)       : Tailwind generates inline styles
//                                     for arbitrary values; CVA + sonner.
//   - data: + blob:                 : data URIs for icons + html2canvas.
//
// frame-ancestors 'none' replaces the existing X-Frame-Options DENY
// (CSP supersedes that header in modern browsers).
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pagead2.googlesyndication.com https://*.googlesyndication.com https://www.googletagmanager.com https://*.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://*.googleadservices.com https://*.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://*.gstatic.com https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://cdn.brawlify.com https://api.brawlapi.com https://*.googlesyndication.com https://*.google-analytics.com https://*.googletagmanager.com https://*.google.com https://*.gstatic.com https://*.brawlvision.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://api.brawlapi.com https://cdn.brawlify.com https://*.supabase.co https://*.supabase.io wss://*.supabase.co https://*.googlesyndication.com https://*.google-analytics.com https://*.googletagmanager.com https://*.googleadservices.com https://api-m.paypal.com https://api-m.sandbox.paypal.com",
  "frame-src https://*.googlesyndication.com https://*.google.com https://*.doubleclick.net https://*.paypal.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://*.paypal.com",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
  // SEG-07 reporting — both legacy report-uri and modern report-to
  // pointing at /api/csp-report. Browsers send one or the other depending
  // on version; the endpoint normalises both shapes into a single log
  // line with scope:"csp", visible in Vercel logs.
  // Reporting-Endpoints header below maps the "csp-endpoint" name.
  "report-uri /api/csp-report",
  "report-to csp-endpoint",
].join('; ')

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.brawlify.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // X-Frame-Options is technically superseded by CSP frame-ancestors
          // but we keep it for legacy browsers that don't parse CSP.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          // SEG-07 — Phase 1 Report-Only. Switch to 'Content-Security-Policy'
          // (without -Report-Only) once /api/csp-report shows zero violations
          // for 1-2 weeks. Browsers still LOG violations in Report-Only
          // mode, so the operator gets visibility before any user-facing
          // breakage.
          { key: 'Content-Security-Policy-Report-Only', value: cspDirectives },
          // Reporting-Endpoints header for the modern report-to directive.
          // Format: <name>="<url>". The endpoint name 'csp-endpoint' is
          // referenced by the report-to directive in the CSP above.
          {
            key: 'Reporting-Endpoints',
            value: 'csp-endpoint="/api/csp-report"',
          },
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
