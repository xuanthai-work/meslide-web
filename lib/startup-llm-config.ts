/**
 * Startup provider-config fetches. Local file/env does not need FastAPI;
 * the overlay hop does. Keep this module dependency-free so node --test
 * can cover URL order and retry policy.
 */

export const LOCAL_USER_CONFIG_PATH = "/api/user-config?source=local";
export const OVERLAY_USER_CONFIG_PATH = "/api/user-config";
export const STARTUP_USER_CONFIG_ATTEMPTS = 3;
export const STARTUP_USER_CONFIG_RETRY_MS = [250, 800] as const;

export function isRetryableUserConfigStatus(status: number): boolean {
  return status === 500 || status === 502 || status === 503 || status === 504;
}

type FetchLike = (
  input: string,
  init?: RequestInit
) => Promise<Pick<Response, "ok" | "status" | "json">>;

async function defaultSleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithRetries(
  url: string,
  options?: {
    fetchImpl?: FetchLike;
    sleep?: (ms: number) => Promise<void>;
  }
): Promise<unknown | null> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const sleep = options?.sleep ?? defaultSleep;

  for (let attempt = 0; attempt < STARTUP_USER_CONFIG_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      const delay = STARTUP_USER_CONFIG_RETRY_MS[attempt - 1] ?? 800;
      await sleep(delay);
    }

    try {
      const response = await fetchImpl(url, { cache: "no-store" });
      if (response.ok) {
        return await response.json();
      }
      if (!isRetryableUserConfigStatus(response.status)) {
        return null;
      }
    } catch {
      // Next.js may still be compiling the route after web-dev restart.
    }
  }

  return null;
}

export async function fetchLocalProviderConfigJson(options?: {
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
}): Promise<unknown | null> {
  return fetchJsonWithRetries(LOCAL_USER_CONFIG_PATH, options);
}

export async function fetchUserConfigJsonWithRetries(options?: {
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
}): Promise<unknown | null> {
  return fetchJsonWithRetries(OVERLAY_USER_CONFIG_PATH, options);
}
