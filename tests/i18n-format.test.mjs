import assert from "node:assert/strict";
import test from "node:test";

import { formatDate, formatFileSize, formatNumber } from "../i18n/format.ts";

test("numbers use the active locale and Vietnamese by default", () => {
  assert.equal(formatNumber(1234.5), "1.234,5");
  assert.equal(formatNumber(1234.5, "en-US"), "1,234.5");
});

test("dates use Intl.DateTimeFormat with the active locale", () => {
  const date = new Date(Date.UTC(2026, 8, 5, 12));
  const options = { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" };
  assert.equal(formatDate(date, "vi-VN", options), "05/09/2026");
  assert.equal(formatDate(date, "en-US", options), "09/05/2026");
});

test("file sizes localize decimals without translating the technical unit", () => {
  assert.equal(formatFileSize(1.5 * 1024 * 1024, "vi-VN"), "1,50 MB");
  assert.equal(formatFileSize(1.5 * 1024 * 1024, "en-US"), "1.50 MB");
});
