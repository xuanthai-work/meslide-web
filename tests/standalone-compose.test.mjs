import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readRepo(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("web compose runs only web services on the shared gslide network", async () => {
  const compose = await readRepo("docker-compose.yml");

  assert.match(compose, /^  web:/m);
  assert.match(compose, /^  web-dev:/m);
  assert.doesNotMatch(compose, /^  api:/m);
  assert.doesNotMatch(compose, /^  api-dev:/m);
  assert.doesNotMatch(compose, /^  searxng:/m);
  assert.doesNotMatch(compose, /nginx:1\.27-alpine|image: nginx/i);
  assert.doesNotMatch(compose, /\bproxy\b/);
  assert.match(compose, /FAST_API_INTERNAL_URL=\$\{FAST_API_INTERNAL_URL:-http:\/\/api:8000\}/);
  assert.match(compose, /context: \./);
  assert.match(compose, /dockerfile: Dockerfile/);
  assert.match(compose, /dockerfile: Dockerfile\.dev/);
  assert.match(compose, /name: gslide/);
  assert.match(compose, /aliases:\s*\n\s+- web/);
  assert.match(compose, /:3000"/);
  assert.doesNotMatch(compose, /depends_on:/);
  assert.match(compose, /gslide_app_data:\/app_data:ro/);
  assert.doesNotMatch(compose, /GSLIDE_FEATURE_SMART_MODE|GSLIDE_FEATURE_COMMUNITY/);
  assert.match(
    compose,
    /GSLIDE_FEATURE_DOCUMENT_AWARE_REWRITE=\$\{GSLIDE_FEATURE_DOCUMENT_AWARE_REWRITE:-false\}/,
  );
});

test("web env example only covers the BFF surface", async () => {
  const env = await readRepo(".env.example");

  assert.match(env, /^GSLIDE_WEB_HOST_PORT=3000$/m);
  assert.match(env, /^FAST_API_INTERNAL_URL=http:\/\/api:8000$/m);
  assert.doesNotMatch(env, /^GSLIDE_FEATURE_SMART_MODE|^GSLIDE_FEATURE_COMMUNITY/m);
  assert.match(env, /^GSLIDE_FEATURE_DOCUMENT_AWARE_REWRITE=false$/m);
  assert.doesNotMatch(env, /^OPENAI_API_KEY=/m);
  assert.doesNotMatch(env, /^SEARXNG_BASE_URL=/m);
  assert.doesNotMatch(env, /POSTHOG_/);
  assert.doesNotMatch(env, /DEMO_USERNAME/);
});

test("web kubernetes manifests deploy ClusterIP web without SearXNG or secrets", async () => {
  const web = await readRepo("deploy/kubernetes/10-web.yaml");
  const config = await readRepo("deploy/kubernetes/01-configmap.yaml");

  assert.match(web, /containerPort: 3000/);
  assert.match(web, /type: ClusterIP/);
  assert.match(web, /claimName: gslide-app-data/);
  assert.match(web, /readOnly: true/);
  assert.doesNotMatch(web, /secretRef:/);
  assert.doesNotMatch(web, /searxng/i);
  assert.match(config, /name: gslide-web-config/);
  assert.match(config, /FAST_API_INTERNAL_URL: "http:\/\/api:8000"/);
  assert.doesNotMatch(config, /SEARXNG_BASE_URL/);
  assert.doesNotMatch(config, /OPENAI_API_KEY/);
});
