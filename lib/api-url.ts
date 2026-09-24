export const SSR_FASTAPI_FALLBACK_ORIGIN = "http://127.0.0.1:5001";

export type ApiUrlRuntime = {
  /** Browser origin. Null during SSR and in route handlers. */
  windowOrigin: string | null;
  /** Validated `?fastapiUrl=` origin. Null when absent or not http(s). */
  queryOrigin: string | null;
  /** Raw `NEXT_PUBLIC_FAST_API` / `window.env` value, including empty. */
  configuredUrl: string | null;
};

export function parseFastApiQueryOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/** Base URL returned by `getFastAPIUrl`. Not the same rules as `getApiUrl`. */
export function resolveFastApiClientOrigin(runtime: ApiUrlRuntime): string {
  if (runtime.queryOrigin) return runtime.queryOrigin;
  if (runtime.windowOrigin) return runtime.windowOrigin;
  return runtime.configuredUrl || SSR_FASTAPI_FALLBACK_ORIGIN;
}

function withLeadingSlash(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function isAbsoluteHttpUrl(path: string): boolean {
  return /^https?:\/\//i.test(path);
}

function isFastApiEndpoint(path: string): boolean {
  return path.startsWith("/api/v1/") || path.startsWith("/api/v2/");
}

/**
 * Browser calls stay same-origin unless `?fastapiUrl=` is set.
 * Server calls stay relative until a public FastAPI URL is configured.
 */
export function resolveApiUrl(path: string, runtime: ApiUrlRuntime): string {
  if (isAbsoluteHttpUrl(path)) return path;

  const normalizedPath = withLeadingSlash(path);
  if (!isFastApiEndpoint(normalizedPath)) return normalizedPath;
  if (!runtime.windowOrigin && !runtime.configuredUrl) return normalizedPath;
  if (runtime.windowOrigin && !runtime.queryOrigin) return normalizedPath;
  return `${resolveFastApiClientOrigin(runtime)}${normalizedPath}`;
}
