import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeFastApiOrigin,
  resolveServerFastApiOrigin,
  SERVER_FASTAPI_FALLBACK_ORIGIN,
} from "../lib/fastapi-origin.ts";

// A trailing dot on the hostname is valid FQDN syntax; normalize both forms so
// the assertions accept `.local:8000` and `.local.:8000`.
function withoutTrailingDot(origin) {
  return origin.replace(/\.(?=:|$)/, "");
}

test("heals in-cluster Kubernetes hosts that are missing the port", () => {
  assert.equal(
    withoutTrailingDot(
      resolveServerFastApiOrigin(
        "http://gapo-gslide-api-api.ailab.svc.cluster.local.",
        null
      )
    ),
    "http://gapo-gslide-api-api.ailab.svc.cluster.local:8000"
  );
  assert.equal(
    resolveServerFastApiOrigin(
      "http://gapo-gslide-api-api.ailab.svc.cluster.local",
      null
    ),
    "http://gapo-gslide-api-api.ailab.svc.cluster.local:8000"
  );
  assert.equal(
    resolveServerFastApiOrigin(null, "http://gslide-api.default.svc"),
    "http://gslide-api.default.svc:8000"
  );
});

test("heals single-label service hosts that are missing the port", () => {
  assert.equal(resolveServerFastApiOrigin("http://api", null), "http://api:8000");
  assert.equal(normalizeFastApiOrigin("http://web"), "http://web:8000");
});

test("keeps explicit ports untouched", () => {
  assert.equal(
    resolveServerFastApiOrigin("http://api:8000", null),
    "http://api:8000"
  );
  assert.equal(
    resolveServerFastApiOrigin(null, "http://localhost:5001"),
    "http://localhost:5001"
  );
});

test("does not add a port to external HTTPS origins", () => {
  assert.equal(
    normalizeFastApiOrigin("https://api.mycompany.com"),
    "https://api.mycompany.com"
  );
});

test("falls back when no origin is configured", () => {
  assert.equal(
    resolveServerFastApiOrigin(undefined, undefined),
    SERVER_FASTAPI_FALLBACK_ORIGIN
  );
  assert.equal(normalizeFastApiOrigin("  "), SERVER_FASTAPI_FALLBACK_ORIGIN);
  assert.equal(SERVER_FASTAPI_FALLBACK_ORIGIN, "http://127.0.0.1:8000");
});
