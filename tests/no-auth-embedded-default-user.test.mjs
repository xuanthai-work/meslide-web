import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const nextRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readNext(relativePath) {
  return readFile(path.join(nextRoot, relativePath), "utf8");
}

test("/auth page is deleted", async () => {
  await assert.rejects(readNext("app/auth/page.tsx"));
});

test("AuthGate and LogoutButton are deleted", async () => {
  await assert.rejects(readNext("components/Auth/AuthGate.tsx"));
  await assert.rejects(readNext("components/Auth/LogoutButton.tsx"));
});

test("root / redirects to /dashboard", async () => {
  const source = await readNext("app/page.tsx");
  assert.match(source, /redirect\(["']\/dashboard["']\)/);
});

test("settings page is removed", async () => {
  await assert.rejects(
    readNext("app/(presentation-generator)/(dashboard)/settings/SettingPage.tsx"),
  );
});

test("proxy does not auth-gate browser requests", async () => {
  const source = await readNext("proxy.ts");
  assert.doesNotMatch(source, /getAuthStatus|isApiAuthExempt/);
  assert.doesNotMatch(source, /detail:\s*["']Unauthorized["']/);
  assert.doesNotMatch(source, /embedded demo user/);
  assert.match(source, /return continueRequest\(request\)/);
});

test("server auth helper reads /api/v1/auth/status instead of a demo user", async () => {
  const source = await readNext("lib/server-auth-role.ts");
  assert.match(source, /\/api\/v1\/auth\/status/);
  assert.doesNotMatch(source, /username:\s*["']demo["']/);
  assert.doesNotMatch(source, /00000000-0000-0000-0000-000000000001/);
});
