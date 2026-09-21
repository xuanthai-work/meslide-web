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
  const fallbackFont = line[0]?.font ?? { size: 18 };
  const copy = line.map((segment) => ({ ...segment }));
  const paintedWidth = () => {
    if (!copy.length) {
      return measure(ELLIPSIS, fallbackFont);
    }
    const prefixWidth =
      copy.length > 1
        ? copy.slice(0, -1).reduce((sum, segment) => sum + segment.width, 0)
        : 0;
    const tail = copy[copy.length - 1];
    return prefixWidth + measure(`${tail.text}${ELLIPSIS}`, tail.font);
  };
  while (copy.length && paintedWidth() > maxWidth) {
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
    const font = fallbackFont;
    const width = measure(ELLIPSIS, font);
    if (width > maxWidth) {
      return [];
    }
    return [
      {
        text: ELLIPSIS,
        font,
        width,
      },
    ];
  }
  const tail = copy[copy.length - 1];
  tail.text = `${tail.text}${ELLIPSIS}`;
  tail.width = measure(tail.text, tail.font);
  if (lineWidthOf(copy) > maxWidth + 0.01) {
    return [];
  }
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
  if (!kept.length) {
    if (!lines[0]?.length) return [];
    const ellipsisLine = ellipsizeLine(lines[0], box.width, measure);
    if (!ellipsisLine.length) return [];
    // Painters clip. Keep one ellipsized line even if it is taller than the box.
    return [ellipsisLine];
  }
  const ellipsized = ellipsizeLine(
    kept[kept.length - 1],
    box.width,
    measure,
  );
  if (!ellipsized.length) return [];
  kept[kept.length - 1] = ellipsized;
  return kept;
}

function designedSizeOf(runs) {
  const sizes = (runs ?? [])
    .map((run) => Number(run.font?.size))
    .filter((size) => size > 0);
  return sizes.length ? Math.max(...sizes) : 18;
}

function paintSafeBox(box) {
  return {
    width: box.width / PAINT_SAFETY,
    height: box.height,
  };
}

function searchFitScale(layoutAt, box, minScale) {
  let low = minScale;
  let high = 1;
  let bestScale = minScale;
  let bestLines = layoutAt(minScale);
  while (high - low > FIT_SCALE_EPSILON) {
    const mid = (low + high) / 2;
    const probe = layoutAt(mid);
    if (layoutFits(probe, box)) {
      bestScale = mid;
      bestLines = probe;
      low = mid;
    } else {
      high = mid;
    }
  }
  return { bestScale, bestLines };
}

function finishOverflowFit(layoutAt, box, measure, minScale) {
  const wordFit = searchFitScale(
    (scale) => layoutAt(scale, false),
    box,
    minScale,
  );
  if (layoutFits(wordFit.bestLines, box)) {
    return { ...wordFit, ellipsis: false };
  }
  const splitFit = searchFitScale(
    (scale) => layoutAt(scale, true),
    box,
    minScale,
  );
  if (layoutFits(splitFit.bestLines, box)) {
    return { ...splitFit, ellipsis: false };
  }
  return {
    bestScale: minScale,
    bestLines: applyEllipsis(splitFit.bestLines, box, measure),
    ellipsis: true,
  };
}

export function fitTextToBox(runs, box, options = {}) {
  const measure = options.measure ?? measureTextByUnits;
  const source = Array.isArray(runs) ? runs : [];
  if (source.length === 0 || !(box?.width > 0) || !(box?.height > 0)) {
    return { runs: source, fontScale: 1, lines: [], ellipsis: false, height: 0 };
  }
  const fitBox = paintSafeBox(box);
  const layout = (scale, allowCharSplit) =>
    layoutFitTextRuns(scaleFitRuns(source, scale), fitBox.width, measure, {
      allowCharSplit,
    });
  const lines = layout(1, false);
  if (layoutFits(lines, fitBox)) {
    return { runs: source, fontScale: 1, lines, ellipsis: false, height: layoutHeight(lines) };
  }
  const minScale = floorScale(designedSizeOf(source));
  const fitted = finishOverflowFit(layout, fitBox, measure, minScale);
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
  const fitBox = paintSafeBox(box);
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
