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
export const PAINT_SAFETY = 1.1;
/**
 * Paint margin for copy carrying non-ASCII glyphs.
 *
 * It used to be 1.14, which handed the fitter only 87.7% of the box and made
 * Vietnamese copy wrap a line early, leaving a dead strip down the right edge.
 * The unit table already models Vietnamese at 0.72em against latin 0.5em, so
 * the margin only has to absorb font-rendering drift between environments.
 */
export const UNICODE_PAINT_SAFETY = 1.03;
export const DESIGN_LINE_HEIGHT = 1.25;
export const SINGLE_LINE_TOLERANCE = 1.6;
export const SINGLE_LINE_MIN_SCALE = 0.55;
export const SINGLE_LINE_FLOOR_RATIO = 0.85;

export function verticalGlyphClipBounds(lines, boxHeight) {
  const largestFont = Math.max(
    0,
    ...(lines ?? []).flatMap((line) =>
      line.map((segment) => Number(segment.font?.size) || 0),
    ),
  );
  // Konva paints glyph ink outside compact line boxes (notably accented titles).
  const padding = Math.ceil(largestFont * 0.25);
  return { y: -padding, height: boxHeight + padding * 2 };
}

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
  if (size >= 60) {
    return Math.max(size * 0.35, 20);
  }
  if (size >= 40) {
    return Math.max(size * 0.4, 16);
  }
  if (size >= TITLE_SIZE_THRESHOLD) {
    return Math.max(size * 0.5, TITLE_MIN_PX);
  }
  return Math.max(size * SHRINK_RATIO, BODY_MIN_PX);
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
    width:
      run.type === "latex" && typeof run.width === "number"
        ? run.width * scale
        : run.width,
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

function isFitWhitespace(text) {
  return text.length > 0 && /^\s+$/u.test(text);
}

export function layoutFitTextRuns(runs, width, measure, options = {}) {
  const allowCharSplit = options.allowCharSplit !== false;
  const lines = [[]];
  let lineWidth = 0;
  const pushLine = () => {
    if (lines[lines.length - 1]?.length === 0) return;
    lines.push([]);
    lineWidth = 0;
  };
  for (const run of runs ?? []) {
    if (run.type === "latex") {
      const text = String(run.text ?? "");
      const displayMode = Boolean(run.displayMode ?? run.display_mode);
      const hasPreset =
        typeof run.width === "number" &&
        Number.isFinite(run.width) &&
        typeof run.renderHeight === "number" &&
        Number.isFinite(run.renderHeight);
      const segmentWidth = hasPreset ? run.width : measure(text, run.font);
      if (displayMode) pushLine();
      else if (lineWidth > 0 && lineWidth + segmentWidth > width) {
        pushLine();
      }
      lines[lines.length - 1].push({
        ...run,
        text,
        width: segmentWidth,
        ...(hasPreset ? { renderHeight: run.renderHeight } : {}),
      });
      lineWidth += segmentWidth;
      if (displayMode) pushLine();
      continue;
    }
    const parts = String(run.text ?? "").match(/\n|[^\S\n]+|[^\s]+/g) ?? [""];
    for (const part of parts) {
      if (part === "\n") {
        pushLine();
        continue;
      }
      if (isFitWhitespace(part)) {
        const remaining = width - lineWidth;
        if (!(remaining > 0)) continue;
        const piece = splitOversized(part, run.font, remaining, measure)[0];
        if (!piece || piece.width > remaining + 0.01) continue;
        lines[lines.length - 1].push({ ...run, ...piece, width: piece.width });
        lineWidth += piece.width;
        continue;
      }
      const pieces = allowCharSplit
        ? splitOversized(part, run.font, width, measure)
        : [{ text: part, width: measure(part, run.font), font: run.font }];
      for (const piece of pieces) {
        if (lineWidth > 0 && lineWidth + piece.width > width) {
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

function designedSizeOf(runs) {
  const sizes = (runs ?? [])
    .map((run) => Number(run.font?.size))
    .filter((size) => size > 0);
  return sizes.length ? Math.max(...sizes) : 18;
}

export function runsTextContent(runs) {
  return (runs ?? [])
    .map((run) => (run?.type === "latex" ? String(run.text ?? "") : String(run?.text ?? "")))
    .join("");
}

/**
 * True when the designed box only has room for a single line of its own font
 * size. Such a box must never grow a second line: template V2 positions every
 * element absolutely, so a second line paints straight over the element below.
 */
export function isSingleLineBox(box, designedFontSize, lineHeight = DESIGN_LINE_HEIGHT) {
  const height = Number(box?.height);
  if (!Number.isFinite(height) || height <= 0) return false;
  const size = Number(designedFontSize) > 0 ? designedFontSize : 18;
  const leading = Number(lineHeight) > 0 ? lineHeight : DESIGN_LINE_HEIGHT;
  return height < size * leading * SINGLE_LINE_TOLERANCE;
}

const SHORT_TEXT_SINGLE_LINE_MIN_SCALE = 0.8;
const SHORT_TEXT_MAX_CHARS = 25;
const SHORT_TEXT_MAX_WORDS = 3;
const SHORT_TEXT_MIN_FONT_SIZE = 36;
const LARGE_TITLE_SIZE = 60;
const LARGE_TITLE_MAX_LINES = 2;

/**
 * A tall box usually means "this text may wrap", but a big headline holding a
 * couple of words should still hug one line like the HTML thumbnail does.
 * Prefer a single line for short, unbroken display text at large sizes, as long
 * as the fit does not shrink the font below a tasteful floor.
 */
export function hasShortSingleLineText(source, designedFontSize) {
  const size = Number(designedFontSize);
  if (!(size >= SHORT_TEXT_MIN_FONT_SIZE)) return false;
  const text = runsTextContent(source).trim();
  if (!text || text.includes("\n")) return false;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const charCount = Array.from(text).length;
  return wordCount <= SHORT_TEXT_MAX_WORDS || charCount < SHORT_TEXT_MAX_CHARS;
}

export function singleLineMinScale(designedSize) {
  const size = Number(designedSize) > 0 ? designedSize : 18;
  // Cho phép single line co linh hoạt theo floorScale thực tế:
  return Math.min(floorScale(size), 0.45);
}

export function hasWideGlyphs(text) {
  return /[^\x00-\x7F]/u.test(String(text ?? ""));
}

function paintSafeBox(box, text = "") {
  const safety = hasWideGlyphs(text) ? UNICODE_PAINT_SAFETY : PAINT_SAFETY;
  return {
    width: box.width / safety,
    height: box.height,
  };
}

function layoutFitsSingleLine(lines, box) {
  if (lines.length > 1) return false;
  return layoutFits(lines, box);
}

function searchFitScale(layoutAt, box, minScale, fits = layoutFits) {
  let low = minScale;
  let high = 1;
  let bestScale = minScale;
  let bestLines = layoutAt(minScale);
  while (high - low > FIT_SCALE_EPSILON) {
    const mid = (low + high) / 2;
    const probe = layoutAt(mid);
    if (fits(probe, box)) {
      bestScale = mid;
      bestLines = probe;
      low = mid;
    } else {
      high = mid;
    }
  }
  return { bestScale, bestLines };
}

function finishOverflowFit(layoutAt, box, measure, minScale, singleLine = false) {
  const fits = singleLine ? layoutFitsSingleLine : layoutFits;
  const wordFit = searchFitScale(
    (scale) => layoutAt(scale, false),
    box,
    minScale,
    fits,
  );
  if (fits(wordFit.bestLines, box)) {
    return { ...wordFit, ellipsis: false };
  }
  const splitFit = searchFitScale(
    (scale) => layoutAt(scale, true),
    box,
    minScale,
    fits,
  );
  if (fits(splitFit.bestLines, box)) {
    return { ...splitFit, ellipsis: false };
  }
  return {
    bestScale: minScale,
    // Never cut copy and never spend a second line in a single-line box: keep
    // every glyph on that one designed line and let the painter clip the spill.
    bestLines: singleLine
      ? (splitFit.bestLines.length ? [splitFit.bestLines.flat()] : [])
      : splitFit.bestLines,
    ellipsis: false,
  };
}

/**
 * A designed single-line box must never gain a second line, because template V2
 * positions the next element right below it and the overflow paints on top of
 * it. Try the normal shrink floor first so copy keeps its designed size, and
 * only allow the deeper single-line floor when the second line is the only
 * reason the fit fails.
 */
function fitSingleLineOverflow(layoutAt, box, measure, designedSize) {
  const standard = floorScale(designedSize);
  const deep = singleLineMinScale(designedSize);
  const floors = deep < standard ? [standard, deep] : [standard];
  let fallback = null;
  for (const minScale of floors) {
    const fitted = finishOverflowFit(layoutAt, box, measure, minScale, true);
    if (!fitted.ellipsis) return fitted;
    if (!fallback) fallback = fitted;
  }
  return fallback;
}

export function fitTextToBox(runs, box, options = {}) {
  const measure = options.measure ?? measureTextByUnits;
  const source = Array.isArray(runs) ? runs : [];
  if (source.length === 0 || !(box?.width > 0) || !(box?.height > 0)) {
    return { runs: source, fontScale: 1, lines: [], ellipsis: false, height: 0 };
  }
  const fitBox = paintSafeBox(box, runsTextContent(source));
  const layout = (scale, allowCharSplit) =>
    layoutFitTextRuns(scaleFitRuns(source, scale), fitBox.width, measure, {
      allowCharSplit,
    });
  const lines = layout(1, false);
  const designedSize = designedSizeOf(source);
  const forcedSingleLine = isSingleLineBox(box, designedSize);
  const preferSingleLine =
    forcedSingleLine || hasShortSingleLineText(source, designedSize);
  if (layoutFits(lines, fitBox) && (!preferSingleLine || lines.length <= 1)) {
    return {
      runs: source,
      fontScale: 1,
      lines,
      ellipsis: false,
      height: layoutHeight(lines),
    };
  }
  if (
    !forcedSingleLine &&
    designedSize >= LARGE_TITLE_SIZE &&
    lines.length > LARGE_TITLE_MAX_LINES
  ) {
    const floor = floorScale(designedSize);
    const floorLines = layout(floor, false);
    if (
      floorLines.length <= LARGE_TITLE_MAX_LINES &&
      layoutFits(floorLines, fitBox)
    ) {
      return {
        runs: scaleFitRuns(source, floor),
        fontScale: floor,
        lines: floorLines,
        ellipsis: false,
        height: layoutHeight(floorLines),
      };
    }
  }
  if (preferSingleLine) {
    const singleLine = fitSingleLineOverflow(layout, fitBox, measure, designedSize);
    // A short headline keeps one line only when the required shrink is gentle;
    // otherwise fall through so the box can wrap the copy instead of ellipsizing.
    const keepSingle =
      forcedSingleLine ||
      (!singleLine.ellipsis &&
        singleLine.bestScale >= SHORT_TEXT_SINGLE_LINE_MIN_SCALE);
    if (keepSingle) {
      return {
        runs: scaleFitRuns(source, singleLine.bestScale),
        fontScale: singleLine.bestScale,
        lines: singleLine.bestLines,
        ellipsis: singleLine.ellipsis,
        height: layoutHeight(singleLine.bestLines),
      };
    }
  }
  const fitted = finishOverflowFit(layout, fitBox, measure, floorScale(designedSize));
  return {
    runs: scaleFitRuns(source, fitted.bestScale),
    fontScale: fitted.bestScale,
    lines: fitted.bestLines,
    ellipsis: fitted.ellipsis,
    height: layoutHeight(fitted.bestLines),
  };
}

export function fitTextListToBox(items, box, options = {}) {
  const measure = options.measure ?? measureTextByUnits;
  const source = Array.isArray(items) ? items : [];
  if (source.length === 0 || !(box?.width > 0) || !(box?.height > 0)) {
    return { items: source, fontScale: 1, lines: [], ellipsis: false, height: 0 };
  }
  const fitBox = paintSafeBox(
    box,
    source
      .map((item) => `${item.marker ?? ""}${runsTextContent(item.runs)}`)
      .join(""),
  );
  const asRuns = (scale, allowCharSplit = true) => {
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
        Math.max(1, fitBox.width - indent),
        measure,
        { allowCharSplit },
      );
      contentLines.forEach((line, index) => {
        if (index === 0 && marker) {
          lines.push([marker, ...line]);
          return;
        }
        if (indent > 0) {
          lines.push([
            { text: "", font: markerFont, width: indent },
            ...line,
          ]);
          return;
        }
        lines.push(line);
      });
    }
    return lines;
  };
  const dummyRuns = source.flatMap((item) => item.runs ?? []);
  const minScale = floorScale(
    designedSizeOf(dummyRuns.length ? dummyRuns : [{ font: { size: 18 } }]),
  );
  const lines = asRuns(1, false);
  if (layoutFits(lines, fitBox)) {
    return { items: source, fontScale: 1, lines, ellipsis: false, height: layoutHeight(lines) };
  }
  const fitted = finishOverflowFit(asRuns, fitBox, measure, minScale);
  return {
    items: source.map((item) => ({
      ...item,
      markerFont: scaleFitFont(item.markerFont, fitted.bestScale),
      runs: scaleFitRuns(item.runs, fitted.bestScale),
    })),
    fontScale: fitted.bestScale,
    lines: fitted.bestLines,
    ellipsis: fitted.ellipsis,
    height: layoutHeight(fitted.bestLines),
  };
}
