// Contract test: no admin persona, every signed-in user has their own keys.
//
// Covers the architectural shift from a single admin-managed provider slot to
// per-user overlay keys backed by process env. Catches:
//   - leftover role-gating on settings/key endpoints,
//   - deleted files returning because someone re-added them.

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(import.meta.dirname, "..");

async function readNext(...parts) {
  const filePath = path.join(ROOT, ...parts);
  return fs.readFile(filePath, "utf8");
}

test("proxy drops setup_required flag", async () => {
  const proxy = await readNext("proxy.ts");
  assert.doesNotMatch(proxy, /setup_required/);
});

test("provider settings are always loaded for the current user", async () => {
  const initializer = await readNext("app/ConfigurationInitializer.tsx");
  const boot = initializer.slice(initializer.indexOf("const fetchUserConfigState"));
  assert.match(boot, /fetchLocalProviderConfigJson/);
  assert.match(boot, /fetchUserConfigJsonWithRetries/);
  const localIdx = boot.indexOf("fetchLocalProviderConfigJson");
  const overlayIdx = boot.indexOf("fetchUserConfigJsonWithRetries");
  assert.ok(localIdx >= 0 && overlayIdx > localIdx);
  const loader = await readNext("lib/startup-llm-config.ts");
  assert.match(loader, /source=local/);
  assert.match(loader, /STARTUP_USER_CONFIG_ATTEMPTS/);
});

test("user-config forwards to /api/v1/settings/provider", async () => {
  const route = await readNext("app/api/user-config/route.ts");
  assert.match(route, /\/api\/v1\/settings\/provider/);
  assert.doesNotMatch(route, /\/api\/v1\/admin\/provider-settings/);
  assert.doesNotMatch(route, /requireAdminApi/);
  assert.doesNotMatch(route, /status:\s*403|immutableResponse/);
  assert.match(route, /searchParams\.get\(["']source["']\) === ["']local["']/);
  assert.match(route, /getEffectiveUserConfig/);
  assert.doesNotMatch(route, /export async function POST/);
  assert.doesNotMatch(route, /method:\s*"PUT"/);
  assert.doesNotMatch(route, /GET_RETRY_DELAYS_MS/);
  assert.doesNotMatch(route, /console\.warn\([^)]+,\s*error\)/);
});

test("server-auth role helper no longer exposes admin roles", async () => {
  const roleHelper = await readNext("lib/server-auth-role.ts");
  assert.doesNotMatch(roleHelper, /requireAdminApi/);
  assert.doesNotMatch(roleHelper, /\brole\b/);
});

test("settings page is removed", async () => {
  await assert.rejects(
    () =>
      readNext(
        "app/(presentation-generator)/(dashboard)/settings/page.tsx",
      ),
    (error) => error && error.code === "ENOENT",
  );
  await assert.rejects(
    () =>
      readNext(
        "app/(presentation-generator)/(dashboard)/settings/SettingPage.tsx",
      ),
    (error) => error && error.code === "ENOENT",
  );
});

test("admin persona files are removed", async () => {
  await assert.rejects(
    () =>
      readNext(
        "app/(presentation-generator)/(dashboard)/admin/AdminPanel.tsx",
      ),
    (error) => error && error.code === "ENOENT",
    "AdminPanel.tsx should be removed",
  );
  await assert.rejects(
    () => readNext("app/(presentation-generator)/(dashboard)/admin/page.tsx"),
    (error) => error && error.code === "ENOENT",
    "admin/page.tsx should be removed",
  );
  await assert.rejects(
    () => readNext("utils/settingsAccess.ts"),
    (error) => error && error.code === "ENOENT",
    "settingsAccess.ts should be removed",
  );
  await assert.rejects(
    () =>
      readNext(
        "app/(presentation-generator)/(dashboard)/settings/UserAccountSettings.tsx",
      ),
    (error) => error && error.code === "ENOENT",
    "UserAccountSettings.tsx should be removed",
  );
});

test("ConfigurationInitializer contains no administrator-specific behavior", async () => {
  const config = await readNext("app/ConfigurationInitializer.tsx");
  assert.doesNotMatch(config, /administrator/i);
  assert.doesNotMatch(config, /\/settings/);
});
