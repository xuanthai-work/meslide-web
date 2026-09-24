export function isFastApiApiPath(pathname: string): boolean {
  return (
    pathname === "/api/v1" ||
    pathname.startsWith("/api/v1/") ||
    pathname === "/api/v2" ||
    pathname.startsWith("/api/v2/")
  );
}

export function isFastApiAssetPath(pathname: string): boolean {
  return (
    pathname === "/app_data" ||
    pathname.startsWith("/app_data/") ||
    pathname === "/static" ||
    pathname.startsWith("/static/")
  );
}

export type ProxyRouteDecision =
  | { action: "rewrite" }
  | { action: "next" }
  | { action: "pdf-session"; secure: boolean }
  | { action: "reject-api-key" };

function isServiceApiKey(
  authorization: string | null,
  prefixes: readonly string[],
): boolean {
  const header = authorization || "";
  const bearer = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  return prefixes.some((prefix) => bearer.startsWith(prefix));
}

export function decideProxyRoute(input: {
  pathname: string;
  method: string;
  exportSession: string | null;
  authorization: string | null;
  forwardedProto: string | null;
  protocol: string;
  apiKeyPrefixes: readonly string[];
}): ProxyRouteDecision {
  if (isFastApiAssetPath(input.pathname)) return { action: "rewrite" };

  if (input.pathname === "/pdf-maker") {
    if (!input.exportSession) return { action: "next" };
    const secure =
      input.forwardedProto?.toLowerCase() === "https" || input.protocol === "https:";
    return { action: "pdf-session", secure };
  }

  if (input.method === "OPTIONS") {
    return isFastApiApiPath(input.pathname) ? { action: "rewrite" } : { action: "next" };
  }

  if (isServiceApiKey(input.authorization, input.apiKeyPrefixes)) {
    return isFastApiApiPath(input.pathname)
      ? { action: "rewrite" }
      : { action: "reject-api-key" };
  }

  return isFastApiApiPath(input.pathname) ? { action: "rewrite" } : { action: "next" };
}
