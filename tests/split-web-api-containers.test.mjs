import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readRoot(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("web Dockerfiles have no chromium and run Next at /app", async () => {
  const web = await readRoot("Dockerfile");
  const webDev = await readRoot("Dockerfile.dev");
  assert.doesNotMatch(web, /chromium/i);
  assert.doesNotMatch(webDev, /chromium/i);
  assert.match(web, /WORKDIR \/app/);
  assert.match(web, /CMD \["node", "server\.js"\]/);
  assert.doesNotMatch(web, /servers\/nextjs/);
  assert.match(webDev, /next dev/);
});

test("export route calls FastAPI and does not spawn bundled export", async () => {
  const route = await readRoot("app/api/export-presentation/route.ts");
  assert.doesNotMatch(route, /runBundledPresentationExport/);
  assert.match(route, /\/api\/v1\/ppt\/presentation\//);
});

test("pdf-maker suspends search params without the app splash", async () => {
  const page = await readRoot("app/(export)/pdf-maker/page.tsx");
  const loading = await readRoot("app/(export)/pdf-maker/loading.tsx");
  assert.match(page, /Suspense/);
  assert.doesNotMatch(page, /['"]use client['"]/);
  assert.match(loading, /return null/);
});

test("next dev does not reuse the production distDir or standalone output", async () => {
  const config = await readRoot("next.config.mjs");
  assert.match(config, /NODE_ENV === ["']production["']/);
  assert.doesNotMatch(config, /^\s*distDir:\s*["']\.next-build["']/m);
  assert.doesNotMatch(config, /^\s*output:\s*["']standalone["']/m);
  assert.match(config, /["']\.next-build["']/);
  assert.match(config, /output:\s*["']standalone["']/);
  assert.match(config, /allowedDevOrigins/);
  assert.match(config, /["']proxy["']/);
});