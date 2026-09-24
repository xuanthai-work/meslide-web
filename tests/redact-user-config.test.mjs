import assert from "node:assert/strict";
import test from "node:test";

import {
  CONFIGURED_SECRET_PLACEHOLDER,
  redactUserConfigSecrets,
} from "../lib/redact-user-config.ts";

test("redacts provider secrets and keeps non-secret startup fields", () => {
  const redacted = redactUserConfigSecrets({
    LLM: "openai",
    OPENAI_API_KEY: "sk-test-secret",
    OPENAI_MODEL: "gpt-4o",
    GOOGLE_API_KEY: "",
    CUSTOM_LLM_API_KEY: "custom-secret",
    CUSTOM_LLM_URL: "https://llm.internal/v1",
    DISABLE_IMAGE_GENERATION: true,
    SEARXNG_BASE_URL: "https://search.internal",
  });

  assert.equal(redacted.OPENAI_API_KEY, CONFIGURED_SECRET_PLACEHOLDER);
  assert.equal(redacted.GOOGLE_API_KEY, "");
  assert.equal(redacted.CUSTOM_LLM_API_KEY, CONFIGURED_SECRET_PLACEHOLDER);
  assert.equal(redacted.LLM, "openai");
  assert.equal(redacted.OPENAI_MODEL, "gpt-4o");
  assert.equal(redacted.CUSTOM_LLM_URL, "https://llm.internal/v1");
  assert.equal(redacted.DISABLE_IMAGE_GENERATION, true);
  assert.equal(redacted.SEARXNG_BASE_URL, "https://search.internal");
  assert.equal(JSON.stringify(redacted).includes("sk-test-secret"), false);
  assert.equal(JSON.stringify(redacted).includes("custom-secret"), false);
});

test("a redacted local config still counts as configured for startup", async () => {
  const { hasValidLLMConfig } = await import("../utils/storeHelpers.ts");
  const redacted = redactUserConfigSecrets({
    LLM: "openai",
    OPENAI_API_KEY: "sk-test-secret",
    OPENAI_MODEL: "gpt-4o",
    DISABLE_IMAGE_GENERATION: true,
  });

  assert.equal(hasValidLLMConfig(redacted), true);
});
