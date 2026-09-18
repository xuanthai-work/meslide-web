import assert from "node:assert/strict";
import test from "node:test";
import {
  LanguageType,
  LEGACY_LANGUAGE_VALUE,
  toLegacyLanguageValue,
  parseLanguageValue,
  LANGUAGE_LABEL_KEY,
} from "../app/(presentation-generator)/upload/language.ts";
import vi from "../i18n/locales/vi.ts";
import en from "../i18n/locales/en.ts";

/**
 * Phase 4 — presentation-language model. Stable codes are stored internally
 * while the exact legacy display strings (the API wire format, see
 * gslide-api/servers/fastapi/utils/ocr_language.py) are sent to the outline
 * and direct-generation APIs via toLegacyLanguageValue.
 */

/** Resolve a dot-path key to a string leaf in a catalog, or undefined. */
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

const CODES = Object.values(LanguageType);

test("every LanguageType code maps to a non-empty legacy value and round-trips", () => {
  assert.ok(CODES.length > 0);
  for (const code of CODES) {
    const legacy = toLegacyLanguageValue(code);
    assert.ok(
      typeof legacy === "string" && legacy.length > 0,
      `legacy value for ${code} is empty`,
    );
    assert.equal(
      parseLanguageValue(legacy),
      code,
      `round-trip failed for ${code} -> ${legacy}`,
    );
  }
});

test("LEGACY_LANGUAGE_VALUE covers every code with the verbatim legacy strings", () => {
  assert.deepEqual(
    Object.keys(LEGACY_LANGUAGE_VALUE).sort(),
    [...CODES].sort(),
  );
  // Exact wire-format strings for the default and Auto languages.
  assert.equal(
    toLegacyLanguageValue(LanguageType.Vietnamese),
    "Vietnamese (Tiếng Việt)",
  );
  assert.equal(toLegacyLanguageValue(LanguageType.Auto), "Auto (English)");
});

test("parseLanguageValue accepts stable codes", () => {
  for (const code of CODES) {
    assert.equal(parseLanguageValue(code), code);
  }
});

test("parseLanguageValue accepts legacy display strings (backward compatibility)", () => {
  assert.equal(
    parseLanguageValue("Vietnamese (Tiếng Việt)"),
    LanguageType.Vietnamese,
  );
  assert.equal(parseLanguageValue("Auto (English)"), LanguageType.Auto);
  assert.equal(parseLanguageValue("English"), LanguageType.English);
  // Legacy values are trimmed before comparing.
  assert.equal(
    parseLanguageValue("  Vietnamese (Tiếng Việt)  "),
    LanguageType.Vietnamese,
  );
});

test("parseLanguageValue returns null for unknown or empty input", () => {
  assert.equal(parseLanguageValue("Martian"), null);
  assert.equal(parseLanguageValue(""), null);
  assert.equal(parseLanguageValue(null), null);
  assert.equal(parseLanguageValue(undefined), null);
});

test("toLegacyLanguageValue returns null for absent input", () => {
  assert.equal(toLegacyLanguageValue(null), null);
  assert.equal(toLegacyLanguageValue(undefined), null);
});

test("every LANGUAGE_LABEL_KEY resolves to a non-empty string in both catalogs", () => {
  for (const code of CODES) {
    const key = LANGUAGE_LABEL_KEY[code];
    assert.ok(
      typeof key === "string" && key.length > 0,
      `missing label key for ${code}`,
    );
    const viLabel = lookup(vi, key);
    assert.ok(viLabel && viLabel.length > 0, `vi label ${key} is empty`);
    const enLabel = lookup(en, key);
    assert.ok(enLabel && enLabel.length > 0, `en label ${key} is empty`);
  }
});