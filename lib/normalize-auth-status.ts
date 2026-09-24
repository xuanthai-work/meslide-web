export type AuthStatusPayload = {
  configured?: boolean;
  authenticated?: boolean;
  username?: string | null;
  user_id?: string | null;
};

export type NormalizedAuthStatus = {
  configured: boolean;
  authenticated: boolean;
  username: string | null;
  user_id: string | null;
};

export function nonEmptyUserId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeAuthStatus(
  payload: AuthStatusPayload | null | undefined,
): NormalizedAuthStatus {
  return {
    configured: Boolean(payload?.configured),
    authenticated: Boolean(payload?.authenticated),
    username: payload?.username ?? null,
    user_id: nonEmptyUserId(payload?.user_id),
  };
}

/** File reads are per-user. A session without an id must not see the data root. */
export function canReadScopedLocalFiles(auth: {
  authenticated: boolean;
  user_id: string | null;
}): boolean {
  return auth.authenticated && nonEmptyUserId(auth.user_id) !== null;
}
