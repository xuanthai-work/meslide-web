# GSlide web Kubernetes manifests

Next.js web/BFF Deployment + ClusterIP Service. **No Ingress, no HPA, no
application-owned nginx.** The shared Ingress team owns the public edge, TLS
and DNS. See [`ingress-routing-contract.md`](./ingress-routing-contract.md).

Apply **gslide-api** first: this repo mounts PVC `gslide-app-data` (owned by
the API) read-only and talks to Service `api:8000`.

## Files

| File | Purpose |
| --- | --- |
| `00-namespace.yaml` | `gslide` namespace (optional — drop if platform-managed). |
| `01-configmap.yaml` | Non-sensitive web URLs and feature switches (`gslide-web-config`). |
| `10-web.yaml` | Next.js web/BFF Deployment + ClusterIP Service. |

SearXNG is not part of this repo. Image search / custom-LLM web search can
be added later from a separate deploy.

## Apply

```bash
kubectl apply -f 00-namespace.yaml
kubectl apply -f 01-configmap.yaml
kubectl apply -f 10-web.yaml
```

Replace `ghcr.io/<org>/gslide-web:latest` in `10-web.yaml` with the image
this GitLab repo builds.

## Resources (4 concurrent users, starting point)

| Workload | Replicas | CPU request | CPU limit | Memory request | Memory limit |
| --- | ---: | ---: | ---: | ---: | ---: |
| Next.js web/BFF | 1 | `100m` | `500m` | `256Mi` | `512Mi` |

Probes: `/health` (unauthenticated, outside the middleware matcher). Startup
up to 60 s, readiness 5 s, liveness 30 s. `terminationGracePeriodSeconds: 60`.

Web runs non-root (`runAsUser: 1000`) with a read-only root filesystem.

## What is intentionally NOT here

- No Ingress resource.
- No `gslide-secrets` (LLM keys belong on the API).
- No SearXNG.
- No PVC definition (`gslide-app-data` lives in gslide-api).
