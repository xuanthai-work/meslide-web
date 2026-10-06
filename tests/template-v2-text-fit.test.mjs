import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  CJK_EM,
  ELLIPSIS,
  LATIN_EM,
  PAINT_SAFETY,
  UNICODE_PAINT_SAFETY,
  VIETNAMESE_BOLD_MULTIPLIER,
  VIETNAMESE_EM,
  characterUnit,
  exceedsVisualCapacity,
  fitTextListToBox,
  fitTextToBox,
  floorFontPx,
  floorScale,
  hasWideGlyphs,
  isSingleLineBox,
  layoutFitTextRuns,
  measureTextByUnits,
  singleLineMinScale,
  textUnits,
  verticalGlyphClipBounds,
  visualCapacityUnits,
} from "../components/slide-editor/text/template-v2-text-fit.mjs";
import {
  canvasFontCss,
  normalizeCanvasFontSpec,
} from "../components/slide-editor/text/template-v2-text-font.mjs";

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

test("title floor shrinks in tiers as designed size grows", () => {
  assert.equal(floorFontPx(64), 64 * 0.35);
  assert.equal(floorFontPx(48), 48 * 0.4);
  assert.equal(floorFontPx(32), 32 * 0.5);
  assert.equal(floorFontPx(18), 18 * 0.72);
  assert.equal(floorFontPx(14), 12);
  assert.equal(floorScale(32), 0.5);
  assert.equal(floorScale(64), 0.35);
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

test("copy that still overflows at the floor is never ellipsized", () => {
  const result = fitTextToBox(
    [{
      text: "word ".repeat(80),
      font: { ...font, size: 32 },
    }],
    { width: 80, height: 80 },
    { measure: wideCharMeasure },
  );
  assert.equal(result.ellipsis, false);
  assert.ok(result.lines.length >= 1);
  for (const line of result.lines) {
    for (const segment of line) {
      assert.ok(!String(segment.text).includes(ELLIPSIS));
    }
  }
});

test("text-list that does not fit the box keeps every item without ellipsis", () => {
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
  assert.equal(result.ellipsis, false);
  assert.ok(result.lines.length >= 12);
  for (const line of result.lines) {
    for (const segment of line) {
      assert.ok(!String(segment.text).includes(ELLIPSIS));
    }
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

test("mixed bold and regular copy wraps without an ellipsis tail", () => {
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
  assert.equal(result.ellipsis, false);
  const tail = result.lines.at(-1).at(-1);
  assert.ok(!String(tail.text).includes(ELLIPSIS));
  assert.ok(Math.abs(tail.width - wideCharMeasure(tail.text, tail.font)) < 1e-6);
});

test("a box narrower than one glyph keeps the whole word without ellipsis", () => {
  const result = fitTextToBox(
    [{ text: "Hello", font: { ...font, size: 200 } }],
    { width: 1, height: 80 },
    { measure: wideCharMeasure },
  );
  assert.equal(result.ellipsis, false);
  assert.ok(result.lines.length >= 1);
  for (const line of result.lines) {
    for (const segment of line) {
      assert.ok(!String(segment.text).includes(ELLIPSIS));
    }
  }
});

test("wrapped copy keeps letterSpacing metrics without an ellipsis tail", () => {
  const spacedFont = { size: 20, bold: false, letterSpacing: 8, lineHeight: 1.15 };
  const result = fitTextToBox(
    [{ text: "ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ", font: spacedFont }],
    { width: 120, height: 80 },
    { measure: measureTextByUnits },
  );
  assert.equal(result.ellipsis, false);
  const tail = result.lines.at(-1).at(-1);
  assert.ok(!String(tail.text).includes(ELLIPSIS));
  assert.ok(Math.abs(tail.width - measureTextByUnits(tail.text, tail.font)) < 1e-6);
});

test("box shorter than one line height keeps the copy on one line without ellipsis", () => {
  const result = fitTextToBox(
    [{ text: "Hello world", font: { ...font, size: 32 } }],
    { width: 800, height: 20 },
    { measure: wideCharMeasure },
  );
  assert.ok(result.lines.length >= 1);
  assert.equal(result.ellipsis, false);
  for (const line of result.lines) {
    for (const segment of line) {
      assert.ok(!String(segment.text).includes(ELLIPSIS));
    }
  }
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

test("canvas font spec strips a style suffix and reports its weight", () => {
  assert.deepEqual(
    normalizeCanvasFontSpec({ family: "Montserrat Medium", bold: false }),
    { family: "Montserrat", weight: 500, sourceFamily: "Montserrat Medium" },
  );
  assert.deepEqual(
    normalizeCanvasFontSpec({ family: "Roboto Medium", bold: false }),
    { family: "Roboto", weight: 500, sourceFamily: "Roboto Medium" },
  );
  assert.deepEqual(
    normalizeCanvasFontSpec({ family: "Inter SemiBold", bold: false }),
    { family: "Inter", weight: 600, sourceFamily: "Inter SemiBold" },
  );
  assert.equal(
    normalizeCanvasFontSpec({ family: "Montserrat Medium", bold: true })
      .weight,
    700,
  );
  assert.equal(
    normalizeCanvasFontSpec({ family: "Montserrat", bold: false }).weight,
    400,
  );
  assert.equal(
    canvasFontCss({ family: "Montserrat Medium", size: 64, bold: false }),
    '500 64px "Montserrat", "Montserrat Medium", Helvetica, Arial, sans-serif',
  );
  assert.equal(
    canvasFontCss({ family: "Montserrat", size: 64, bold: true, italic: true }),
    'italic 700 64px "Montserrat", Helvetica, Arial, sans-serif',
  );
});

test("a designed one-line box is distinguished from a multi-line paragraph box", () => {
  // primary_title in title_stepped_cards_1046: 64px/1.25 in a 79.47px box.
  assert.equal(isSingleLineBox({ width: 786.86, height: 79.47 }, 64), true);
  // supporting_statement in the same layout: 21.33px/1.5 in a 62.27px box.
  assert.equal(isSingleLineBox({ width: 791.37, height: 62.27 }, 21.33), false);
  assert.equal(isSingleLineBox({ width: 400, height: 120 }, 18), false);
  assert.equal(isSingleLineBox({ width: 400, height: 0 }, 18), false);
  assert.equal(singleLineMinScale(64) <= floorScale(64), true);
  assert.equal(singleLineMinScale(64) <= 0.45, true);
});

test("wide glyphs take a paint margin without starving the box", () => {
  assert.equal(hasWideGlyphs("AI in daily life"), false);
  assert.equal(hasWideGlyphs("AI trong Đời sống hàng ngày"), true);
  // 1.14 handed the fitter 87.7% of the box. The unit table already models
  // Vietnamese at 0.72em, so the margin only absorbs rendering drift now.
  assert.equal(UNICODE_PAINT_SAFETY, 1.03);
  assert.ok(PAINT_SAFETY > 0);
  assert.ok(UNICODE_PAINT_SAFETY < 1.14);
});

test("the unicode paint margin keeps copy that fits the box on one line", () => {
  const runFont = { ...font, size: 20, bold: false, letterSpacing: 0 };
  const text = "Kinh nghiệm Đời sống hàng ngày";
  const natural = measureTextByUnits(text, runFont);
  const width = natural * 1.05;
  // The copy sits in the band between the two margins: 1.14 wrapped it a line
  // early and left the right edge of the box empty.
  assert.ok(natural > width / 1.14);

  const fitted = fitTextToBox([{ text, font: runFont }], { width, height: 200 }, {
    measure: measureTextByUnits,
  });

  assert.equal(fitted.lines.length, 1);
  assert.equal(fitted.fontScale, 1);
  assert.equal(fitted.lines[0].map((segment) => segment.text).join(""), text);
});

test("an unbounded box reports the height the wrapped copy needs", () => {
  const runFont = { ...font, size: 20, bold: false, lineHeight: 1.25 };
  const text = "Kinh nghiệm Đời sống hàng ngày và nhiều chữ hơn nữa";
  const box = { width: 200, height: 30 };

  // A finite box shrinks the font to fit the frame.
  const cramped = fitTextToBox([{ text, font: runFont }], box, {
    measure: measureTextByUnits,
  });
  assert.ok(cramped.fontScale < 1);

  // With no height to fit, the same box reports the copy's own height -- what a
  // side resize grows the frame to.
  const natural = fitTextToBox(
    [{ text, font: runFont }],
    { width: box.width, height: Number.MAX_SAFE_INTEGER },
    { measure: measureTextByUnits },
  );
  assert.equal(natural.fontScale, 1);
  assert.ok(natural.height > box.height);
});

test("konva clip windows follow the copy instead of the frame", async () => {
  const source = await read("components/slide-editor/surface/nodes-text.tsx");

  assert.match(source, /Math\.max\(height,\s*totalHeight,\s*fitHeight\)/);
  assert.match(source, /Math\.max\(height,\s*contentHeight,\s*fitHeight\)/);
  assert.doesNotMatch(source, /verticalGlyphClipBounds\(lines,\s*height\)/);
});

test("a side resize lets a text frame follow its wrapped copy", async () => {
  const source = await read("components/slide-editor/surface/nodes.tsx");

  assert.match(source, /HORIZONTAL_RESIZE_ANCHORS\.has\(anchor\)/);
  assert.match(source, /wrappedTextHeight\(/);
  assert.match(source, /if \(contentHeight > nextSize\.height\) nextSize\.height/);
});

test("a long Vietnamese title stays on one line instead of overlapping the box below", () => {
  const titleFont = {
    family: "Montserrat Medium",
    size: 64,
    bold: true,
    italic: false,
    underline: false,
    lineHeight: 1.25,
    letterSpacing: -0.64,
  };
  const box = { width: 786.86, height: 79.47 };
  const result = fitTextToBox(
    [{ text: "AI trong Đời sống hàng ngày", font: titleFont }],
    box,
    { measure: measureTextByUnits },
  );

  assert.equal(result.ellipsis, false);
  assert.equal(result.lines.length, 1);
  assert.equal(
    result.lines[0].map((segment) => segment.text).join(""),
    "AI trong Đời sống hàng ngày",
  );
  assert.ok(result.fontScale < 1);
  assert.ok(result.fontScale + 1e-9 >= singleLineMinScale(64));
  const width = result.lines[0].reduce((sum, segment) => sum + segment.width, 0);
  assert.ok(width <= box.width + 0.5);
  assert.ok(result.height <= box.height + 0.5);
});

test("a one-line box never spends its second line even when shrinking deep", () => {
  const titleFont = { ...font, size: 64, lineHeight: 1.25 };
  const box = { width: 300, height: 80 };
  const result = fitTextToBox(
    [{ text: "AI trong Đời sống hàng ngày", font: titleFont }],
    box,
    { measure: wideCharMeasure },
  );

  assert.equal(result.lines.length, 1);
  assert.equal(result.ellipsis, false);
  for (const segment of result.lines[0]) {
    assert.ok(!String(segment.text).includes(ELLIPSIS));
  }
});

test("a multi-line paragraph box still wraps to a second line", () => {
  const bodyFont = { family: "Montserrat", size: 21.33, lineHeight: 1.5 };
  const box = { width: 791.37, height: 62.27 };
  const result = fitTextToBox(
    [
      {
        text: "Trí tuệ nhân tạo hiện diện trong mọi ngóc ngách của cuộc sống, giúp tối ưu hóa công việc và nâng cao chất lượng trải nghiệm.",
        font: bodyFont,
      },
    ],
    box,
    { measure: wideCharMeasure },
  );

  assert.equal(result.lines.length, 2);
  assert.ok(result.height <= box.height + 0.5);
});

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

const novaTitleFont = {
  family: "Archivo Black",
  size: 71.11,
  bold: true,
  italic: false,
  underline: false,
  lineHeight: 1.15,
  letterSpacing: -0.5,
};

test("large display titles get a deeper tiered shrink floor", () => {
  assert.ok(floorScale(71.11) <= 0.48, `scale ${floorScale(71.11)}`);
  assert.ok(floorFontPx(71.11) >= 20, `px ${floorFontPx(71.11)}`);
});

test("an oversized renderer title fits its box without an extra line", () => {
  const box = { width: 390.22, height: 190.8 };
  const result = fitTextToBox(
    [{ text: "Tầng 3: Renderer — Render Tree", font: novaTitleFont }],
    box,
    { measure: measureTextByUnits },
  );

  assert.equal(result.ellipsis, false);
  // At the tiered floor the copy fits the box's real width on one line. The old
  // 1.14 margin hid 12% of that width and split the title in two.
  assert.equal(result.lines.length, 1);
  assert.ok(result.height <= 95, `height ${result.height}`);
  assert.ok(result.height <= box.height);
});

test("a wide builder title fits in full and clears the canvas bottom", () => {
  const box = { width: 565.62, height: 129.47 };
  const result = fitTextToBox(
    [{ text: "Builder: Chuyển đổi AST sang Tree", font: novaTitleFont }],
    box,
    { measure: measureTextByUnits },
  );

  assert.equal(result.ellipsis, false);
  assert.ok(result.lines.length <= 2);
  assert.equal(
    result.lines.map((line) => line.map((segment) => segment.text).join("")).join(""),
    "Builder: Chuyển đổi AST sang Tree",
  );
  assert.ok(result.height <= box.height);
  const absoluteTop = 12.51 + 492;
  assert.ok(absoluteTop + result.height < 720);
});

const cardLabelFont = {
  family: "Montserrat",
  size: 49.78,
  bold: false,
  italic: false,
  underline: false,
  lineHeight: 1.4,
  letterSpacing: -0.5,
};

const cardLabelPhrases = [
  "Dữ liệu Trực tiếp",
  "Dữ liệu Trò chơi",
  "Phân tích Replay",
];

function visibleCardLabelChars(lines) {
  return lines
    .map((line) => line.map((segment) => segment.text).join(""))
    .join("")
    .replace("…", "").length;
}

test("a narrow card label stays on one line and shrinks below 26px", () => {
  const box = { width: 117.45, height: 66.71 };
  assert.equal(isSingleLineBox(box, cardLabelFont.size), true);

  for (const text of cardLabelPhrases) {
    const result = fitTextToBox([{ text, font: cardLabelFont }], box, {
      measure: measureTextByUnits,
    });
    assert.equal(result.lines.length, 1, text);
    const size = result.lines[0][0].font.size;
    assert.ok(size <= 26, `${text} -> ${size}`);
  }
});

test("a widened card label shows every phrase in full on one line", () => {
  const narrowBox = { width: 117.45, height: 66.71 };
  const wideBox = { width: 248.58, height: 66.71 };

  for (const text of cardLabelPhrases) {
    const narrow = fitTextToBox([{ text, font: cardLabelFont }], narrowBox, {
      measure: measureTextByUnits,
    });
    const wide = fitTextToBox([{ text, font: cardLabelFont }], wideBox, {
      measure: measureTextByUnits,
    });

    assert.equal(wide.lines.length, 1, text);
    assert.equal(wide.ellipsis, false, text);
    assert.ok(wide.height <= wideBox.height);
    assert.ok(wide.fontScale < 1);
    const wideSize = wide.lines[0][0].font.size;
    assert.ok(wideSize >= 20 && wideSize <= 36, `${text} -> ${wideSize}`);
    assert.ok(
      visibleCardLabelChars(wide.lines) >= visibleCardLabelChars(narrow.lines),
      text,
    );
  }
});

test("the replay card label fits in full on one line without ellipsis", () => {
  const box = { width: 248.58, height: 66.71 };
  const text = "Phân tích Replay";
  const result = fitTextToBox([{ text, font: cardLabelFont }], box, {
    measure: measureTextByUnits,
  });

  assert.equal(result.ellipsis, false);
  assert.equal(result.lines.length, 1);
  assert.equal(
    result.lines[0].map((segment) => segment.text).join(""),
    text,
  );
  const size = result.lines[0][0].font.size;
  assert.ok(size >= 20 && size <= 30, `font ${size}`);
  assert.ok(result.height <= box.height);
});
