import { NextResponse } from "next/server";
import { getEffectiveUserConfig } from "@/lib/effective-user-config";
import { redactUserConfigSecrets } from "@/lib/redact-user-config";
import { authStatusForRequest } from "@/lib/server-auth-role";
import { hasValidLLMConfig } from "@/utils/storeHelpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await authStatusForRequest();
  if (!auth.authenticated) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  const path = process.env.USER_CONFIG_PATH;
  if (!path) {
    return NextResponse.json(
      { configured: false, config: {} },
      { status: 200 }
    );
  }
  try {
    const full = getEffectiveUserConfig(path);
    return NextResponse.json({
      configured: hasValidLLMConfig(full),
      config: redactUserConfigSecrets(full as Record<string, unknown>),
    });
  } catch {
    return NextResponse.json(
      { configured: false, config: {} },
      { status: 200 }
    );
  }
}
