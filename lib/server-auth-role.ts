export type ServerAuthStatus = {
  configured: boolean;
  authenticated: boolean;
  username: string | null;
  user_id: string | null;
};

/**
 * No-auth-embedded default-user mode: always returns the fixed demo user so
 * callers behave identically (authenticated). Kept for forward compatibility.
 */
export async function authStatusForRequest(): Promise<ServerAuthStatus> {
  return {
    configured: true,
    authenticated: true,
    username: "demo",
    user_id: "00000000-0000-0000-0000-000000000001",
  };
}
