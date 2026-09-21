export declare const LATIN_EM: 0.5;
export declare const VIETNAMESE_EM: 0.72;
export declare const VIETNAMESE_BOLD_MULTIPLIER: 1.16;
export declare const CJK_EM: 1;
export declare const FIT_CAPACITY_RATIO: 0.95;
export declare const FIT_TARGET_RATIO: 0.8;
export declare const SHRINK_RATIO: 0.72;
export declare const TITLE_MIN_PX: 16;
export declare const BODY_MIN_PX: 12;
export declare const TITLE_SIZE_THRESHOLD: 24;
export declare const ELLIPSIS: "…";
export declare const FIT_SCALE_EPSILON: 0.001;
export declare const PAINT_SAFETY: 1.1;

export declare function characterUnit(ch: string, bold?: boolean): number;
export declare function textUnits(text: string, bold?: boolean): number;
export declare function measureTextByUnits(
  text: string,
  font: { size: number; bold?: boolean; letterSpacing?: number },
): number;
export declare function floorFontPx(designedSize: number): number;
export declare function floorScale(designedSize: number): number;
export declare function visualCapacityUnits(maxLength: number): number;
export declare function exceedsVisualCapacity(
  text: string,
  maxLength: number,
  bold?: boolean,
): boolean;

export declare function scaleFitFont(
  font: Record<string, unknown>,
  scale: number,
): Record<string, unknown>;

export declare function scaleFitRuns(
  runs: Array<{ text?: string; font?: Record<string, unknown>; renderHeight?: number }>,
  scale: number,
): Array<{ text?: string; font?: Record<string, unknown>; renderHeight?: number }>;

export declare function layoutFitTextRuns(
  runs: Array<{ text?: string; font?: Record<string, unknown>; renderHeight?: number }>,
  width: number,
  measure: (text: string, font: Record<string, unknown>) => number,
  options?: { allowCharSplit?: boolean },
): Array<Array<{ text?: string; font?: Record<string, unknown>; renderHeight?: number; width: number }>>;

export declare function fitTextToBox(
  runs: Array<{ text?: string; font?: Record<string, unknown>; renderHeight?: number }>,
  box: { width: number; height: number },
  options?: { measure?: (text: string, font: Record<string, unknown>) => number },
): {
  runs: Array<{ text?: string; font?: Record<string, unknown>; renderHeight?: number }>;
  fontScale: number;
  lines: Array<Array<{ text?: string; font?: Record<string, unknown>; renderHeight?: number; width: number }>>;
  ellipsis: boolean;
  height: number;
};

export declare function fitTextListToBox(
  items: Array<{
    marker: string;
    markerFont: Record<string, unknown>;
    runs: Array<{ text?: string; font?: Record<string, unknown>; renderHeight?: number }>;
  }>,
  box: { width: number; height: number },
  options?: { measure?: (text: string, font: Record<string, unknown>) => number },
): {
  items: Array<{
    marker: string;
    markerFont: Record<string, unknown>;
    runs: Array<{ text?: string; font?: Record<string, unknown>; renderHeight?: number }>;
  }>;
  fontScale: number;
  lines: Array<Array<{ text?: string; font?: Record<string, unknown>; renderHeight?: number; width: number }>>;
  ellipsis: boolean;
  height: number;
};
