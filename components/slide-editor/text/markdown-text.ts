import type { Font, TextRun } from "@/components/slide-editor/types";
import { isLatexTextRun } from "@/components/slide-editor/text/text-runs";

type MarkdownStyle = {
  bold?: boolean;
  italic?: boolean;
};

const HTML_TAG_PATTERN = /<\/?(?!latex\b)[a-zA-Z][^>]*>/i;

/**
 * Strip raw HTML from slide text before markdown parsing.
 *
 * LLM output and copy-pasted web content can wrap copy in HTML
 * (``<ul><li>...</li></ul>``). Structural tags become plain text/bullets and
 * every remaining tag is dropped, while ``<latex>`` tags are preserved.
 * Text without any HTML is returned verbatim so significant whitespace between
 * runs is never collapsed.
 */
export function sanitizeMarkdownRawText(text: string): string {
  if (!text) return "";
  if (!HTML_TAG_PATTERN.test(text)) return text;

  const clean = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/div>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n• ")
    .replace(/<\/?(?!latex\b)[a-zA-Z][^>]*>/gi, "");

  const lines = clean
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length > 0 ? lines.join("\n") : clean.trim();
}

export function renderMarkdownTextRuns(runs: TextRun[]): TextRun[] {
  const rendered: TextRun[] = [];
  for (const run of runs) {
    if (isLatexTextRun(run)) {
      rendered.push(run);
      continue;
    }
    for (const parsed of parseMarkdownText(run.text)) {
      appendRun(rendered, parsed.text, mergeFont(run.font, parsed.style));
    }
  }
  return rendered.length ? rendered : [{ text: " " }];
}

export function renderMarkdownTextContent(runs: TextRun[]): string {
  return renderMarkdownTextRuns(runs)
    .map((run) => (isLatexTextRun(run) ? run.latex : run.text))
    .join("");
}

function parseMarkdownText(rawText: string): Array<{ text: string; style: MarkdownStyle }> {
  const text = sanitizeMarkdownRawText(rawText);
  const parsed: Array<{ text: string; style: MarkdownStyle }> = [];
  let index = 0;

  while (index < text.length) {
    const strongDelimiter = readDelimiter(text, index, ["**", "__"]);
    if (strongDelimiter) {
      const close = text.indexOf(strongDelimiter, index + strongDelimiter.length);
      if (close > index + strongDelimiter.length) {
        parsed.push({
          text: text.slice(index + strongDelimiter.length, close),
          style: { bold: true },
        });
        index = close + strongDelimiter.length;
        continue;
      }
    }

    const emphasisDelimiter = readDelimiter(text, index, ["*", "_"]);
    if (emphasisDelimiter) {
      const close = text.indexOf(
        emphasisDelimiter,
        index + emphasisDelimiter.length,
      );
      if (close > index + emphasisDelimiter.length) {
        parsed.push({
          text: text.slice(index + emphasisDelimiter.length, close),
          style: { italic: true },
        });
        index = close + emphasisDelimiter.length;
        continue;
      }
    }

    const next = nextDelimiterIndex(text, index + 1);
    parsed.push({
      text: text.slice(index, next === -1 ? text.length : next),
      style: {},
    });
    index = next === -1 ? text.length : next;
  }

  return parsed;
}

function readDelimiter(text: string, index: number, delimiters: string[]) {
  return delimiters.find((delimiter) => text.startsWith(delimiter, index));
}

function nextDelimiterIndex(text: string, from: number) {
  const indexes = ["**", "__", "*", "_"]
    .map((delimiter) => text.indexOf(delimiter, from))
    .filter((candidate) => candidate !== -1);
  return indexes.length ? Math.min(...indexes) : -1;
}

function mergeFont(font: TextRun["font"], style: MarkdownStyle): TextRun["font"] {
  if (!style.bold && !style.italic) return font;
  return {
    ...(font ?? {}),
    ...(style.bold ? { bold: true } : {}),
    ...(style.italic ? { italic: true } : {}),
  } satisfies Font;
}

function appendRun(runs: TextRun[], text: string, font: TextRun["font"]) {
  if (!text) return;
  const previous = runs[runs.length - 1];
  if (previous && !isLatexTextRun(previous) && sameFont(previous.font, font)) {
    previous.text += text;
    return;
  }
  runs.push(font ? { text, font } : { text });
}

function sameFont(left: TextRun["font"], right: TextRun["font"]) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}
