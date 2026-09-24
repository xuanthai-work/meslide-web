import { NextResponse } from "next/server";
import { getFastApiBaseUrl } from "@/lib/fastapi-internal";
import { getEffectiveUserConfig } from "@/lib/effective-user-config";
import { redactUserConfigSecrets } from "@/lib/redact-user-config";
import { authStatusForRequest } from "@/lib/server-auth-role";

export const dynamic = "force-dynamic";

async function forwardProviderSettings(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const response = await fetch(
    `${getFastApiBaseUrl()}/api/v1/settings/provider`,
    {
      method: "GET",
      headers: cookie ? { cookie } : {},
      cache: "no-store",
    }
  );
  const payload = await response.text();
  return new NextResponse(payload || null, {
    status: response.status,
    headers: {
      "content-type":
        response.headers.get("content-type") || "application/json",
    },
  });
}

function readLocalProviderConfig(): Record<string, unknown> {
  const path = process.env.USER_CONFIG_PATH?.trim();
  if (!path) return {};
  try {
    return getEffectiveUserConfig(path) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function localConfigResponse() {
  const auth = await authStatusForRequest();
  if (!auth.authenticated) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(redactUserConfigSecrets(readLocalProviderConfig()));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("source") === "local") {
    return localConfigResponse();
  }

  try {
    return await forwardProviderSettings(request);
  } catch {
    // Provider settings are unreachable. Still require a session, and never
    // send file/env secrets back to the browser.
    return localConfigResponse();
  }
}
