# Template V2 Text Fit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Template V2 text and text-list never clip mid-glyph or paint over siblings: wrap, shrink to a floor, then ellipsis at render; one visual-capacity LLM repair at generate.

**Architecture:** A dependency-free `template-v2-text-fit.mjs` owns the unit table, wrap, shrink, and ellipsis. Konva and HTML export call the same `fitTextToBox` / `fitTextListToBox`. The API copies the unit table into `generate_slide_content.py` and triggers the existing single repair pass on visual overflow, not only exact `maxLength`.

**Tech Stack:** Next.js / Konva (gslide-web), Node `node --test` `*.test.mjs`, FastAPI + pytest (gslide-api).

**Spec:** `docs/superpowers/specs/2026-09-18-template-v2-text-fit-design.md`

## Global Constraints

- Template V2 only. Do not change Smart HTML or `v1-standard`.
- Authored boxes do not move. No sibling reflow.
- Do not mutate stored `font.size` or template `max_length`. Fit is render-time scale.
- Shrink floor: `max(0.72 × designed size, 16px)` when designed size ≥ 24px; `max(0.72 × designed size, 12px)` otherwise.
- One existing LLM repair pass. Do not add extra rounds.
- Elements in scope: `text` and `text-list` only. Tables unchanged.
- Canvas `measureText` is the browser source of truth. Unit table is the no-canvas path and the API.
- Unit table: combining marks 0; CJK 1.0; Vietnamese letters 0.72 (×1.16 if bold); other scalars 0.5. `capacity_units(maxLength) = maxLength × 0.5`. Overflow when `sum(units) > 0.95 × capacity`.
- Implement on GitHub `gslide-web` and `gslide-api`. No GitLab-only behavior.
- Do not commit secrets. Commit only files named in the task.

## File map

| File | Responsibility |
|---|---|
| `gslide-web/components/slide-editor/text/template-v2-text-fit.mjs` | Unit table, wrap, `fitTextToBox`, `fitTextListToBox`, ellipsis. No React/Konva/Katex. |
| `gslide-web/components/slide-editor/text/template-v2-text-fit.d.ts` | Types for the `.mjs` module. |
| `gslide-web/components/slide-editor/text/template-v2-text.ts` | Default canvas measure; re-export fit; no-canvas fallback uses unit table. |
| `gslide-web/components/slide-editor/surface/nodes-text.tsx` | Fit then paint; measured Konva `width`; clip group to box. |
| `gslide-web/lib/template-v2-json-to-html.ts` | Fit before emit; text/text-list `overflow:hidden`. |
| `gslide-web/tests/template-v2-text-fit.test.mjs` | Behavioral fit tests + source contracts. |
| `gslide-api/servers/fastapi/utils/llm_calls/generate_slide_content.py` | Visual units, issue trigger, tighter repair ceiling, prompt line. |
| `gslide-api/servers/fastapi/tests/unit/test_generate_slide_content.py` | Visual overflow / repair tests. |

---

### Task 1: Unit table and no-canvas measure

**Files:**
- Create: `gslide-web/components/slide-editor/text/template-v2-text-fit.mjs`
- Create: `gslide-web/components/slide-editor/text/template-v2-text-fit.d.ts`
- Create: `gslide-web/tests/template-v2-text-fit.test.mjs`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `LATIN_EM = 0.5`
  - `VIETNAMESE_EM = 0.72`
  - `VIETNAMESE_BOLD_MULTIPLIER = 1.16`
  - `CJK_EM = 1`
  - `FIT_CAPACITY_RATIO = 0.95`
  - `FIT_TARGET_RATIO = 0.8`
  - `SHRINK_RATIO = 0.72`
  - `TITLE_MIN_PX = 16`
  - `BODY_MIN_PX = 12`
  - `TITLE_SIZE_THRESHOLD = 24`
  - `ELLIPSIS = "…"`
  - `characterUnit(ch: string, bold?: boolean): number`
  - `textUnits(text: string, bold?: boolean): number`
  - `measureTextByUnits(text: string, font: { size: number, bold?: boolean, letterSpacing?: number }): number`
  - `floorFontPx(designedSize: number): number`
  - `floorScale(designedSize: number): number`
  - `visualCapacityUnits(maxLength: number): number`
  - `exceedsVisualCapacity(text: string, maxLength: number, bold?: boolean): boolean`

Working directory for all commands in this task: `gslide-web` repo root (`D:\work\Gapo\gslide\gslide-web`).

- [ ] **Step 1: Write the failing test**

Create `tests/template-v2-text-fit.test.mjs`:

```javascript
import assert from "node:assert/strict";
import test from "node:test";
import {
  CJK_EM,
  LATIN_EM,
  VIETNAMESE_BOLD_MULTIPLIER,
  VIETNAMESE_EM,
  characterUnit,
  exceedsVisualCapacity,
  floorFontPx,
  floorScale,
  measureTextByUnits,
  textUnits,
  visualCapacityUnits,
} from "../components/slide-editor/text/template-v2-text-fit.mjs";

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
  assert.equal(exceedsVisualCapacity("AAAAAAAAAA", 10), false);
  assert.equal(exceedsVisualCapacity("ư".repeat(8), 10), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/template-v2-text-fit.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `template-v2-text-fit.mjs`.

- [ ] **Step 3: Write minimal implementation**

Create `components/slide-editor/text/template-v2-text-fit.mjs`:

```javascript
export const LATIN_EM = 0.5;
export const VIETNAMESE_EM = 0.72;
export const VIETNAMESE_BOLD_MULTIPLIER = 1.16;
export const CJK_EM = 1;
export const FIT_CAPACITY_RATIO = 0.95;
export const FIT_TARGET_RATIO = 0.8;
export const SHRINK_RATIO = 0.72;
export const TITLE_MIN_PX = 16;
export const BODY_MIN_PX = 12;
export const TITLE_SIZE_THRESHOLD = 24;
export const ELLIPSIS = "…";
export const FIT_SCALE_EPSILON = 0.001;

const VIETNAMESE_RE =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/u;
const COMBINING_RE = /\p{M}/u;
const CJK_RE = /[\u3000-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF]/u;

export function characterUnit(ch, bold = false) {
  if (!ch) return 0;
  if (COMBINING_RE.test(ch)) return 0;
  if (CJK_RE.test(ch)) return CJK_EM;
  const unit = VIETNAMESE_RE.test(ch) ? VIETNAMESE_EM : LATIN_EM;
  return bold && VIETNAMESE_RE.test(ch)
    ? unit * VIETNAMESE_BOLD_MULTIPLIER
    : unit;
}

export function textUnits(text, bold = false) {
  return Array.from(text ?? "").reduce(
    (sum, ch) => sum + characterUnit(ch, bold),
    0,
  );
}

export function measureTextByUnits(text, font) {
  const size = Number(font?.size) > 0 ? font.size : 18;
  const spacing = Number(font?.letterSpacing) || 0;
  const chars = Array.from(text ?? "");
  const units = textUnits(text ?? "", Boolean(font?.bold));
  return units * size + spacing * Math.max(0, chars.length - 1);
}

export function floorFontPx(designedSize) {
  const size = Number(designedSize) > 0 ? designedSize : 18;
  const minPx = size >= TITLE_SIZE_THRESHOLD ? TITLE_MIN_PX : BODY_MIN_PX;
  return Math.max(size * SHRINK_RATIO, minPx);
}

export function floorScale(designedSize) {
  const size = Number(designedSize) > 0 ? designedSize : 18;
  return Math.min(1, floorFontPx(size) / size);
}

export function visualCapacityUnits(maxLength) {
  return Math.max(0, Number(maxLength) || 0) * LATIN_EM;
}

export function exceedsVisualCapacity(text, maxLength, bold = false) {
  return textUnits(text, bold) > FIT_CAPACITY_RATIO * visualCapacityUnits(maxLength);
}
```

Create `components/slide-editor/text/template-v2-text-fit.d.ts` declaring every export above with the signatures in **Produces**.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/template-v2-text-fit.test.mjs`

Expected: PASS (all tests in that file).

- [ ] **Step 5: Commit**

```bash
git add components/slide-editor/text/template-v2-text-fit.mjs components/slide-editor/text/template-v2-text-fit.d.ts tests/template-v2-text-fit.test.mjs
git commit -m "$(cat <<'EOF'
feat: add Template V2 text unit table for Vietnamese width

EOF
)"
```

On Windows PowerShell, if heredoc is unavailable:

```powershell
git add components/slide-editor/text/template-v2-text-fit.mjs components/slide-editor/text/template-v2-text-fit.d.ts tests/template-v2-text-fit.test.mjs
git commit -m "feat: add Template V2 text unit table for Vietnamese width"
```

---

### Task 2: Wrap, shrink, and ellipsis

**Files:**
- Modify: `gslide-web/components/slide-editor/text/template-v2-text-fit.mjs`
- Modify: `gslide-web/components/slide-editor/text/template-v2-text-fit.d.ts`
- Modify: `gslide-web/tests/template-v2-text-fit.test.mjs`

**Interfaces:**
- Consumes: Task 1 `measureTextByUnits`, `floorScale`, `ELLIPSIS`, `FIT_SCALE_EPSILON`
- Produces:
  - `scaleFitFont(font, scale) => font`
  - `scaleFitRuns(runs, scale) => runs` (also scales `renderHeight` if present)
  - `layoutFitTextRuns(runs, width, measure) => Array<Array<run & { width: number }>>`
  - `fitTextToBox(runs, box, options?) => { runs, fontScale, lines, ellipsis: boolean, height: number }`
  - `fitTextListToBox(items, box, options?) => { items, fontScale, lines, ellipsis: boolean, height: number }`
  - `box` is `{ width: number, height: number }`
  - `options.measure` defaults to `measureTextByUnits`
  - `items` is `Array<{ marker: string, markerFont, runs }>`

Working directory: `D:\work\Gapo\gslide\gslide-web`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/template-v2-text-fit.test.mjs`:

```javascript
import {
  ELLIPSIS,
  fitTextListToBox,
  fitTextToBox,
  floorScale,
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
    { width: 80, height: 24 },
    { measure: wideCharMeasure },
  );
  assert.equal(result.ellipsis, true);
  assert.ok(result.height <= 24 + 0.5);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/template-v2-text-fit.test.mjs`

Expected: FAIL with `fitTextToBox is not a function` (or named export missing).

- [ ] **Step 3: Write minimal implementation**

Append to `template-v2-text-fit.mjs` (keep Task 1 exports):

```javascript
function cloneFont(font) {
  return { ...(font ?? {}), size: Number(font?.size) > 0 ? font.size : 18 };
}

export function scaleFitFont(font, scale) {
  const next = cloneFont(font);
  next.size = Math.max(1, next.size * scale);
  return next;
}

export function scaleFitRuns(runs, scale) {
  return (runs ?? []).map((run) => ({
    ...run,
    font: scaleFitFont(run.font, scale),
    renderHeight:
      typeof run.renderHeight === "number"
        ? run.renderHeight * scale
        : run.renderHeight,
  }));
}

function splitOversized(text, font, maxWidth, measure) {
  const fullWidth = measure(text, font);
  if (!text || maxWidth <= 0 || fullWidth <= maxWidth) {
    return [{ text, width: fullWidth, font }];
  }
  const characters = Array.from(text);
  const segments = [];
  let start = 0;
  while (start < characters.length) {
    let low = start + 1;
    let high = characters.length;
    let bestEnd = low;
    let bestWidth = measure(characters.slice(start, low).join(""), font);
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = characters.slice(start, mid).join("");
      const candidateWidth = measure(candidate, font);
      if (candidateWidth <= maxWidth || mid === start + 1) {
        bestEnd = mid;
        bestWidth = candidateWidth;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    segments.push({
      text: characters.slice(start, bestEnd).join(""),
      width: bestWidth,
      font,
    });
    start = bestEnd;
  }
  return segments;
}

export function layoutFitTextRuns(runs, width, measure) {
  const lines = [[]];
  let lineWidth = 0;
  const pushLine = () => {
    if (lines[lines.length - 1]?.length === 0) return;
    lines.push([]);
    lineWidth = 0;
  };
  for (const run of runs ?? []) {
    const parts = String(run.text ?? "").match(/\n|[^\S\n]+|[^\s]+/g) ?? [""];
    for (const part of parts) {
      if (part === "\n") {
        pushLine();
        continue;
      }
      const isWhitespace = /^\s+$/u.test(part);
      const pieces = !isWhitespace
        ? splitOversized(part, run.font, width, measure)
        : [{ text: part, width: measure(part, run.font), font: run.font }];
      for (const piece of pieces) {
        if (
          !isWhitespace &&
          lineWidth > 0 &&
          lineWidth + piece.width > width
        ) {
          pushLine();
        }
        const segment = { ...run, ...piece, width: piece.width };
        lines[lines.length - 1].push(segment);
        lineWidth += piece.width;
      }
    }
  }
  return lines.filter((line) => line.length > 0);
}

function lineWidthOf(line) {
  return line.reduce((sum, segment) => sum + segment.width, 0);
}

function lineHeightOf(line, fallback = 1.15) {
  return Math.max(
    1,
    ...line.map(
      (segment) =>
        segment.renderHeight ??
        (segment.font?.size ?? 18) * (segment.font?.lineHeight ?? fallback),
    ),
  );
}

function layoutHeight(lines) {
  return lines.reduce((sum, line) => sum + lineHeightOf(line), 0);
}

function layoutFits(lines, box) {
  if (layoutHeight(lines) > box.height + 0.01) return false;
  return lines.every((line) => lineWidthOf(line) <= box.width + 0.01);
}

function graphemes(text) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    return Array.from(
      new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
      (part) => part.segment,
    );
  }
  return Array.from(text);
}

function ellipsizeLine(line, maxWidth, measure) {
  const font = line[0]?.font ?? { size: 18 };
  const ellipsisWidth = measure(ELLIPSIS, font);
  let copy = line.map((segment) => ({ ...segment }));
  const widthOf = () => lineWidthOf(copy);
  while (copy.length && widthOf() + ellipsisWidth > maxWidth) {
    const last = copy[copy.length - 1];
    const parts = graphemes(last.text);
    if (parts.length <= 1) {
      copy.pop();
      continue;
    }
    last.text = parts.slice(0, -1).join("");
    last.width = measure(last.text, last.font);
  }
  if (!copy.length) {
    return [
      {
        text: ELLIPSIS,
        font,
        width: Math.min(ellipsisWidth, maxWidth),
      },
    ];
  }
  const tail = copy[copy.length - 1];
  tail.text = `${tail.text}${ELLIPSIS}`;
  tail.width = measure(tail.text, tail.font);
  return copy;
}

function applyEllipsis(lines, box, measure) {
  const kept = [];
  let y = 0;
  for (const line of lines) {
    const height = lineHeightOf(line);
    if (y + height > box.height + 0.01) break;
    kept.push(line);
    y += height;
  }
  if (!kept.length && lines[0]) kept.push(lines[0]);
  kept[kept.length - 1] = ellipsizeLine(
    kept[kept.length - 1],
    box.width,
    measure,
  );
  return kept;
}

function designedSizeOf(runs) {
  return Math.max(18, ...runs.map((run) => Number(run.font?.size) || 18));
}

export function fitTextToBox(runs, box, options = {}) {
  const measure = options.measure ?? measureTextByUnits;
  const source = Array.isArray(runs) ? runs : [];
  if (source.length === 0 || !(box?.width > 0) || !(box?.height > 0)) {
    return { runs: source, fontScale: 1, lines: [], ellipsis: false, height: 0 };
  }
  const layout = (scale) =>
    layoutFitTextRuns(scaleFitRuns(source, scale), box.width, measure);
  let lines = layout(1);
  if (layoutFits(lines, box)) {
    return { runs: source, fontScale: 1, lines, ellipsis: false, height: layoutHeight(lines) };
  }
  const minScale = floorScale(designedSizeOf(source));
  let low = minScale;
  let high = 1;
  let bestScale = minScale;
  let bestLines = layout(minScale);
  while (high - low > FIT_SCALE_EPSILON) {
    const mid = (low + high) / 2;
    const probe = layout(mid);
    if (layoutFits(probe, box)) {
      bestScale = mid;
      bestLines = probe;
      low = mid;
    } else {
      high = mid;
    }
  }
  let ellipsis = false;
  if (!layoutFits(bestLines, box)) {
    bestLines = applyEllipsis(bestLines, box, measure);
    ellipsis = true;
    bestScale = minScale;
  }
  return {
    runs: scaleFitRuns(source, bestScale),
    fontScale: bestScale,
    lines: bestLines,
    ellipsis,
    height: layoutHeight(bestLines),
  };
}

export function fitTextListToBox(items, box, options = {}) {
  const measure = options.measure ?? measureTextByUnits;
  const source = Array.isArray(items) ? items : [];
  if (source.length === 0 || !(box?.width > 0) || !(box?.height > 0)) {
    return { items: source, fontScale: 1, lines: [], ellipsis: false, height: 0 };
  }
  const asRuns = (scale) => {
    const lines = [];
    for (const item of source) {
      const markerFont = scaleFitFont(item.markerFont, scale);
      const marker = item.marker
        ? {
            text: item.marker,
            font: markerFont,
            width: measure(item.marker, markerFont),
          }
        : null;
      const indent = marker?.width ?? 0;
      const contentLines = layoutFitTextRuns(
        scaleFitRuns(item.runs, scale),
        Math.max(1, box.width - indent),
        measure,
      );
      contentLines.forEach((line, index) => {
        const row = index === 0 && marker ? [marker, ...line] : line;
        lines.push(row);
      });
    }
    return lines;
  };
  const dummyRuns = source.flatMap((item) => item.runs ?? []);
  const minScale = floorScale(
    designedSizeOf(dummyRuns.length ? dummyRuns : [{ font: { size: 18 } }]),
  );
  let lines = asRuns(1);
  if (layoutFits(lines, box)) {
    return { items: source, fontScale: 1, lines, ellipsis: false, height: layoutHeight(lines) };
  }
  let low = minScale;
  let high = 1;
  let bestScale = minScale;
  let bestLines = asRuns(minScale);
  while (high - low > FIT_SCALE_EPSILON) {
    const mid = (low + high) / 2;
    const probe = asRuns(mid);
    if (layoutFits(probe, box)) {
      bestScale = mid;
      bestLines = probe;
      low = mid;
    } else {
      high = mid;
    }
  }
  let ellipsis = false;
  if (!layoutFits(bestLines, box)) {
    bestLines = applyEllipsis(bestLines, box, measure);
    ellipsis = true;
    bestScale = minScale;
  }
  return {
    items: source.map((item) => ({
      ...item,
      markerFont: scaleFitFont(item.markerFont, bestScale),
      runs: scaleFitRuns(item.runs, bestScale),
    })),
    fontScale: bestScale,
    lines: bestLines,
    ellipsis,
    height: layoutHeight(bestLines),
  };
}
```

Update `template-v2-text-fit.d.ts` with the new exports. `fitTextListToBox` binary-searches `asRuns(scale)` so marker width is part of the fit.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/template-v2-text-fit.test.mjs`

Expected: PASS. Do not weaken the list test.

- [ ] **Step 5: Commit**

```powershell
git add components/slide-editor/text/template-v2-text-fit.mjs components/slide-editor/text/template-v2-text-fit.d.ts tests/template-v2-text-fit.test.mjs
git commit -m "feat: shrink and ellipsize Template V2 text to the authored box"
```

---

### Task 3: Konva and HTML export use the same fit

**Files:**
- Modify: `gslide-web/components/slide-editor/text/template-v2-text.ts` (`TEXT_AVERAGE_CHAR_EM` / `measureRenderText` around lines 50 and 1591–1603)
- Modify: `gslide-web/components/slide-editor/surface/nodes-text.tsx` (both `RawRichTextElement` and `RawTextListElement`)
- Modify: `gslide-web/lib/template-v2-json-to-html.ts` (`renderText`, `renderTextList`, `textOverflowStyle` around lines 466–512 and 991–993)
- Modify: `gslide-web/tests/template-v2-text-fit.test.mjs`

**Interfaces:**
- Consumes: `fitTextToBox`, `fitTextListToBox`, `measureTextByUnits` from `template-v2-text-fit.mjs`
- Produces: editor and PDF HTML both paint fitted text inside the authored box; Konva `Text` has `width={segment.width}`

Working directory: `D:\work\Gapo\gslide\gslide-web`.

- [ ] **Step 1: Write the failing source-contract tests**

Append to `tests/template-v2-text-fit.test.mjs`:

```javascript
import { readFile } from "node:fs/promises";
import path from "node:path";

const read = (relative) => readFile(path.resolve(relative), "utf8");

test("html text overflow is hidden, not visible", async () => {
  const source = await read("lib/template-v2-json-to-html.ts");
  assert.match(
    source,
    /function textOverflowStyle\(\)[\s\S]*overflow:hidden/,
  );
  assert.doesNotMatch(
    source,
    /function textOverflowStyle\(\)[\s\S]*overflow:visible/,
  );
  assert.match(source, /fitTextToBox/);
  assert.match(source, /fitTextListToBox/);
});

test("konva text segments set measured width and clip to the box", async () => {
  const source = await read(
    "components/slide-editor/surface/nodes-text.tsx",
  );
  assert.match(source, /fitTextToBox/);
  assert.match(source, /fitTextListToBox/);
  assert.match(source, /width=\{segment\.width\}/);
  assert.match(source, /clipWidth=\{width\}/);
  assert.match(source, /clipHeight=\{height\}/);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/template-v2-text-fit.test.mjs`

Expected: FAIL on `overflow:hidden` / `width={segment.width}` / `measureTextByUnits` assertions.

- [ ] **Step 3: Wire the implementation**

In `template-v2-text.ts`:

1. Import `measureTextByUnits` from `./template-v2-text-fit.mjs`.
2. Re-export `fitTextToBox` and `fitTextListToBox` from that module.
3. Replace the `measureRenderText` fallback:

```typescript
function measureRenderText(text: string, font: RenderTextFont) {
  if (typeof document === "undefined") {
    return measureTextByUnits(text, font);
  }
  renderTextMeasureCanvas ??= document.createElement("canvas");
  const context = renderTextMeasureCanvas.getContext("2d");
  if (!context) return measureTextByUnits(text, font);
  context.font = richFontCss(font);
  return (
    context.measureText(text).width +
    (font.letterSpacing ?? 0) * Math.max(0, text.length - 1)
  );
}
```

Leave `TEXT_AVERAGE_CHAR_EM` in `model.ts` / `flowLayout.ts` alone (editor transforms, not this bug).

In `nodes-text.tsx` `RawRichTextElement`:

1. Import `fitTextToBox`.
2. After building `layoutRuns`, call:

```tsx
const fitted = fitTextToBox(layoutRuns, { width, height });
const lines = fitted.lines;
```

3. Use `fitted.lines` instead of `layoutRenderTextRuns(...)`. Keep alignment math. Recompute `lineMetrics` from fitted lines.
4. Wrap the returned `<Group>` with clip:

```tsx
<Group
  listening={interactive}
  clipX={0}
  clipY={0}
  clipWidth={width}
  clipHeight={height}
>
```

5. On each Konva `<Text>`, set `width={segment.width}` and `fontSize={segment.font.size}`. Remove the comment that says to keep width automatic.

In `RawTextListElement`:

```tsx
import { fitTextListToBox, rawTextListRenderItems } from "...";

const items = rawTextListRenderItems(element);
const fitted = fitTextListToBox(items, { width, height });
```

Paint `fitted.lines` the same way tokens are painted today (x/y from `lineStartX` + cumulative y), or map fitted lines onto `LaidToken`s. Clip the list `Group` the same way. Set Konva `width={token.width}` on non-latex `Text` nodes (today they also omit width).

In `lib/template-v2-json-to-html.ts`:

1. Import `fitTextToBox`, `fitTextListToBox` from `@/components/slide-editor/text/template-v2-text-fit.mjs`.
2. Import `readBox` if not already in scope (it is exported from `template-v2-html-shared`; this file already imports `boxStyle` from there — add `readBox` to that import).
3. Change:

```typescript
function textOverflowStyle(): string {
  return "overflow:hidden;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;";
}
```

4. In `renderText`, read `const box = readBox(item);`, build runs as today, call `fitTextToBox(runsAsFitRuns, { width: box.width ?? 0, height: box.height ?? 0 })`, and emit `font-size` from `fitted.runs[0]?.font.size` (and per-run sizes). Do not write back into `item.font`.
5. In `renderTextList`, call `fitTextListToBox` with list items converted to `{ marker, markerFont, runs }`, emit fitted font sizes, keep `textOverflowStyle()`.

Do not change `overflow:visible` on vectors, math, flex, or groups.

- [ ] **Step 4: Run tests**

Run: `node --test tests/template-v2-text-fit.test.mjs`

Expected: PASS.

Then: `npx eslint components/slide-editor/text/template-v2-text.ts components/slide-editor/surface/nodes-text.tsx lib/template-v2-json-to-html.ts tests/template-v2-text-fit.test.mjs`

Expected: no new errors.

- [ ] **Step 5: Commit**

```powershell
git add components/slide-editor/text/template-v2-text.ts components/slide-editor/surface/nodes-text.tsx lib/template-v2-json-to-html.ts tests/template-v2-text-fit.test.mjs
git commit -m "fix: fit Template V2 text inside authored boxes in editor and PDF"
```

---

### Task 4: API visual-capacity issues

**Files:**
- Modify: `gslide-api/servers/fastapi/utils/llm_calls/generate_slide_content.py` (`_content_fit_issues` at lines 271–329; add helpers near `_content_fit_target`)
- Modify: `gslide-api/servers/fastapi/tests/unit/test_generate_slide_content.py`

**Interfaces:**
- Consumes: spec unit table (same numbers as Task 1)
- Produces:
  - `_LATIN_EM = 0.5`, `_VIETNAMESE_EM = 0.72`, `_VIETNAMESE_BOLD_MULTIPLIER = 1.16`, `_CJK_EM = 1.0`, `_FIT_CAPACITY_RATIO = 0.95`
  - `_character_unit(ch: str, bold: bool) -> float`
  - `_text_units(text: str, bold: bool) -> float`
  - `_field_is_display_bold(path: str, schema: dict) -> bool` — last path segment in `{title, heading, name, metric, label}` (case-insensitive) or schema `description` contains `title` or `display`
  - `_content_fit_issues` also flags visual overflow; speaker notes and `minLength == maxLength` still ignored
  - Issue string for visual overflow includes `visually` and a complete-phrase target of about 80% of the visual budget in characters: `max(minLength, floor(0.8 * capacity_units / max(unit_per_char, 1e-6)))` where `unit_per_char = text_units / max(len(text), 1)`

Working directory: `D:\work\Gapo\gslide\gslide-api\servers\fastapi`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/test_generate_slide_content.py`:

```python
def test_content_fit_issues_flag_vietnamese_under_max_length():
    schema = {
        "type": "object",
        "properties": {
            "title": {"type": "string", "minLength": 4, "maxLength": 24},
            "body": {"type": "string", "minLength": 4, "maxLength": 80},
            "__speaker_note__": {"type": "string", "maxLength": 10},
        },
    }
    issues = generate_slide_content._content_fit_issues(
        schema,
        {
            "title": "Phủ định của phủ định",
            "body": "Short body copy.",
            "__speaker_note__": "0123456789",
        },
    )
    assert any("$.title" in issue and "visually" in issue for issue in issues)
    assert all("$.body" not in issue for issue in issues)
    assert all("__speaker_note__" not in issue for issue in issues)


def test_content_fit_issues_ignore_short_english():
    schema = {
        "type": "object",
        "properties": {
            "title": {"type": "string", "minLength": 4, "maxLength": 40},
        },
    }
    issues = generate_slide_content._content_fit_issues(
        schema,
        {"title": "Hello world"},
    )
    assert issues == []
```

Keep `test_content_fit_issues_find_saturated_nested_text_but_ignore_notes` passing — exact `maxLength` still flags.

- [ ] **Step 2: Run test to verify it fails**

Run: `python tests/run_suite.py tests/unit/test_generate_slide_content.py -v`

Expected: FAIL — `test_content_fit_issues_flag_vietnamese_under_max_length` because `_content_fit_issues` only checks `len(value) >= maximum`.

- [ ] **Step 3: Write minimal implementation**

In `generate_slide_content.py` add constants matching Task 1 and:

```python
import unicodedata

_DISPLAY_FIELD_NAMES = {"title", "heading", "name", "metric", "label"}
_VIETNAMESE_LETTERS = set("àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ")

def _character_unit(ch: str, bold: bool = False) -> float:
    if unicodedata.combining(ch):
        return 0.0
    code = ord(ch)
    if (
        0x3000 <= code <= 0x9FFF
        or 0xAC00 <= code <= 0xD7AF
        or 0xF900 <= code <= 0xFAFF
    ):
        return _CJK_EM
    if ch in _VIETNAMESE_LETTERS:
        return _VIETNAMESE_EM * (_VIETNAMESE_BOLD_MULTIPLIER if bold else 1.0)
    return _LATIN_EM

def _text_units(text: str, bold: bool = False) -> float:
    return sum(_character_unit(ch, bold) for ch in text)

def _path_field_name(path: str) -> str:
    return path.rsplit(".", 1)[-1].split("[", 1)[0].lower()

def _field_is_display_bold(path: str, schema: dict) -> bool:
    if _path_field_name(path) in _DISPLAY_FIELD_NAMES:
        return True
    description = schema.get("description")
    if isinstance(description, str):
        lowered = description.lower()
        if "title" in lowered or "display" in lowered:
            return True
    return False
```

Extend `_content_fit_issues` string branch **after** the existing exact-`maxLength` check (keep that message format unchanged):

```python
        bold = _field_is_display_bold(path, schema)
        if _text_units(value, bold) > _FIT_CAPACITY_RATIO * maximum * _LATIN_EM:
            unit_per_char = _text_units(value, bold) / max(len(value), 1)
            target = max(
                safe_minimum,
                math.floor(
                    CONTENT_FIT_TARGET_RATIO * maximum * _LATIN_EM / max(unit_per_char, 1e-6)
                ),
            )
            return [
                (
                    f"{path}: visually {_text_units(value, bold):.1f}/"
                    f"{maximum * _LATIN_EM:.1f} em units ({len(value)} chars); "
                    f"rewrite as a complete phrase of about {target} characters or fewer"
                )
            ]
```

Do not flag `__speaker_note__`. Do not flag when `safe_minimum >= maximum`.

- [ ] **Step 4: Run test to verify it passes**

Run: `python tests/run_suite.py tests/unit/test_generate_slide_content.py -v`

Expected: PASS, including the old saturation test.

- [ ] **Step 5: Commit** (in `gslide-api` repo)

```powershell
git add servers/fastapi/utils/llm_calls/generate_slide_content.py servers/fastapi/tests/unit/test_generate_slide_content.py
git commit -m "fix: flag slide copy that overflows Template V2 visual capacity"
```

Run git from `D:\work\Gapo\gslide\gslide-api`. Paths in `git add` are relative to that repo root (`servers/fastapi/...`).

---

### Task 5: Repair ceiling and prompt

**Files:**
- Modify: `gslide-api/servers/fastapi/utils/llm_calls/generate_slide_content.py` (`SLIDE_CONTENT_SYSTEM_PROMPT` around lines 49–54, `_tighten_string_ceilings` / `_schema_with_fit_ceilings` at 336–359, `_content_fit_feedback_message` at 443–465, `get_slide_content_from_type_and_outline` repair call at 527)
- Modify: `gslide-api/servers/fastapi/tests/unit/test_generate_slide_content.py`

**Interfaces:**
- Consumes: Task 4 `_text_units`, `_field_is_display_bold`, `_content_fit_issues`
- Produces: `_schema_with_fit_ceilings(schema, content=None)` — existing 80% of `maxLength`, and per overflowing field `max(minLength, visual 80% character target)` when that is tighter. Still one repair LLM call. Prompt states `maxLength` is a Latin-width ceiling.

Working directory: `D:\work\Gapo\gslide\gslide-api\servers\fastapi`.

- [ ] **Step 1: Write the failing tests**

Append:

```python
def test_schema_with_fit_ceilings_uses_tighter_visual_budget():
    schema = {
        "type": "object",
        "properties": {
            "title": {"type": "string", "minLength": 4, "maxLength": 24},
        },
    }
    content = {"title": "Phủ định của phủ định"}
    tightened = generate_slide_content._schema_with_fit_ceilings(schema, content)
    visual_max = tightened["properties"]["title"]["maxLength"]
    assert visual_max < 19  # 80% of 24 is 19; visual target must be tighter
    assert visual_max >= 4


def test_slide_content_generation_repairs_visual_overflow(monkeypatch):
    calls = []

    async def fake_generate_structured_with_schema_retries(
        _client,
        _model,
        *,
        json_schema,
        **_kwargs,
    ):
        calls.append(json_schema)
        if len(calls) == 1:
            return {
                "title": "Phủ định của phủ định",
                "__speaker_note__": "A sufficiently useful speaker note.",
            }
        return {
            "title": "Phủ định biện chứng",
            "__speaker_note__": "A sufficiently useful speaker note.",
        }

    monkeypatch.setattr(generate_slide_content, "get_llm_client", lambda: object())
    monkeypatch.setattr(generate_slide_content, "get_model", lambda: "test-model")
    monkeypatch.setattr(
        generate_slide_content,
        "generate_structured_with_schema_retries",
        fake_generate_structured_with_schema_retries,
    )

    result = asyncio.run(
        generate_slide_content.get_slide_content_from_type_and_outline(
            SlideLayoutModel(
                id="title-layout",
                json_schema={
                    "type": "object",
                    "properties": {
                        "title": {
                            "type": "string",
                            "minLength": 4,
                            "maxLength": 24,
                        }
                    },
                    "required": ["title"],
                },
            ),
            _outline(),
            language="Vietnamese",
        )
    )

    assert len(calls) == 2
    assert calls[0]["properties"]["title"]["maxLength"] == 24
    assert calls[1]["properties"]["title"]["maxLength"] < 19
    assert result["title"] == "Phủ định biện chứng"


def test_slide_content_prompt_mentions_latin_width_ceiling():
    prompt = generate_slide_content.get_system_prompt()
    assert "Latin-width" in prompt or "latin-width" in prompt.lower()
```

Keep `get_llm_client` patched as `lambda: object()`, matching `test_slide_content_generation_repairs_strings_at_max_length`.

- [ ] **Step 2: Run test to verify it fails**

Run: `python tests/run_suite.py tests/unit/test_generate_slide_content.py -v`

Expected: FAIL — `_schema_with_fit_ceilings` does not take `content`; prompt lacks Latin-width sentence.

- [ ] **Step 3: Write minimal implementation**

1. Change `_tighten_string_ceilings` to accept optional `value` and `path`, and for each string field set:

```python
schema_target = _content_fit_target(maximum, safe_minimum)
visual_target = schema_target
if isinstance(value, str) and value:
    bold = _field_is_display_bold(path, schema)
    unit_per_char = _text_units(value, bold) / max(len(value), 1)
    visual_target = max(
        safe_minimum,
        math.floor(
            CONTENT_FIT_TARGET_RATIO * maximum * _LATIN_EM / max(unit_per_char, 1e-6)
        ),
    )
schema["maxLength"] = min(schema_target, visual_target)
```

Walk `value` in parallel with schema (dict keys / list indices), same as `_content_fit_issues`.

2. `_schema_with_fit_ceilings(schema, content=None)` passes `content` through.

3. Repair call: `_schema_with_fit_ceilings(response_schema, content)`.

4. System prompt, in the max-character-limit bullet, add:

```
Treat every max character limit as a Latin-width ceiling, not a writing target.
Vietnamese and display fonts use more width per character; leave headroom.
Draft each field as a complete phrase or sentence that finishes comfortably
below the limit (aim for about 80% of the visual budget). Never generate a
longer answer and cut it to the limit.
```

Keep the existing “partial word / dangling hyphen” sentence.

5. Update `_content_fit_feedback_message` so it does not say only “exactly hit maxLength”. Use:

```
The previous JSON matches the schema, but some visible slide text
overflows the layout frame (visual width or maxLength). Rewrite
the flagged fields as shorter, natural, complete phrases or
sentences.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python tests/run_suite.py tests/unit/test_generate_slide_content.py -v`

Expected: PASS. Existing `test_slide_content_generation_restores_outline_title_when_repair_stays_cut` still passes (`maxLength` 16 → repair 12).

- [ ] **Step 5: Commit** (in `gslide-api` repo)

```powershell
git add servers/fastapi/utils/llm_calls/generate_slide_content.py servers/fastapi/tests/unit/test_generate_slide_content.py
git commit -m "fix: tighten slide-content repair using visual width"
```

---

## Self-review

| Spec requirement | Task |
|---|---|
| Wrap → shrink → ellipsis at render | 2, 3 |
| Shared unit table; canvas in browser | 1, 3 |
| Shrink floor 72% / 16px title / 12px body | 1, 2 |
| Do not mutate stored font JSON | 3 (render-time only) |
| Konva measured width + clip | 3 |
| HTML `overflow:hidden` + fitted font | 3 |
| `text` and `text-list` only | 2, 3 |
| Generation visual overflow + one repair | 4, 5 |
| Do not persist template `max_length` | 4, 5 (no template writes) |
| Existing decks readable without regen | 3 |
| No Smart HTML / sibling reflow / extra LLM rounds | Global constraints |

Manual check after Task 3+5, not a plan task: generate a Vietnamese V2 deck and export PDF; title `Phủ định của phủ định` and TOC lines stay inside their frames.
