import { NextResponse } from 'next/server'
import { log, requestIdFrom } from '@/lib/log'

/**
 * POST /api/csp-report
 *
 * Receives Content Security Policy violation reports from the browser
 * and forwards them to Vercel's structured logs (via @/lib/log) so the
 * operator can iterate the policy in `next.config.ts` until the
 * Report-Only phase produces zero violations.
 *
 * Two report formats are accepted (browsers send one or the other):
 *
 *  1. Legacy `report-uri` directive — body is application/csp-report
 *     `{ "csp-report": { "blocked-uri": "...", "violated-directive": "...",
 *                         "document-uri": "...", ... } }`
 *
 *  2. Modern `report-to` directive (default since Chrome 96, Firefox 130)
 *     — body is application/reports+json, an array of:
 *     `{ "type": "csp-violation", "url": "...", "user_agent": "...",
 *        "body": { "blockedURL": "...", "effectiveDirective": "...",
 *                  "documentURL": "...", "disposition": "report" | "enforce" } }`
 *
 * Both shapes are normalised into a single log line with `scope: "csp"`
 * + `level: "warn"` so dashboard filters can find them by either name.
 *
 * The endpoint is intentionally permissive (always 204 No Content) so
 * the browser doesn't retry on errors and a malformed report never
 * spams the user.
 */
export async function POST(request: Request) {
  const requestId = requestIdFrom(request)
  try {
    const ct = request.headers.get('content-type') ?? ''
    const text = await request.text()
    if (!text) return new NextResponse(null, { status: 204 })

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      log.warn('csp', 'CSP report body was not JSON', {
        request_id: requestId,
        content_type: ct,
        body_preview: text.slice(0, 200),
      })
      return new NextResponse(null, { status: 204 })
    }

    // Normalise both formats into a flat record per violation.
    const violations: Array<Record<string, unknown>> = []

    if (Array.isArray(parsed)) {
      // Reporting API (report-to) — array of report objects.
      for (const report of parsed) {
        if (!report || typeof report !== 'object') continue
        const r = report as { type?: string; url?: string; body?: Record<string, unknown> }
        if (r.type !== 'csp-violation') continue
        violations.push({
          format: 'report-to',
          document_url: r.url,
          blocked_url: r.body?.blockedURL,
          effective_directive: r.body?.effectiveDirective,
          original_policy: r.body?.originalPolicy,
          disposition: r.body?.disposition,
          source_file: r.body?.sourceFile,
          line: r.body?.lineNumber,
        })
      }
    } else if (parsed && typeof parsed === 'object' && 'csp-report' in parsed) {
      // Legacy report-uri shape.
      const csp = (parsed as { 'csp-report': Record<string, unknown> })['csp-report'] ?? {}
      violations.push({
        format: 'report-uri',
        document_url: csp['document-uri'],
        blocked_url: csp['blocked-uri'],
        effective_directive: csp['effective-directive'] ?? csp['violated-directive'],
        original_policy: csp['original-policy'],
        disposition: csp['disposition'],
        source_file: csp['source-file'],
        line: csp['line-number'],
      })
    }

    if (violations.length === 0) {
      log.warn('csp', 'CSP report had no recognisable violations', {
        request_id: requestId,
        content_type: ct,
        body_preview: text.slice(0, 200),
      })
    } else {
      for (const v of violations) {
        log.warn('csp', `violation: ${v.effective_directive ?? '(unknown directive)'}`, {
          request_id: requestId,
          ...v,
        })
      }
    }

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    // Never throw — the browser would back off and we'd lose visibility.
    log.error('csp', 'csp-report handler crashed', {
      request_id: requestId,
      err,
    })
    return new NextResponse(null, { status: 204 })
  }
}
