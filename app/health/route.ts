import { NextResponse } from "next/server";

/**
 * Lightweight, unauthenticated health endpoint for Kubernetes probes and
 * load balancers. The path `/health` is deliberately outside the middleware
 * matcher (`/api/*`, `/app_data/*`, `/static/*`, `/pdf-maker`) so it bypasses
 * the session check and never touches the FastAPI backend.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { status: "ok" },
    { headers: { "Cache-Control": "no-store" } }
  );
}