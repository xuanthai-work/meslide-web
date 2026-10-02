export const SERVER_FASTAPI_FALLBACK_ORIGIN = "http://127.0.0.1:8000";

const FASTAPI_DEFAULT_PORT = "8000";

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

/**
 * Internal cluster hosts (Kubernetes/Docker) that serve FastAPI on 8000.
 * A host without any dot is a bare service name such as `api` or `web`.
 */
function isInternalFastApiHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host.includes("cluster.local") ||
    host.includes(".svc") ||
    host.includes("api") ||
    !host.includes(".")
  );
}

/**
 * Self-heals internal FastAPI origins that were deployed without an explicit
 * port. Node defaults `http://host` to port 80, which breaks in-cluster calls,
 * so internal hosts get the FastAPI port `:8000` appended when missing.
 */
export function normalizeFastApiOrigin(urlStr: string): string {
  const trimmed = urlStr.trim();
  if (!trimmed) return SERVER_FASTAPI_FALLBACK_ORIGIN;

  try {
    const parsed = new URL(trimmed);
    if (
      parsed.protocol === "http:" &&
      parsed.port === "" &&
      isInternalFastApiHostname(parsed.hostname)
    ) {
      parsed.port = FASTAPI_DEFAULT_PORT;
    }
    return stripTrailingSlashes(parsed.toString());
  } catch {
    return stripTrailingSlashes(trimmed);
  }
}

/**
 * Origin for Next.js server calls and the proxy rewrite.
 * `FAST_API_INTERNAL_URL` wins over the public URL. The browser client uses
 * a different resolver and must not call this.
 */
export function resolveServerFastApiOrigin(
  internalUrl: string | null | undefined,
  publicUrl: string | null | undefined,
): string {
  const internal = internalUrl?.trim();
  if (internal) return normalizeFastApiOrigin(internal);
  const configured = publicUrl?.trim();
  if (configured) return normalizeFastApiOrigin(configured);
  return SERVER_FASTAPI_FALLBACK_ORIGIN;
}

/** Path segment for `/api/v1/ppt/presentation/{id}`. Plain ids are unchanged. */
export function encodePresentationId(id: string): string {
  return encodeURIComponent(id.trim());
}
