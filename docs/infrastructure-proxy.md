# Brawl Stars API Proxy — Infrastructure

## Why a Proxy?

The Supercell API (`api.brawlstars.com`) requires IP whitelisting. Vercel uses dynamic IPs that change on every deployment, making direct API calls unreliable. The proxy has a stable egress IP that can be whitelisted in the Supercell Developer Portal.

## Architecture

```
BrawlVision (Vercel)  →  Cloudflare Worker (proxy)  →  api.brawlstars.com
     dynamic IPs            stable egress IP              IP-whitelisted
```

## Proxy Details

- **Technology**: Cloudflare Worker (TypeScript)
- **Source code**: `C:\Proyectos_Agentes\brawlValue-proxy\`
- **Entry point**: `src/index.ts`
- **Config**: `wrangler.toml`
- **Current URL used by app**: `http://141.253.197.60:3001/v1` (hardcoded fallback in `src/lib/api.ts`)
- **Worker URL format**: `https://brawlvalue-api-proxy.<subdomain>.workers.dev/v1/...`

## How It Works

1. Receives requests on `/v1/*` paths
2. Forwards to `https://api.brawlstars.com/v1/*` with the API key
3. Returns response with CORS headers
4. 60-second cache on successful responses
5. `/ip` endpoint returns the Worker's egress IP (for Supercell key creation)

## CORS — Allowed Origins

Configured in `src/index.ts`:
- `https://brawlvalue.com`
- `https://www.brawlvalue.com`
- `https://brawl-stars-value.vercel.app`
- `http://localhost:3000`

**TODO**: Add `https://brawlvision.com` and `https://www.brawlvision.com` (current production domain).

## Environment Variables

| Variable | Where | How to set |
|----------|-------|------------|
| `BRAWLSTARS_API_KEY` | Cloudflare Secret | `npx wrangler secret put BRAWLSTARS_API_KEY` |

## Deployment

```bash
cd C:\Proyectos_Agentes\brawlValue-proxy
npm run deploy    # deploys to Cloudflare Workers
```

## Getting the Egress IP (for Supercell API key)

```bash
curl https://brawlvalue-api-proxy.<subdomain>.workers.dev/ip
```

Use the returned IPs when creating/updating the API key at [developer.brawlstars.com](https://developer.brawlstars.com).

## Main App Configuration

In `src/lib/api.ts`:
```typescript
const API_BASE = process.env.BRAWLSTARS_API_URL || 'http://141.253.197.60:3001/v1'
```

Set `BRAWLSTARS_API_URL` in Vercel env vars to point to the Cloudflare Worker URL.

## Oracle Cloud VPS (141.253.197.60)

The app currently falls back to this IP. This is an Oracle Cloud Compute instance. If it goes down:
1. Log into [cloud.oracle.com](https://cloud.oracle.com)
2. Navigate to Compute → Instances
3. Find the instance and restart it

Long-term, migrate to using the Cloudflare Worker URL directly via the `BRAWLSTARS_API_URL` env var.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Sync returns 502 | Proxy/VPS is down | Restart Oracle instance or redeploy Worker |
| "Last sync: Xh" not updating | Cron job failing or proxy down | Check Vercel logs + proxy health |
| CORS errors in browser | Domain not in ALLOWED_ORIGINS | Add domain to proxy `src/index.ts` |
| API returns 403 | IP not whitelisted at Supercell | Check `/ip` endpoint, update API key |
