import { NextRequest, NextResponse } from "next/server";

import { resolveServerFastApiOrigin } from "@/lib/fastapi-origin";
import { decideProxyRoute, isFastApiApiPath } from "@/lib/proxy-route";

/**
 * This proxy is the single browser-routing layer now that the bundled
 * nginx proxy has been removed. The browser stays same-origin against the web
 * service; FastAPI paths (`/api/v1`, `/api/v2`, `/app_data`, `/static`) and the
 * `/pdf-maker` export bridge are rewritten/proxied here to the FastAPI service.
 * Session auth is enforced by FastAPI; this layer only rewrites paths.
 */
function getFastApiBaseUrl(): string {
  return resolveServerFastApiOrigin(
    process.env.FAST_API_INTERNAL_URL,
    process.env.NEXT_PUBLIC_FAST_API,
  );
}

function rewriteToFastApi(request: NextRequest): NextResponse {
  const destination = new URL(
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
    `${getFastApiBaseUrl()}/`
  );
  return NextResponse.rewrite(destination);
}

function continueRequest(request: NextRequest): NextResponse {
  return isFastApiApiPath(request.nextUrl.pathname)
    ? rewriteToFastApi(request)
    : NextResponse.next();
}

const SESSION_COOKIE_NAME = "gslide_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const SERVICE_API_KEY_PREFIXES = ["sk-gslide-", "sk-presenton-"] as const;

function proxyInput(request: NextRequest) {
  return {
    pathname: request.nextUrl.pathname,
    method: request.method,
    exportSession: request.nextUrl.searchParams.get("exportSession"),
    authorization: request.headers.get("authorization"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
    protocol: request.nextUrl.protocol,
    apiKeyPrefixes: SERVICE_API_KEY_PREFIXES,
  };
}

export default async function proxy(request: NextRequest) {
  const input = proxyInput(request);
  const decision = decideProxyRoute(input);

  if (decision.action === "pdf-session") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.searchParams.delete("exportSession");

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: input.exportSession ?? "",
      maxAge: SESSION_TTL_SECONDS,
      httpOnly: true,
      secure: decision.secure,
      sameSite: "lax",
      path: "/",
    });
    return response;
  }

  if (decision.action === "reject-api-key") {
    // FastAPI validates admin-owned API keys. Do not treat them as browser
    // sessions or expose them to local Next.js configuration routes.
    return NextResponse.json(
      { detail: "API keys are only accepted by the GSlide API" },
      { status: 403 }
    );
  }

  if (decision.action === "rewrite") {
    return rewriteToFastApi(request);
  }

  return continueRequest(request);
}

export const config = {
  matcher: ["/api/:path*", "/app_data/:path*", "/static/:path*", "/pdf-maker"],
};
