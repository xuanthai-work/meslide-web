import type { Marker, TextRun } from "@/components/slide-editor/types";
import { isLatexTextRun } from "@/components/slide-editor/text/text-runs";
import type { TextSelectionRange } from "@/components/slide-editor/text/text-runs";
import {
  fontFromRecord,
  layoutRenderTextRuns,
  lineRenderHeight,
  type RenderTextRun,
} from "@/components/slide-editor/text/template-v2-text";

export type TemplateV2InlineEditKind = "text" | "text-list" | "svg";

export type TemplateV2InlineEditBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TemplateV2TextEditStyle = {
  family: string;
  size: number;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  lineHeight: number;
  letterSpacing: number;
  opacity: number;
  horizontal: "left" | "center" | "right" | "justify";
  vertical: "top" | "middle" | "bottom";
};

export type TemplateV2InlineEdit<Selection> =
  | {
      kind: TemplateV2InlineEditKind;
      selection: Selection;
      draft: string;
      frame?: TemplateV2InlineEditBox | null;
      style?: TemplateV2TextEditStyle;
      runs?: TextRun[];
      listMarker?: Marker | null;
      textSelectionRange?: TextSelectionRange | null;
      /**
       * Font scale the canvas applied to make the copy fit its box. The inline
       * editor re-applies it for display only, so editing shows exactly the
       * size and wrapping the user sees on the canvas.
       */
      fontScale?: number;
    }
  | null;

export function measureWrappedRenderTextHeight(
  runs: RenderTextRun[],
  width: number,
  wrap: string | null | undefined,
  fallbackLineHeight: number,
) {
  const lines = layoutRenderTextRuns(runs, width, wrap);
  if (lines.length === 0) return fallbackLineHeight;
  return lines.reduce(
    (sum, line) => sum + lineRenderHeight(line, fallbackLineHeight),
    0,
  );
}

export function measureWordWrappedTextRunsHeight(
  runs: TextRun[],
  width: number,
  style: TemplateV2TextEditStyle,
) {
  const baseFont: RenderTextRun["font"] = style;
  const sourceRuns = runs.length > 0 ? runs : [{ text: " ", font: {} }];
  const renderRuns = sourceRuns.map((run) => ({
    text: isLatexTextRun(run) ? run.latex : run.text,
    ...(isLatexTextRun(run)
      ? {
          type: "latex" as const,
          latex: run.latex,
          displayMode: run.display_mode ?? false,
        }
      : {}),
    font: fontFromRecord(
      (run.font ?? {}) as Record<string, unknown>,
      baseFont,
    ),
  }));
  return Math.ceil(
    measureWrappedRenderTextHeight(
      renderRuns,
      Math.max(1, width),
      "word",
      baseFont.lineHeight,
    ),
  );
}

export function wordWrappedTextRuns(runs: TextRun[]): TextRun[] {
  return runs.map((run) => ({
    ...run,
    font: stripRunFontWrap(run.font),
  }));
}

/**
 * Scale a font's size/letter-spacing. Used to keep the inline editor's font
 * metrics aligned 1:1 with the fitted copy painted on the canvas. Passing the
 * reciprocal scale restores the authored metrics before committing.
 */
export function scaleInlineTextFont(
  font: TextRun["font"] | null | undefined,
  scale: number,
): TextRun["font"] | null | undefined {
  if (!font || !(scale > 0) || Math.abs(scale - 1) < 1e-6) return font;
  const size = Number(font.size);
  const letterSpacing = Number(font.letter_spacing);
  return {
    ...font,
    ...(Number.isFinite(size) ? { size: size * scale } : {}),
    ...(Number.isFinite(letterSpacing)
      ? { letter_spacing: letterSpacing * scale }
      : {}),
  };
}

export function scaleInlineTextRuns(runs: TextRun[], scale: number): TextRun[] {
  if (!(scale > 0) || Math.abs(scale - 1) < 1e-6) return runs;
  return runs.map((run) => ({
    ...run,
    font: scaleInlineTextFont(run.font, scale),
  }));
}

/**
 * Height the inline editor frame must have for its copy.
 *
 * ``fontScale`` mirrors the shrink the canvas fitter applied, so the frame is
 * measured against the font size the user actually sees (``style.size *
 * fontScale``). Measuring the authored size would inflate the frame and let the
 * editor wrap onto a line the canvas never showed.
 */
export function autoSizeInlineTextFrame(
  frame: TemplateV2InlineEditBox | null | undefined,
  runs: TextRun[],
  style: TemplateV2TextEditStyle,
  fontScale = 1,
): TemplateV2InlineEditBox | null | undefined {
  if (!frame) return frame;
  const scale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  const scaledStyle: TemplateV2TextEditStyle = {
    ...style,
    size: style.size * scale,
  };
  const scaledRuns = scaleInlineTextRuns(runs, scale);
  const contentHeight = measureWordWrappedTextRunsHeight(
    scaledRuns,
    frame.width,
    scaledStyle,
  );
  return {
    ...frame,
    height: Math.max(1, contentHeight),
  };
}

function stripRunFontWrap(font: TextRun["font"] | null | undefined) {
  if (!font) return font;
  return Object.fromEntries(
    Object.entries(font).filter(([key]) => key !== "wrap"),
  ) as TextRun["font"];
}
