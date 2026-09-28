export const MAX_NUMBER_OF_SLIDES = 50;
export const MAX_OUTLINE_CONTENT_WORDS = 100;

const WORD_PATTERN = /\S+/g;

export function countOutlineWords(value: string): number {
  return value.match(WORD_PATTERN)?.length ?? 0;
}

export function trimTextToWordLimit(
  value: string,
  maxWords = MAX_OUTLINE_CONTENT_WORDS
): string {
  if (maxWords <= 0) return "";

  const matches = Array.from((value || "").matchAll(WORD_PATTERN));
  if (matches.length <= maxWords) return value;

  const lastMatch = matches[maxWords - 1];
  const endIndex = (lastMatch.index ?? 0) + lastMatch[0].length;
  return value.slice(0, endIndex).trimEnd();
}

export function limitOutlines<T extends { content?: unknown }>(
  outlines: T[] | null | undefined
): { content: string }[] {
  if (!Array.isArray(outlines)) return [];

  return outlines.slice(0, MAX_NUMBER_OF_SLIDES).map((outline) => ({
    ...outline,
    content: trimTextToWordLimit(
      typeof outline?.content === "string"
        ? outline.content
        : String(outline?.content ?? "")
    ),
  }));
}

export function validateAndLimitOutlines(
  outlines: unknown
): { content: string }[] {
  if (
    !Array.isArray(outlines) ||
    outlines.length === 0 ||
    outlines.some(
      (outline) =>
        !outline ||
        typeof outline !== "object" ||
        typeof outline.content !== "string" ||
        outline.content.trim().length === 0
    )
  ) {
    return [];
  }

  return limitOutlines(outlines as { content: string }[]);
}

export function clampSlideCountValue(value: string): string {
  const digitsOnly = value.replace(/\D+/g, "");
  if (!digitsOnly) return "";

  const normalized = digitsOnly.replace(/^0+/, "");
  if (!normalized) return "";

  return String(Math.min(Number(normalized), MAX_NUMBER_OF_SLIDES));
}

export function parseLimitedSlideCount(
  value: string | null | undefined
): number | null {
  if (!value || !/^\d+$/.test(value)) return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  return Math.min(parsed, MAX_NUMBER_OF_SLIDES);
}

/**
 * Counts the slides an outline declares for itself.
 *
 * Users paste documents that already number their own slides (`## Slide 1`,
 * `Slide 01:`, `Slide 3 —`, …), so the outline text is a more trustworthy
 * source of the slide count than the dropdown. Only a line that *starts* a
 * slide marker counts, which keeps inline cross-references such as
 * "(Slide 3)" inside a bullet from inflating the total.
 *
 * A single marker is treated as prose, not an outline, so an incidental
 * "Slide 1" mention never pins the count. The result is clamped to
 * {@link MAX_NUMBER_OF_SLIDES} like every other count on this page.
 *
 * The trailing separator is an alternation rather than a whitespace class on
 * purpose: a whitespace class swallows the newline, which would cut a
 * newline-delimited outline (`## Slide 1` on a line of its own) short after
 * the first hit.
 */
const SLIDE_MARKER_PATTERN =
  /^[ \t]*(?:#{1,3}[ \t]*)?Slide[ \t]*(\d+)(?:[ \t]*[:\u2014-]|\r?$)/gim;

export function detectSlideCountFromText(
  text: string | null | undefined
): number | null {
  if (!text) return null;

  const numbers = new Set<number>();
  for (const match of text.matchAll(SLIDE_MARKER_PATTERN)) {
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed > 0) numbers.add(parsed);
  }
  if (numbers.size < 2) return null;

  // A conventional outline numbers its slides 1..N with no gaps, so the
  // highest marker is the count. Anything else (gaps, restarts, repeats)
  // falls back to how many distinct markers were seen, which never invents
  // slides the outline does not describe.
  const ordered = [...numbers].sort((a, b) => a - b);
  const isSequential = ordered.every((value, index) => value === index + 1);
  const count = isSequential ? ordered.length : numbers.size;

  return Math.min(count, MAX_NUMBER_OF_SLIDES);
}
