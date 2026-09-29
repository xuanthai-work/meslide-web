import assert from "node:assert/strict";
import test from "node:test";

import {
  MIN_MULTILINE_LINE_HEIGHT,
  effectiveLineHeight,
} from "../components/slide-editor/text/text-line-height.ts";
import {
  MIN_LETTER_SPACING,
  sanitizeLetterSpacing,
} from "../components/slide-editor/text/text-letter-spacing.ts";

test("effectiveLineHeight clamps multi-line line-height to the safe minimum", () => {
  const clamped = effectiveLineHeight({
    text: "AI, ML\nvà Hệ Thống",
    width: 661,
    fontSize: 151.11,
    lineHeight: 0.78,
    fallback: 1.15,
  });
  assert.ok(clamped >= MIN_MULTILINE_LINE_HEIGHT);
  assert.equal(clamped, MIN_MULTILINE_LINE_HEIGHT);
});

test("effectiveLineHeight respects safe multi-line line-heights", () => {
  assert.equal(
    effectiveLineHeight({
      text: "AI, ML\nvà Hệ Thống",
      width: 661,
      fontSize: 64,
      lineHeight: 1.29,
      fallback: 1.15,
    }),
    1.29,
  );
  assert.equal(
    effectiveLineHeight({
      text: "wrap this line please",
      width: 60,
      fontSize: 18,
      lineHeight: null,
      fallback: 1.15,
    }),
    1.15,
  );
});

test("effectiveLineHeight leaves single-line text at the fallback", () => {
  assert.equal(
    effectiveLineHeight({
      text: "AI",
      width: 661,
      fontSize: 64,
      lineHeight: 0.78,
      fallback: 1.15,
    }),
    1.15,
  );
});

test("sanitizeLetterSpacing clamps deeply negative tracking", () => {
  assert.equal(sanitizeLetterSpacing(-10.73), MIN_LETTER_SPACING);
  assert.equal(sanitizeLetterSpacing(-11.91), MIN_LETTER_SPACING);
  assert.equal(sanitizeLetterSpacing(-8.14), MIN_LETTER_SPACING);
  assert.equal(sanitizeLetterSpacing(-0.5), -0.5);
  assert.equal(sanitizeLetterSpacing(0.19), 0.19);
});

test("sanitizeLetterSpacing handles missing or invalid values", () => {
  assert.equal(sanitizeLetterSpacing(null), 0);
  assert.equal(sanitizeLetterSpacing(undefined), 0);
  assert.equal(sanitizeLetterSpacing(Number.NaN), 0);
  assert.equal(sanitizeLetterSpacing(Number.POSITIVE_INFINITY), 0);
});

test("sanitizeLetterSpacing keeps values at or above the floor", () => {
  assert.equal(sanitizeLetterSpacing(MIN_LETTER_SPACING), MIN_LETTER_SPACING);
  assert.equal(sanitizeLetterSpacing(-1.4), -1.4);
  assert.equal(sanitizeLetterSpacing(2), 2);
});
