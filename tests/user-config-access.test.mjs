import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("local user-config requires a session and redacts secrets", async () => {
  const route = await read("app/api/user-config/route.ts");
  assert.match(route, /authStatusForRequest/);
  assert.match(route, /redactUserConfigSecrets/);
  assert.match(route, /status:\s*401/);
  assert.match(route, /searchParams\.get\(["']source["']\) === ["']local["']/);
  assert.doesNotMatch(route, /NextResponse\.json\(readLocalProviderConfig\(\)\)/);
  assert.match(route, /\/api\/v1\/settings\/provider/);
});

test("read-file denies a session that has no user id", async () => {
  const route = await read("app/api/read-file/route.ts");
  assert.match(route, /canReadScopedLocalFiles/);
  assert.match(route, /status:\s*401/);
});
