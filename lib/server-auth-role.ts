import { cookies } from "next/headers";

import { getFastApiBaseUrl } from "@/lib/fastapi-internal";

export type ServerAuthStatus = {
  configured: boolean;
  authenticated: boolean;
  username: string | null;
  user_id: string | null;
};

function unauthenticatedStatus(): ServerAuthStatus {
  return {
    configured: false,
    authenticated: false,
    username: null,
    user_id: null,
  };
}

function cookieHeaderFromStore(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
): string {
  return cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
}

/**
 * Resolve the browser session by asking FastAPI `/api/v1/auth/status`.
 * Next.js route handlers use this to scope uploads, exports, and config.
 */
export async function authStatusForRequest(): Promise<ServerAuthStatus> {
  try {
    const cookieHeader = cookieHeaderFromStore(await cookies());
    const response = await fetch(`${getFastApiBaseUrl()}/api/v1/auth/status`, {
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : {},
    });
    if (!response.ok) {
      return unauthenticatedStatus();
    }
    const payload = (await response.json()) as Partial<ServerAuthStatus>;
    return {
      configured: Boolean(payload.configured),
      authenticated: Boolean(payload.authenticated),
      username: payload.username ?? null,
      user_id: payload.user_id ?? null,
    };
  } catch {
    return unauthenticatedStatus();
  }
}
