import assert from "node:assert/strict";
import test from "node:test";
import {
  TONE_CODES,
  TONE_LABEL,
  VERBOSITY_CODES,
  VERBOSITY_LABEL,
} from "../app/(presentation-generator)/upload/config-labels.ts";
import { presentationStructureTogglesRemoved } from "./presentation-config-contract.ts";

test("every tone and verbosity API token has an inlined Vietnamese label", () => {
  assert.deepEqual(TONE_CODES, [
    "default",
    "casual",
    "professional",
    "funny",
    "educational",
    "sales_pitch",
  ]);
  assert.deepEqual(VERBOSITY_CODES, ["concise", "standard", "text-heavy"]);

  for (const code of TONE_CODES) {
    assert.ok(TONE_LABEL[code], `missing tone label for ${code}`);
  }
  for (const code of VERBOSITY_CODES) {
    assert.ok(VERBOSITY_LABEL[code], `missing verbosity label for ${code}`);
  }
});

test("tone and verbosity labels are human-readable, not API tokens", () => {
  for (const code of TONE_CODES) {
    const label = TONE_LABEL[code];
    assert.doesNotMatch(label, /_/, `tone label for ${code} still looks like a token`);
    assert.notEqual(label, code);
  }
  for (const code of VERBOSITY_CODES) {
    const label = VERBOSITY_LABEL[code];
    assert.doesNotMatch(label, /_/, `verbosity label for ${code} still looks like a token`);
    assert.notEqual(label, code);
  }
});

test("title and table-of-contents toggles are absent from presentation config", () => {
  assert.deepEqual(presentationStructureTogglesRemoved, [false, false]);
});
