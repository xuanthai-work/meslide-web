import { NextResponse } from "next/server";
import { describeFastApiConnectError } from "@/lib/fastapi-connect-error";
import { getFastApiBaseUrl } from "@/lib/fastapi-internal";
import { getEffectiveUserConfig } from "@/lib/effective-user-config";

export const dynamic = "force-dynamic";

async function forwardProviderSettings(
  request: Request,
  method: "GET" | "PUT",
  body?: string
) {
  const cookie = request.headers.get("cookie") || "";
  const response = await fetch(
    `${getFastApiBaseUrl()}/api/v1/settings/provider`,
    {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body,
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

function unavailableSaveResponse() {
  return NextResponse.json(
    {
      error: "Unable to save provider settings",
      retryable: true,
    },
    { status: 503 }
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("source") === "local") {
    return NextResponse.json(readLocalProviderConfig());
  }

  try {
    return await forwardProviderSettings(request, "GET");
  } catch {
    // FastAPI is not required to open the app: instance file/env is enough.
    return NextResponse.json(readLocalProviderConfig());
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    if (!body.trim()) {
      return NextResponse.json(
        { error: "Invalid user config JSON body", status: 400 },
        { status: 400 }
      );
    }
    const parsed = JSON.parse(body) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json(
        { error: "Invalid user config JSON body", status: 400 },
        { status: 400 }
      );
    }
    return await forwardProviderSettings(request, "PUT", body);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid user config JSON body", status: 400 },
        { status: 400 }
      );
    }
    console.warn(
      `FastAPI provider settings unreachable at ${getFastApiBaseUrl()} (${describeFastApiConnectError(error)})`
    );
    return unavailableSaveResponse();
  }
}
