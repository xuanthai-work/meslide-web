import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchLocalProviderConfigJson,
  fetchUserConfigJsonWithRetries,
  isRetryableUserConfigStatus,
  LOCAL_USER_CONFIG_PATH,
  OVERLAY_USER_CONFIG_PATH,
  STARTUP_USER_CONFIG_ATTEMPTS,
} from "../lib/startup-llm-config.ts";

const VALID_CONFIG = {
  LLM: "openai",
  OPENAI_API_KEY: "sk-test",
  OPENAI_MODEL: "gpt-4o",
};

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

test("5xx from the user-config BFF is retryable, 4xx is not", () => {
  assert.equal(isRetryableUserConfigStatus(500), true);
  assert.equal(isRetryableUserConfigStatus(503), true);
  assert.equal(isRetryableUserConfigStatus(401), false);
  assert.equal(isRetryableUserConfigStatus(404), false);
});

test("local provider config does not call FastAPI overlay", async () => {
  const urls = [];
  const result = await fetchLocalProviderConfigJson({
    fetchImpl: async (url) => {
      urls.push(url);
      return jsonResponse(200, VALID_CONFIG);
    },
    sleep: async () => {
      throw new Error("should not sleep on first success");
    },
  });
  assert.deepEqual(result, VALID_CONFIG);
  assert.deepEqual(urls, [LOCAL_USER_CONFIG_PATH]);
});

test("overlay fetch uses /api/user-config without source=local", async () => {
  const urls = [];
  await fetchUserConfigJsonWithRetries({
    fetchImpl: async (url) => {
      urls.push(url);
      return jsonResponse(200, VALID_CONFIG);
    },
    sleep: async () => {
      throw new Error("should not sleep on first success");
    },
  });
  assert.deepEqual(urls, [OVERLAY_USER_CONFIG_PATH]);
});

test("retries overlay after 500 then succeeds", async () => {
  const delays = [];
  let calls = 0;
  const result = await fetchUserConfigJsonWithRetries({
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        return jsonResponse(500, { error: "Unable to read provider settings" });
      }
      return jsonResponse(200, VALID_CONFIG);
    },
    sleep: async (ms) => {
      delays.push(ms);
    },
  });
  assert.deepEqual(result, VALID_CONFIG);
  assert.equal(calls, 2);
  assert.deepEqual(delays, [250]);
});

test("returns null after retryable failures are exhausted", async () => {
  let calls = 0;
  const result = await fetchUserConfigJsonWithRetries({
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse(503, { retryable: true });
    },
    sleep: async () => {},
  });
  assert.equal(result, null);
  assert.equal(calls, STARTUP_USER_CONFIG_ATTEMPTS);
});

test("treats a thrown fetch as retryable", async () => {
  let calls = 0;
  const result = await fetchUserConfigJsonWithRetries({
    fetchImpl: async () => {
      calls += 1;
      throw new Error("fetch failed");
    },
    sleep: async () => {},
  });
  assert.equal(result, null);
  assert.equal(calls, STARTUP_USER_CONFIG_ATTEMPTS);
});

test("does not retry a 4xx", async () => {
  let calls = 0;
  const result = await fetchUserConfigJsonWithRetries({
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse(401, { detail: "Unauthorized" });
    },
    sleep: async () => {
      throw new Error("should not retry 401");
    },
  });
  assert.equal(result, null);
  assert.equal(calls, 1);
});
