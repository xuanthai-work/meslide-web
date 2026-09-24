import assert from "node:assert/strict";
import test from "node:test";

import {
  parseFastApiQueryOrigin,
  resolveApiUrl,
  resolveFastApiClientOrigin,
  SSR_FASTAPI_FALLBACK_ORIGIN,
} from "../lib/api-url.ts";
import {
  readOkResponseBody,
  statusFallbackMessage,
} from "../lib/api-response-contract.ts";
import {
  encodePresentationId,
  resolveServerFastApiOrigin,
  SERVER_FASTAPI_FALLBACK_ORIGIN,
} from "../lib/fastapi-origin.ts";
import { decideProxyRoute } from "../lib/proxy-route.ts";
import { getHeader, getHeaderForFormData } from "../app/(presentation-generator)/services/api/header.ts";

const API_KEY_PREFIXES = ["sk-gslide-", "sk-presenton-"];
const browser = {
  windowOrigin: "http://web.local",
  queryOrigin: null,
  configuredUrl: "http://api.internal:8000",
};
const server = {
  windowOrigin: null,
  queryOrigin: null,
  configuredUrl: null,
};

test("server FastAPI origin prefers the internal URL and strips slashes", () => {
  assert.equal(
    resolveServerFastApiOrigin("http://api:8000/", "http://public:8000"),
    "http://api:8000",
  );
  assert.equal(
    resolveServerFastApiOrigin("  ", "http://public:8000/"),
    "http://public:8000",
  );
  assert.equal(
    resolveServerFastApiOrigin(undefined, undefined),
    SERVER_FASTAPI_FALLBACK_ORIGIN,
  );
  assert.equal(SERVER_FASTAPI_FALLBACK_ORIGIN, "http://127.0.0.1:8000");
});

test("client API URLs stay same-origin unless the query override is set", () => {
  assert.equal(
    resolveApiUrl("/api/v1/ppt/presentation/create", browser),
    "/api/v1/ppt/presentation/create",
  );
  assert.equal(
    resolveApiUrl("api/v2/health", browser),
    "/api/v2/health",
  );
  assert.equal(resolveApiUrl("/api/user-config", browser), "/api/user-config");
  assert.equal(
    resolveApiUrl("https://cdn.example/a.png", browser),
    "https://cdn.example/a.png",
  );

  const overridden = {
    ...browser,
    queryOrigin: parseFastApiQueryOrigin("http://127.0.0.1:9000/ignored"),
  };
  assert.equal(
    resolveApiUrl("/api/v1/ppt/presentation/create", overridden),
    "http://127.0.0.1:9000/api/v1/ppt/presentation/create",
  );
  assert.equal(parseFastApiQueryOrigin("javascript:alert(1)"), null);
  assert.equal(parseFastApiQueryOrigin("not a url"), null);
});

test("SSR without a configured URL stays relative; configured SSR uses that URL", () => {
  assert.equal(resolveApiUrl("/api/v1/ppt/themes/all", server), "/api/v1/ppt/themes/all");
  assert.equal(
    resolveFastApiClientOrigin(server),
    SSR_FASTAPI_FALLBACK_ORIGIN,
  );
  assert.equal(SSR_FASTAPI_FALLBACK_ORIGIN, "http://127.0.0.1:5001");
  assert.equal(
    resolveApiUrl("/api/v1/ppt/themes/all", {
      ...server,
      configuredUrl: "http://fastapi:8000/",
    }),
    "http://fastapi:8000//api/v1/ppt/themes/all",
  );
});

test("JSON requests send accept and content type, form uploads do not", () => {
  assert.deepEqual(getHeader(), {
    "Content-Type": "application/json",
    Accept: "application/json",
  });
  assert.deepEqual(getHeaderForFormData(), {});
  assert.equal(JSON.stringify(getHeader()).includes("Access-Control-Allow-Origin"), false);
});

test("successful bodies keep 204, parsed JSON, and the empty object for broken JSON", async () => {
  assert.equal(await readOkResponseBody(204, async () => ({ ignored: true })), true);
  assert.deepEqual(await readOkResponseBody(200, async () => ({ id: "p1" })), { id: "p1" });
  assert.deepEqual(
    await readOkResponseBody(201, async () => {
      throw new SyntaxError("bad json");
    }),
    {},
  );
});

test("status fallbacks stay stable for 401 and 5xx", () => {
  assert.equal(
    statusFallbackMessage(401, "fallback"),
    "Unauthorized. Please log in and try again.",
  );
  assert.equal(
    statusFallbackMessage(500, "fallback"),
    "Internal server error. Please try again later.",
  );
  assert.equal(
    statusFallbackMessage(502, "fallback"),
    "Bad gateway. The server is temporarily unavailable.",
  );
  assert.equal(statusFallbackMessage(418, "fallback"), "fallback");
});

test("presentation ids are encoded the same way as the export route", () => {
  assert.equal(encodePresentationId("6f1c0b7e-1c2a-4d3e-9a00-abc123"), "6f1c0b7e-1c2a-4d3e-9a00-abc123");
  assert.equal(encodePresentationId("a/b"), "a%2Fb");
  assert.equal(encodePresentationId("  "), "");
});

test("proxy rewrites FastAPI paths, bridges pdf-maker, and rejects API keys on Next routes", () => {
  const base = {
    method: "GET",
    exportSession: null,
    authorization: null,
    forwardedProto: null,
    protocol: "http:",
    apiKeyPrefixes: API_KEY_PREFIXES,
  };

  assert.equal(decideProxyRoute({ ...base, pathname: "/api/v1/ppt/presentation/all" }).action, "rewrite");
  assert.equal(decideProxyRoute({ ...base, pathname: "/app_data/images/a.png" }).action, "rewrite");
  assert.equal(decideProxyRoute({ ...base, pathname: "/static/icons/a.svg" }).action, "rewrite");
  assert.equal(decideProxyRoute({ ...base, pathname: "/api/user-config" }).action, "next");
  assert.equal(
    decideProxyRoute({ ...base, pathname: "/api/v1/ppt/presentation/all", method: "OPTIONS" }).action,
    "rewrite",
  );
  assert.equal(
    decideProxyRoute({ ...base, pathname: "/api/user-config", method: "POST" }).action,
    "next",
  );
  assert.equal(decideProxyRoute({ ...base, pathname: "/pdf-maker" }).action, "next");
  assert.deepEqual(
    decideProxyRoute({
      ...base,
      pathname: "/pdf-maker",
      exportSession: "session-token",
      forwardedProto: "https",
    }),
    { action: "pdf-session", secure: true },
  );
  assert.deepEqual(
    decideProxyRoute({
      ...base,
      pathname: "/pdf-maker",
      exportSession: "session-token",
      protocol: "http:",
    }),
    { action: "pdf-session", secure: false },
  );
  assert.equal(
    decideProxyRoute({
      ...base,
      pathname: "/api/v1/ppt/presentation/all",
      authorization: "Bearer sk-gslide-test",
    }).action,
    "rewrite",
  );
  assert.equal(
    decideProxyRoute({
      ...base,
      pathname: "/api/upload-image",
      authorization: "Bearer sk-presenton-test",
    }).action,
    "reject-api-key",
  );
});
