import assert from "node:assert/strict";
import test from "node:test";
import { translate, translateRaw, interpolate } from "../i18n/translate.ts";
import { locales, defaultLocale, fallbackLocale, isLocale, ogLocale } from "../i18n/config.ts";
import vi from "../i18n/locales/vi.ts";
import en from "../i18n/locales/en.ts";

/**
 * Walks a catalog and yields every dot-path leaf key (string or function).
 * Arrays are not part of the message catalog shape.
 */
function* leafKeys(node, prefix = "") {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string" || typeof value === "function") {
      yield path;
    } else if (value && typeof value === "object") {
      yield* leafKeys(value, path);
    } else {
      throw new Error(`unexpected catalog node type at ${path}: ${typeof value}`);
    }
  }
}

const viKeys = new Set(leafKeys(vi));
const enKeys = new Set(leafKeys(en));

test("config: vi-VN is the default locale and en-US is the fallback", () => {
  assert.equal(defaultLocale, "vi-VN");
  assert.equal(fallbackLocale, "en-US");
  assert.deepEqual([...locales], ["vi-VN", "en-US"]);
});

test("config: isLocale guards supported locales", () => {
  assert.equal(isLocale("vi-VN"), true);
  assert.equal(isLocale("en-US"), true);
  assert.equal(isLocale("vi_VN"), false);
  assert.equal(isLocale("fr-FR"), false);
});

test("config: ogLocale maps BCP-47 to language_REGION", () => {
  assert.equal(ogLocale("vi-VN"), "vi_VN");
  assert.equal(ogLocale("en-US"), "en_US");
});

test("vi and en catalogs have identical key structure (parity)", () => {
  const missingFromVi = [...enKeys].filter((k) => !viKeys.has(k));
  const missingFromEn = [...viKeys].filter((k) => !enKeys.has(k));
  assert.deepEqual(
    missingFromVi,
    [],
    `keys present in en but missing from vi: ${missingFromVi.join(", ")}`,
  );
  assert.deepEqual(
    missingFromEn,
    [],
    `keys present in vi but missing from en: ${missingFromEn.join(", ")}`,
  );
});

test("every catalog leaf resolves to a non-empty value", () => {
  for (const key of viKeys) {
    const value = translateRaw(key, {}, "vi-VN");
    assert.ok(value && value.length > 0, `vi leaf ${key} resolved empty`);
  }
  for (const key of enKeys) {
    const value = translateRaw(key, {}, "en-US");
    assert.ok(value && value.length > 0, `en leaf ${key} resolved empty`);
  }
});

test("translate returns Vietnamese by default", () => {
  assert.equal(translate("nav.dashboard"), "Trang chủ");
  assert.equal(translate("common.actions.save"), "Lưu");
});

test("translate returns English when the en-US locale is requested", () => {
  assert.equal(translate("nav.dashboard", undefined, "en-US"), "Dashboard");
  assert.equal(translate("common.actions.save", undefined, "en-US"), "Save");
});

test("named interpolation substitutes params and leaves unknown placeholders intact", () => {
  assert.equal(interpolate("Hello, {name}!", { name: "GSlide" }), "Hello, GSlide!");
  // Unknown placeholder is preserved, not dropped.
  assert.equal(interpolate("Hello, {name}!", {}), "Hello, {name}!");
  // Numbers are coerced to strings.
  assert.equal(interpolate("{count} slides", { count: 3 }), "3 slides");
});

test("missing key falls back to the key string itself", () => {
  // A key that exists in neither catalog should render as the key, never empty.
  assert.equal(translateRaw("does.not.exist.anywhere"), "does.not.exist.anywhere");
});

test("count-aware message functions pluralize via the active locale", () => {
  // English pluralizes; the function receives the locale to branch on.
  assert.equal(translate("common.counts.slides", { count: 1 }, "en-US"), "1 slide");
  assert.equal(translate("common.counts.slides", { count: 5 }, "en-US"), "5 slides");
  // Vietnamese does not inflect for plurality (spec FR-7).
  assert.equal(translate("common.counts.slides", { count: 1 }, "vi-VN"), "1 slide");
  assert.equal(translate("common.counts.slides", { count: 5 }, "vi-VN"), "5 slide");
});

test("root document metadata is Vietnamese", () => {
  assert.match(translate("metadata.title"), /GSlide/);
  assert.match(translate("metadata.description"), /bài thuyết trình/);
  // Keywords are stored comma-separated and split by layout.tsx.
  assert.ok(translate("metadata.keywords").includes(","));
  assert.equal(translate("metadata.siteName"), "GSlide");
});

test("html lang and OG locale values are Vietnamese", () => {
  // layout.tsx renders <html lang="vi"> and og:locale = ogLocale(defaultLocale).
  assert.equal(ogLocale(defaultLocale), "vi_VN");
});

test("advanced settings tone and verbosity options are localized display labels", () => {
  assert.equal(translate("upload.advanced.tones.default"), "Mặc định");
  assert.equal(translate("upload.advanced.tones.casual"), "Thân mật");
  assert.equal(translate("upload.advanced.tones.professional"), "Chuyên nghiệp");
  assert.equal(translate("upload.advanced.tones.funny"), "Hài hước");
  assert.equal(translate("upload.advanced.tones.educational"), "Giáo dục");
  assert.equal(translate("upload.advanced.tones.salesPitch"), "Thuyết trình bán hàng");
  assert.equal(translate("upload.advanced.verbosityOptions.concise"), "Ngắn gọn");
  assert.equal(translate("upload.advanced.verbosityOptions.standard"), "Tiêu chuẩn");
  assert.equal(translate("upload.advanced.verbosityOptions.textHeavy"), "Nhiều chữ");

  assert.equal(
    translate("upload.advanced.tones.salesPitch", undefined, "en-US"),
    "Sales pitch",
  );
  assert.equal(
    translate("upload.advanced.verbosityOptions.textHeavy", undefined, "en-US"),
    "Text-heavy",
  );
});
