import assert from "node:assert/strict";
import test from "node:test";
import {
  TONE_CODES,
  TONE_LABEL_KEY,
  VERBOSITY_CODES,
  VERBOSITY_LABEL_KEY,
} from "../app/(presentation-generator)/upload/config-labels.ts";
import vi from "../i18n/locales/vi.ts";
import en from "../i18n/locales/en.ts";
import { presentationStructureTogglesRemoved } from "./presentation-config-contract.ts";

function lookup(catalog, key) {
  let node = catalog;
  for (const part of key.split(".")) {
    if (!node || typeof node !== "object" || !(part in node)) {
      return undefined;
    }
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

test("every tone and verbosity API token has a display label in both catalogs", () => {
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
    const key = TONE_LABEL_KEY[code];
    assert.ok(lookup(vi, key), `missing vi tone label for ${code}`);
    assert.ok(lookup(en, key), `missing en tone label for ${code}`);
  }
  for (const code of VERBOSITY_CODES) {
    const key = VERBOSITY_LABEL_KEY[code];
    assert.ok(lookup(vi, key), `missing vi verbosity label for ${code}`);
    assert.ok(lookup(en, key), `missing en verbosity label for ${code}`);
  }
});

test("English tone and verbosity labels are human-readable, not API tokens", () => {
  for (const code of TONE_CODES) {
    const label = lookup(en, TONE_LABEL_KEY[code]);
    assert.doesNotMatch(label, /_/, `en tone label for ${code} still looks like a token`);
    assert.notEqual(label, code);
  }
  for (const code of VERBOSITY_CODES) {
    const label = lookup(en, VERBOSITY_LABEL_KEY[code]);
    assert.doesNotMatch(label, /_/, `en verbosity label for ${code} still looks like a token`);
    assert.notEqual(label, code);
  }
});

test("title and table-of-contents toggles are absent from presentation config", () => {
  assert.deepEqual(presentationStructureTogglesRemoved, [false, false]);
});
