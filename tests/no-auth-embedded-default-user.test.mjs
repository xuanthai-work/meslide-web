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

test("SettingPage no longer imports LogoutButton", async () => {
  const source = await readNext(
    "app/(presentation-generator)/(dashboard)/settings/SettingPage.tsx"
  );
  assert.doesNotMatch(source, /LogoutButton/);
});

test("proxy does not auth-gate the embedded default-user flow", async () => {
  const source = await readNext("proxy.ts");
  assert.doesNotMatch(source, /getAuthStatus|isApiAuthExempt/);
  assert.doesNotMatch(source, /detail:\s*["']Unauthorized["']/);
  assert.match(source, /return continueRequest\(request\)/);
});
