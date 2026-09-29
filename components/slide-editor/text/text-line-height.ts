const TEXT_AVERAGE_CHAR_EM = 0.52;

// Vietnamese diacritics (ệ, â, ô, hỏi, ngã, sắc) need vertical breathing room
// between lines. Never let a multi-line block collapse below this ratio or the
// glyphs of one line will paint over the line above it.
export const MIN_MULTILINE_LINE_HEIGHT = 1.08;

export function shouldApplyLineHeight({
  text,
  width,
  fontSize,
  wrap,
}: {
  text: string;
  width: number;
  fontSize: number;
  wrap?: string | null;
}) {
  const lines = text.split(/\r?\n/);
  if (lines.length > 1) return true;
  if (wrap === "none") return false;
  if (!Number.isFinite(width) || width <= 0) return false;
  if (!Number.isFinite(fontSize) || fontSize <= 0) return false;

  const averageCharWidth = Math.max(1, fontSize * TEXT_AVERAGE_CHAR_EM);
  return lines.some((line) => line.length * averageCharWidth > width);
}

export function effectiveLineHeight({
  text,
  width,
  fontSize,
  lineHeight,
  fallback,
  wrap,
}: {
  text: string;
  width: number;
  fontSize: number;
  lineHeight: number | null | undefined;
  fallback: number;
  wrap?: string | null;
}) {
  if (!shouldApplyLineHeight({ text, width, fontSize, wrap })) {
    return fallback;
  }
  const resolved = lineHeight ?? fallback;
  // Guard against template authors shipping lineHeight < 1 (e.g. Momentum's
  // 0.78). Only multi-line text is clamped; single-line blocks are untouched.
  return Math.max(MIN_MULTILINE_LINE_HEIGHT, resolved);
}
