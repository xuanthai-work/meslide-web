import assert from "node:assert/strict";
import test from "node:test";

import {
  canReadScopedLocalFiles,
  normalizeAuthStatus,
} from "../lib/normalize-auth-status.ts";

test("blank user ids are treated as missing", () => {
  const status = normalizeAuthStatus({
    configured: true,
    authenticated: true,
    username: "ada",
    user_id: "   ",
  });

  assert.equal(status.authenticated, true);
  assert.equal(status.username, "ada");
  assert.equal(status.user_id, null);
  assert.equal(canReadScopedLocalFiles(status), false);
});

test("a session with a user id can read scoped files", () => {
  const status = normalizeAuthStatus({
    authenticated: true,
    user_id: " user-1 ",
  });

  assert.equal(status.user_id, "user-1");
  assert.equal(canReadScopedLocalFiles(status), true);
});

test("anonymous sessions cannot read scoped files", () => {
  assert.equal(
    canReadScopedLocalFiles(
      normalizeAuthStatus({ authenticated: false, user_id: "user-1" }),
    ),
    false,
  );
  assert.equal(canReadScopedLocalFiles(normalizeAuthStatus(null)), false);
});
