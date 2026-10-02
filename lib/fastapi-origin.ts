export const SERVER_FASTAPI_FALLBACK_ORIGIN = "http://127.0.0.1:8000";

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
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
  if (internal) return stripTrailingSlashes(internal);
  const configured = publicUrl?.trim();
  if (configured) return stripTrailingSlashes(configured);
  return SERVER_FASTAPI_FALLBACK_ORIGIN;
}

/** Path segment for `/api/v1/ppt/presentation/{id}`. Plain ids are unchanged. */
export function encodePresentationId(id: string): string {
  return encodeURIComponent(id.trim());
}
