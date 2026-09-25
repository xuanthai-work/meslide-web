import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  CJK_EM,
  ELLIPSIS,
  LATIN_EM,
  VIETNAMESE_BOLD_MULTIPLIER,
  VIETNAMESE_EM,
  characterUnit,
  exceedsVisualCapacity,
  fitTextListToBox,
  fitTextToBox,
  floorFontPx,
  floorScale,
  layoutFitTextRuns,
  measureTextByUnits,
  textUnits,
  verticalGlyphClipBounds,
  visualCapacityUnits,
} from "../components/slide-editor/text/template-v2-text-fit.mjs";

const wideCharMeasure = (text, font) => {
  const size = font.size ?? 18;
  return Array.from(text).reduce(
    (sum, ch) => sum + (ch === " " ? 0.3 : 0.8) * size,
    0,
  );
};

const font = {
  family: "Arial",
  size: 32,
  bold: true,
  italic: false,
  underline: false,
  lineHeight: 1.15,
  letterSpacing: 0,
};

test("latin letters use 0.5em and combining marks are free", () => {
  assert.equal(characterUnit("A"), LATIN_EM);
  assert.equal(characterUnit("a\u0300"[1]), 0);
  assert.equal(textUnits("Hi"), 2 * LATIN_EM);
});

test("vietnamese letters are 0.72em and 1.16× when bold", () => {
  assert.equal(characterUnit("ư"), VIETNAMESE_EM);
  assert.equal(characterUnit("Đ", true), VIETNAMESE_EM * VIETNAMESE_BOLD_MULTIPLIER);
  assert.ok(textUnits("Phủ") > textUnits("Phu"));
});

test("cjk uses 1.0em", () => {
  assert.equal(characterUnit("汉"), CJK_EM);
});

test("measureTextByUnits multiplies units by font size and letterSpacing", () => {
  const width = measureTextByUnits("AB", { size: 20, letterSpacing: 2 });
  assert.equal(width, 20 * 2 * LATIN_EM + 2);
});

test("title floor is max(72% size, 16px); body floor is max(72% size, 12px)", () => {
  assert.equal(floorFontPx(32), 32 * 0.72);
  assert.equal(floorFontPx(18), 18 * 0.72);
  assert.equal(floorFontPx(14), 12);
  assert.equal(floorScale(32), 0.72);
  assert.ok(Math.abs(floorScale(14) - 12 / 14) < 1e-9);
});

test("visual capacity treats maxLength as latin 0.5em budget", () => {
  assert.equal(visualCapacityUnits(10), 5);
  assert.equal(exceedsVisualCapacity("AAAAAAAAAA", 10), true);
  assert.equal(exceedsVisualCapacity("AAAAAAAA", 10), false);
  assert.equal(exceedsVisualCapacity("Hello", 40), false);
  assert.equal(exceedsVisualCapacity("ư".repeat(8), 10), true);
});

test("short copy in a wide box does not shrink", () => {
  const result = fitTextToBox(
    [{ text: "Hi", font }],
    { width: 800, height: 80 },
    { measure: wideCharMeasure },
  );
  assert.equal(result.fontScale, 1);
  assert.equal(result.ellipsis, false);
  assert.ok(result.height <= 80);
});

test("large title glyphs can paint beyond a short line box", () => {
  const clip = verticalGlyphClipBounds(
    [[{ text: "Hành Động Ngay", font: { size: 121.6 } }]],
    104,
  );

  assert.ok(clip.y < 0);
  assert.ok(clip.y + clip.height > 104 + 20);
});

test("oversized unspaced token never exceeds box width", () => {
  const result = fitTextToBox(
    [{ text: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", font }],
    { width: 120, height: 80 },
    { measure: wideCharMeasure },
  );
  for (const line of result.lines) {
    const width = line.reduce((sum, segment) => sum + segment.width, 0);
    assert.ok(width <= 120 + 0.5);
  }
});

test("hyphenated compound shrinks instead of wrapping to a dangling hyphen", () => {
  const result = fitTextToBox(
    [{ text: "Vận-động", font }],
    { width: 180, height: 90 },
    { measure: wideCharMeasure },
  );
  const texts = result.lines.map((line) =>
    line.map((segment) => segment.text).join(""),
  );
  assert.equal(texts.join(""), "Vận-động");
  assert.equal(result.lines.length, 1);
  assert.ok(!texts.some((text) => text === "Vận-" || text.endsWith("Vận-")));
  for (const line of result.lines) {
    const width = line.reduce((sum, segment) => sum + segment.width, 0);
    assert.ok(width <= 180 + 0.5);
  }
});

test("a word that can shrink stays whole instead of splitting mid-letter", () => {
  const result = fitTextToBox(
    [{ text: "Riêng", font }],
    { width: 110, height: 80 },
    { measure: wideCharMeasure },
  );
  const texts = result.lines.map((line) =>
    line.map((segment) => segment.text).join(""),
  );
  assert.equal(texts.join(""), "Riêng");
  assert.equal(result.lines.length, 1);
  assert.ok(result.fontScale < 1);
  assert.ok(!texts.some((text) => text === "n" || /Riê$/.test(text)));
  for (const line of result.lines) {
    const width = line.reduce((sum, segment) => sum + segment.width, 0);
    assert.ok(width <= 110 + 0.5);
  }
});

test("tall copy in a one-line box shrinks to the floor and stays inside", () => {
  const result = fitTextToBox(
    [{ text: "Phủ định của phủ định Người thuyết trình", font }],
    { width: 200, height: 40 },
    { measure: wideCharMeasure },
  );
  assert.ok(result.fontScale < 1);
  assert.ok(result.fontScale + 1e-9 >= floorScale(32));
  assert.ok(result.height <= 40 + 0.5);
});

test("copy that still overflows at the floor gets an ellipsis on the last visible line", () => {
  const result = fitTextToBox(
    [{
      text: "word ".repeat(80),
      font: { ...font, size: 32 },
    }],
    { width: 80, height: 80 },
    { measure: wideCharMeasure },
  );
  assert.equal(result.ellipsis, true);
  assert.ok(result.height <= 80 + 0.5);
  const last = result.lines.at(-1);
  assert.ok(last.some((segment) => segment.text.includes(ELLIPSIS)));
  const width = last.reduce((sum, segment) => sum + segment.width, 0);
  assert.ok(width <= 80 + 0.5);
});

test("text-list that does not fit the box shrinks and ellipsizes the last visible item", () => {
  const itemFont = { ...font, size: 18 };
  const result = fitTextListToBox(
    Array.from({ length: 12 }, (_, index) => ({
      marker: "•",
      markerFont: itemFont,
      runs: [{ text: `Mục lục dòng số ${index + 1} rất dài`, font: itemFont }],
    })),
    { width: 180, height: 60 },
    { measure: wideCharMeasure },
  );
  assert.ok(result.fontScale <= 1);
  assert.ok(result.height <= 60 + 0.5);
  if (result.ellipsis) {
    const last = result.lines.at(-1);
    assert.ok(last.some((segment) => String(segment.text).includes(ELLIPSIS)));
  }
});

test("empty runs do not shrink or ellipsize", () => {
  const result = fitTextToBox([], { width: 100, height: 40 }, { measure: wideCharMeasure });
  assert.equal(result.fontScale, 1);
  assert.equal(result.ellipsis, false);
});

test("a run of spaces wider than the box does not produce a line wider than the box", () => {
  const result = fitTextToBox(
    [{ text: " ".repeat(80), font }],
    { width: 50, height: 80 },
    { measure: wideCharMeasure },
  );
  assert.ok(result.lines.length >= 1);
  for (const line of result.lines) {
    const width = line.reduce((sum, segment) => sum + segment.width, 0);
    assert.ok(width <= 50 + 0.5);
  }
});

test("whitespace that does not fit remaining width does not start a new line", () => {
  const small = { ...font, size: 10 };
  const result = fitTextToBox(
    [{ text: `Hi${" ".repeat(40)}there`, font: small }],
    { width: 50, height: 400 },
    { measure: wideCharMeasure },
  );
  assert.ok(result.lines.length >= 1);
  assert.ok(result.lines.length <= 2);
  for (const line of result.lines) {
    const width = line.reduce((sum, segment) => sum + segment.width, 0);
    assert.ok(width <= 50 + 0.5);
  }
  for (const line of result.lines.slice(1)) {
    assert.ok(!/^\s+$/.test(line[0]?.text ?? " "));
  }
});

test("mixed bold and regular ellipsis last-line width stays within the box", () => {
  const regular = { ...font, bold: false, size: 20 };
  const bold = { ...font, bold: true, size: 28 };
  const result = fitTextToBox(
    [
      { text: "Intro ", font: regular },
      { text: "BoldBoldBoldBoldBoldBoldBoldBoldBoldBold", font: bold },
    ],
    { width: 90, height: 60 },
    { measure: wideCharMeasure },
  );
  assert.equal(result.ellipsis, true);
  const last = result.lines.at(-1);
  const width = last.reduce((sum, segment) => sum + segment.width, 0);
  assert.ok(width <= 90 + 0.5);
  const tail = last.at(-1);
  assert.ok(String(tail.text).includes(ELLIPSIS));
  assert.ok(Math.abs(tail.width - wideCharMeasure(tail.text, tail.font)) < 1e-6);
});

test("ellipsis is omitted when it cannot fit the box width", () => {
  const result = fitTextToBox(
    [{ text: "Hello", font: { ...font, size: 200 } }],
    { width: 1, height: 80 },
    { measure: wideCharMeasure },
  );
  assert.equal(result.lines.length, 0);
  assert.equal(result.height, 0);
  for (const line of result.lines) {
    for (const segment of line) {
      assert.ok(segment.width <= 1 + 0.5);
    }
  }
});

test("ellipsis last line respects letterSpacing on the painted string", () => {
  const spacedFont = { size: 20, bold: false, letterSpacing: 8, lineHeight: 1.15 };
  const result = fitTextToBox(
    [{ text: "ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ", font: spacedFont }],
    { width: 120, height: 80 },
    { measure: measureTextByUnits },
  );
  assert.equal(result.ellipsis, true);
  const last = result.lines.at(-1);
  const lineWidth = last.reduce((sum, segment) => sum + segment.width, 0);
  assert.ok(lineWidth <= 120 + 0.5);
  const tail = last.at(-1);
  assert.ok(String(tail.text).includes(ELLIPSIS));
  assert.ok(Math.abs(tail.width - measureTextByUnits(tail.text, tail.font)) < 1e-6);
});

test("box shorter than one line height at floor keeps one ellipsized line", () => {
  const result = fitTextToBox(
    [{ text: "Hello world", font: { ...font, size: 32 } }],
    { width: 800, height: 20 },
    { measure: wideCharMeasure },
  );
  assert.ok(result.lines.length >= 1);
  const last = result.lines.at(-1);
  assert.ok(last.some((segment) => String(segment.text).includes(ELLIPSIS)));
});

test("an oversized latex run stays atomic during layout", () => {
  const latex = String.raw`\frac{very-long-numerator}{very-long-denominator}`;
  const lines = layoutFitTextRuns(
    [{ type: "latex", text: latex, latex, font }],
    40,
    wideCharMeasure,
  );
  const matchingSegments = lines
    .flat()
    .filter((segment) => segment.latex === latex);

  assert.equal(matchingSegments.length, 1);
  assert.equal(matchingSegments[0].text, latex);
});

test("latex uses pre-set width and renderHeight instead of measuring source", () => {
  const lines = layoutFitTextRuns(
    [{
      type: "latex",
      text: String.raw`\frac{a}{b}`,
      latex: String.raw`\frac{a}{b}`,
      font,
      width: 50,
      renderHeight: 40,
    }],
    200,
    () => 999,
  );
  assert.equal(lines.length, 1);
  assert.equal(lines[0][0].width, 50);
  assert.equal(lines[0][0].renderHeight, 40);
});

test("displayMode latex occupies its own line", () => {
  const lines = layoutFitTextRuns(
    [
      { text: "before", font },
      {
        type: "latex",
        text: "x",
        latex: "x",
        font,
        displayMode: true,
        width: 20,
        renderHeight: 20,
      },
      { text: "after", font },
    ],
    800,
    wideCharMeasure,
  );
  assert.ok(lines.length >= 3);
  assert.equal(lines[1][0].type, "latex");
});

test("12px-only run floors at 12px not 18px", () => {
  const small = { ...font, size: 12 };
  const result = fitTextToBox(
    [{ text: "word ".repeat(80), font: small }],
    { width: 80, height: 40 },
    { measure: wideCharMeasure },
  );
  assert.ok(result.fontScale + 1e-9 >= 1);
  for (const segment of result.lines.flat()) {
    assert.ok((segment.font?.size ?? 0) + 1e-9 >= 12);
  }
});

test("text-list continuation lines indent by marker width", () => {
  const itemFont = { ...font, size: 18 };
  const result = fitTextListToBox(
    [{
      marker: "• ",
      markerFont: itemFont,
      runs: [{ text: "word ".repeat(30), font: itemFont }],
    }],
    { width: 120, height: 200 },
    { measure: wideCharMeasure },
  );
  assert.ok(result.lines.length >= 2);
  const markerWidth = result.lines[0][0].width;
  assert.ok(markerWidth > 0);
  assert.equal(result.lines[1][0].text, "");
  assert.equal(result.lines[1][0].width, markerWidth);
});

const read = (relative) => readFile(path.resolve(relative), "utf8");

test("html text lists keep overflow hidden", async () => {
  const source = await read("lib/template-v2-json-to-html.ts");
  const overflowFn = source.slice(
    source.indexOf("function textOverflowStyle("),
    source.indexOf("function textOverflowStyle(") + 220,
  );
  assert.match(overflowFn, /overflow:hidden/);
  assert.doesNotMatch(overflowFn, /overflow:visible/);
  assert.doesNotMatch(overflowFn, /overflow-wrap:anywhere/);
  assert.doesNotMatch(overflowFn, /word-break:break-word/);
  assert.match(overflowFn, /overflow:hidden/);
  assert.doesNotMatch(overflowFn, /overflow:visible/);
  assert.doesNotMatch(overflowFn, /overflow-wrap:anywhere/);
  assert.doesNotMatch(overflowFn, /word-break:break-word/);
  assert.match(source, /fitTextToBox/);
  assert.match(source, /fitTextListToBox/);
  assert.match(
    source,
    /function renderFittedLinesHtml\([\s\S]*font-size:\$\{cssNumber\(fontSize\)\}px/,
  );
  assert.match(
    source,
    /function renderText\([\s\S]*htmlTextFitBox[\s\S]*renderUnfittedRunsHtml/,
  );
});

test("konva text segments pad paint width so wrap=none does not clip glyphs", async () => {
  const source = await read(
    "components/slide-editor/surface/nodes-text.tsx",
  );
  assert.match(source, /fitTextToBox/);
  assert.match(source, /fitTextListToBox/);
  assert.match(source, /function konvaTextPaintWidth/);
  assert.match(source, /width=\{konvaTextPaintWidth\(segment.width\)\}/);
  assert.match(source, /width=\{konvaTextPaintWidth\(token.width\)\}/);
  assert.match(source, /clipWidth=\{width\}/);
  assert.match(source, /clipHeight=\{clip\.height\}/);
});

test("canvas-less measure uses the unit table", async () => {
  const source = await read(
    "components/slide-editor/text/template-v2-text.ts",
  );
  assert.match(source, /measureTextByUnits/);
  assert.doesNotMatch(
    source,
    /text\.length \* font\.size \* \(font\.bold \? 0\.58 : TEXT_AVERAGE_CHAR_EM\)/,
  );
});

test("renderers use canvas-aware fit wrappers and paint fitted lines", async () => {
  const textSource = await read(
    "components/slide-editor/text/template-v2-text.ts",
  );
  const konvaSource = await read(
    "components/slide-editor/surface/nodes-text.tsx",
  );
  const htmlSource = await read("lib/template-v2-json-to-html.ts");

  assert.match(
    textSource,
    /fitRenderTextToBox[\s\S]*measure:\s*measureRenderText/,
  );
  assert.match(
    textSource,
    /fitRenderTextListToBox[\s\S]*measure:\s*measureRenderText/,
  );
  assert.match(konvaSource, /fitRenderTextToBox/);
  assert.match(konvaSource, /fitRenderTextListToBox/);
  assert.match(htmlSource, /fitted\.lines/);
  assert.doesNotMatch(htmlSource, /fitted\.runs\s*\.map/);
  assert.doesNotMatch(htmlSource, /fitted\.items\s*\.map/);
});

test("html preview refits after document fonts are ready", async () => {
  const source = await read(
    "app/(presentation-generator)/components/TemplateV2HtmlSlidePreview.tsx",
  );
  assert.match(source, /document\.fonts/);
  assert.match(source, /fontsReady/);
  assert.match(
    source,
    /templateV2UiToHtmlFragment[\s\S]*fontsReady/,
  );
});
