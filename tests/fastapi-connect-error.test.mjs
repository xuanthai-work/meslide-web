import assert from "node:assert/strict";
import test from "node:test";

import {
  describeFastApiConnectError,
  isRetryableFastApiConnectError,
} from "../lib/fastapi-connect-error.ts";

test("describes Node fetch ECONNREFUSED without a stack", () => {
  const error = Object.assign(new TypeError("fetch failed"), {
    cause: { code: "ECONNREFUSED", address: "172.18.0.3", port: 8000 },
  });
  assert.equal(
    describeFastApiConnectError(error),
    "ECONNREFUSED 172.18.0.3:8000"
  );
  assert.equal(isRetryableFastApiConnectError(error), true);
});

test("non-connect errors are not retried", () => {
  assert.equal(isRetryableFastApiConnectError(new Error("boom")), false);
  assert.equal(describeFastApiConnectError(new Error("boom")), "boom");
});
