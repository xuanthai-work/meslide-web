# DevOps Ingress routing & timeout contract

This is the handoff contract for the **shared Ingress team**. GSlide exposes
**ClusterIP Services only**; DevOps owns the Ingress, TLS, public DNS and
cluster-wide monitoring.

## Services (ClusterIP, in-cluster)

| Service | Port | Notes | Repo |
| --- | --- | --- | --- |
| `web` | `3000` | Next.js web/BFF + Next.js rewrite to FastAPI. Browser-facing. | gslide-web |
| `api` | `8000` | FastAPI + Chromium export runtime. | gslide-api |
| `searxng` | `8080` | Optional, later. Not public. Not required for this deploy. | (separate) |

The browser must reach the `web` service only. FastAPI paths are rewritten to
`api` either by the shared Ingress (this contract) or, for same-origin local
use, by Next.js (`proxy.ts`) via `FAST_API_INTERNAL_URL=http://api:8000`. In
Kubernetes the Ingress should send FastAPI paths directly to `api` (preferred,
fewer hops) so long-lived streams avoid an extra hop.

## Route matrix

Precedence matters: **FastAPI paths must be matched before the general `/api/*`
and `/` (Next.js) rules**, otherwise FastAPI traffic is swallowed by the Next.js
catch-all.

| Route | Backend | Owner / notes |
| --- | --- | --- |
| `/api/v1/*` and `/api/v2/*` | `api:8000` | FastAPI public API. Includes SSE generation/stream endpoints (see timeouts). |
| `/docs`, `/openapi.json` | `api:8000` | FastAPI docs. Lock down or disable in production if desired. |
| `/static/*` | `api:8000` | Bundled UI static assets (logos, fonts, icons). **Public, no auth.** Trailing slash required so `/static/` cannot be escaped (`/static../`). |
| `/app_data/fonts/*`, `/app_data/templates/*` | `api:8000` | **Public, no auth** (fonts/templates are non-sensitive). |
| `/app_data/images/*`, `/app_data/exports/*`, `/app_data/uploads/*`, `/app_data/pptx-to-html/*`, `/app_data/pptx-to-json/*` | `api:8000` | **Auth required.** FastAPI `SessionAuthMiddleware` enforces the session cookie and per-user path authorization; the Ingress must forward `Cookie` (and `Authorization`) headers. |
| `/pdf-maker` | `web:3000` | Export-runtime bridge. Chromium (in `api`) opens this with `?exportSession=…`. Not for end-user browsers. |
| `/_next/*`, Next.js BFF routes under `/api/*` (everything not listed above as FastAPI), pages and all remaining paths | `web:3000` | Next.js app + BFF routes. |

## Timeouts and streaming

- **Presentation SSE endpoints** (under `/api/v1/…/stream/…`): disable response
  buffering and use a **read timeout of at least one hour**.
- **Generation/export POSTs**: read+send timeout of at least **30 minutes**.
- **Export rendering** (`/pdf-maker`): Chromium opens `web:3000/pdf-maker`
  internally. Keep `EXPORT_PAGE_BASE_URL=http://web:3000`.
- **Large uploads**: Ingress body limit must be ≥ **110 MB** for `/api/v1/`.

## Headers the Ingress must preserve

- `Cookie` and `Authorization`
- `Host` / `X-Forwarded-Host` with the original browser host:port
- `X-Forwarded-Proto`

## What GSlide does NOT bring

- No application-owned nginx Deployment or Ingress resource.
- No public exposure for SearXNG (omit until a later search deploy).
