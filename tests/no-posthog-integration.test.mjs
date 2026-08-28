// Regression test: GSlide no longer ships any PostHog/analytics integration.
//
// Asserts that the active application source, dependencies and BFF routes stay
// free of PostHog so a re-added initializer, wrapper, telemetry-status route,
// captureError call, or privacy toggle is caught immediately.

import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const nextRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readNext(relativePath) {
  return readFile(path.join(nextRoot, relativePath), "utf8");
}

async function assertAbsent(relativePath) {
  await assert.rejects(
    () => access(path.join(nextRoot, relativePath)),
    (error) => error && error.code === "ENOENT",
    `${relativePath} should be removed`,
  );
}

// Terms that may never return to application source. Mirrors the plan's
// acceptance grep (`posthog|telemetry-status|captureError`) plus the removed
// wrapper API surface.
const BANNED = /posthog|telemetry-status|captureError|initPostHog|setTelemetryEnabled/i;

// Application source directories scanned for the banned terms. The tests/
// directory is intentionally excluded: regression tests may reference the
// removed integration by name while asserting its absence.
const SOURCE_DIRS = [
  "app",
  "components",
  "lib",
  "models",
  "store",
  "types",
  "utils",
];

const SKIP_NAMES = new Set(["node_modules", ".next", ".next-build", ".git"]);

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_NAMES.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
      continue;
    }
    if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

test("PostHog dependency and lockfile entries are gone", async () => {
  const pkg = JSON.parse(await readNext("package.json"));
  assert.equal(
    Object.keys(pkg.dependencies ?? {}).includes("posthog-js"),
    false,
    "posthog-js must not be a runtime dependency",
  );
  assert.equal(
    Object.keys(pkg.devDependencies ?? {}).includes("posthog-js"),
    false,
    "posthog-js must not be a dev dependency",
  );

  const lock = await readNext("package-lock.json");
  assert.doesNotMatch(lock, /"node_modules\/posthog-js"/, "posthog-js removed from lockfile");
  assert.doesNotMatch(lock, /@posthog\//, "@posthog/* packages removed from lockfile");
});

test("PostHog files are removed", async () => {
  await assertAbsent("utils/posthog.ts");
  await assertAbsent("utils/analytics.ts");
  await assertAbsent("app/PostHogInitializer.tsx");
  await assertAbsent("app/api/telemetry-status/route.ts");
  await assertAbsent("tests/fakes/posthog-js.mjs");
  await assertAbsent(
    "app/(presentation-generator)/(dashboard)/settings/PrivacySettings.tsx",
  );
});

test("ClientRoot no longer wires a telemetry initializer", async () => {
  const root = await readNext("app/ClientRoot.tsx");
  assert.doesNotMatch(root, /PostHogInitializer/);
  assert.doesNotMatch(root, /initPostHog/);
});

test("settings sidebar no longer offers a telemetry/privacy section", async () => {
  const sidebar = await readNext(
    "app/(presentation-generator)/(dashboard)/settings/SettingSideBar.tsx",
  );
  assert.doesNotMatch(sidebar, /"privacy"/);
  assert.doesNotMatch(sidebar, /Analytics|Privacy controls/);
});

test("proxy no longer exempts a telemetry-status BFF route", async () => {
  const proxy = await readNext("proxy.ts");
  assert.doesNotMatch(proxy, /telemetry-status/);
  assert.doesNotMatch(proxy, /captureError/);
});

test("application source contains no PostHog integration", async () => {
  const offenders = [];
  for (const dir of SOURCE_DIRS) {
    const absDir = path.join(nextRoot, dir);
    let exists = true;
    try {
      await access(absDir);
    } catch {
      exists = false;
    }
    if (!exists) continue;
    for (const file of await walk(absDir)) {
      const text = await readFile(file, "utf8");
      if (BANNED.test(text)) {
        offenders.push(path.relative(nextRoot, file));
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `source files still reference PostHog/telemetry: ${offenders.join(", ")}`,
  );
});
