export declare const DEFAULT_FONT_FAMILY: "Arial";
export declare const DEFAULT_FONT_WEIGHT: 400;
export declare const BOLD_FONT_WEIGHT: 700;

export type CanvasFontSpec = {
  /** Family name a browser/canvas can actually resolve (no weight suffix). */
  family: string;
  weight: number;
  /** Family exactly as authored in the template JSON. */
  sourceFamily: string;
};

export declare function splitFontStyleSuffix(family: unknown): {
  family: string;
  suffixWeight: number | null;
};

export declare function normalizeCanvasFontSpec(
  font:
    | {
        family?: unknown;
        bold?: unknown;
        size?: unknown;
        italic?: unknown;
      }
    | null
    | undefined,
): CanvasFontSpec;

export declare function quoteFontFamily(family: unknown): string;

export declare function canvasFontCss(
  font: { family?: unknown; bold?: unknown; size?: unknown; italic?: unknown },
): string;
