import assert from "node:assert/strict";
import test from "node:test";
import {
  LanguageType,
  LEGACY_LANGUAGE_VALUE,
  toLegacyLanguageValue,
  parseLanguageValue,
  LANGUAGE_LABEL,
} from "../app/(presentation-generator)/upload/language.ts";

/**
 * Phase 4 — presentation-language model. Stable codes are stored internally
 * while the exact legacy display strings (the API wire format, see
 * gslide-api/servers/fastapi/utils/ocr_language.py) are sent to the outline
 * and direct-generation APIs via toLegacyLanguageValue.
 */

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

test("every language code has a non-empty inlined Vietnamese label", () => {
  for (const code of CODES) {
    const label = LANGUAGE_LABEL[code];
    assert.ok(
      typeof label === "string" && label.length > 0,
      `missing Vietnamese label for ${code}`,
    );
  }
});