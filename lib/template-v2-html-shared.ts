export type JsonRecord = Record<string, unknown>;
export type RenderMode = "absolute" | "flow";
export type DataLabelPosition = "base" | "mid" | "top" | "outside";
export type ChartKind =
  | "bar"
  | "bubble"
  | "horizontal_bar"
  | "horizontal_stacked_bar"
  | "stacked_bar"
  | "line"
  | "area"
  | "pie"
  | "donut"
  | "polar_area"
  | "radar"
  | "scatter";
export type InfographicKind = "progress_bar" | "gauge";

export type JsonToHtmlItem = JsonRecord;
export const DATA_LABEL_POSITIONS = new Set(["base", "mid", "top", "outside"]);

export interface ChartPointData {
  x: number;
  y: number;
  r?: number;
}

export interface ChartSeriesData {
  name: string;
  points: ChartPointData[];
  values: number[];
}

export interface NormalizedChartData {
  categories: string[];
  colors: string[];
  series: ChartSeriesData[];
}

export interface Box {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface FontFaceDefinition {
  family: string;
  url: string;
  format?: string;
  weight?: string;
  style?: string;
}

export interface TemplateV2HtmlOptions {
  fonts?: unknown;
  width?: number;
  height?: number;
}

export interface TemplateV2RenderPayload {
  items: JsonToHtmlItem[];
  width: number;
  height: number;
  fonts?: unknown;
  background: string;
}

export const ELEMENT_TYPES = new Set([
  "text",
  "container",
  "image",
  "text-list",
  "table",
  "vector",
  "svg",
  "chart",
  "infographic",
  "flex",
  "grid",
  "group",
  "list-view",
  "grid-view",
]);

export const DEFAULT_CHART_COLORS = [
  "#7F22FE",
  "#155DFC",
  "#F59E0B",
  "#12B76A",
  "#EF4444",
  "#06B6D4",
  "#8B5CF6",
  "#64748B",
];

export const CHART_FONT_FAMILY = "Inter, Arial, sans-serif";
export const TEMPLATE_V2_MATH_CSS = `
.gslide-math{line-height:normal;overflow:visible}
.gslide-math>.katex{color:inherit;font:inherit;line-height:inherit;white-space:nowrap}
.gslide-math>.katex>math{color:inherit;font-size:1em;margin:0;overflow:visible}
`;

export const TEMPLATE_V2_HTML_WIDTH = 1280;
export const TEMPLATE_V2_HTML_HEIGHT = 720;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function frameStyle(
  item: JsonRecord,
  mode: RenderMode,
  fallbackSize?: { width: number; height: number }
): string {
  const box = readBox(item, fallbackSize);
  return frameStyleFromBox(box, mode);
}

export function frameStyleFromBox(box: Box, mode: RenderMode): string {
  let style = `box-sizing:border-box;min-height:0;min-width:0;position:${mode === "absolute" ? "absolute" : "relative"
    };`;
  if (mode === "flow") style += "flex-shrink:0;";
  if (mode === "absolute") {
    style += `left:${cssNumber(box.x)}px;top:${cssNumber(box.y)}px;`;
  }
  if (box.width != null) style += `width:${cssNumber(box.width)}px;`;
  if (box.height != null) style += `height:${cssNumber(box.height)}px;`;
  return style;
}

export function readBox(
  item: JsonRecord,
  fallbackSize?: { width: number; height: number }
): Box {
  const position = readRecord(item.position);
  const size = readRecord(item.size);
  const type = readString(item.type);
  if (type === "vector") {
    return polygonBox(
      item,
      vectorShape(item) === "ellipse"
        ? polygonSourcePoints(item)
        : polygonPoints(item)
    );
  }
  return {
    x: readNumber(position.x) ?? 0,
    y: readNumber(position.y) ?? 0,
    width: readNumber(size.width) ?? fallbackSize?.width,
    height: readNumber(size.height) ?? fallbackSize?.height,
  };
}

export function childrenBounds(
  children: JsonRecord[]
): { width: number; height: number } {
  return children.reduce<{ width: number; height: number }>(
    (bounds, child) => {
      const box = readBox(child);
      return {
        width: Math.max(bounds.width, box.x + (box.width ?? 1)),
        height: Math.max(bounds.height, box.y + (box.height ?? 1)),
      };
    },
    { width: 1, height: 1 }
  );
}

export function polygonSourcePoints(item: JsonRecord): Point[] {
  return readArray(item.points)
    .map(readRecord)
    .map((point) => {
      const x = readNumber(point.x);
      const y = readNumber(point.y);
      return x != null && y != null ? { x, y } : null;
    })
    .filter((point): point is Point => point != null);
}

export function vectorShape(item: JsonRecord): "polygon" | "ellipse" {
  return readString(item.shape) === "ellipse" ? "ellipse" : "polygon";
}

export function polygonPoints(item: JsonRecord): Point[] {
  const points = polygonSourcePoints(item);
  if (readString(item.type) === "vector" && vectorShape(item) === "ellipse") {
    return points;
  }
  const closed = polygonClosed(item, points);
  const rounded = closed
    ? roundedPolygonPoints(points, cornerRadii(item, points.length))
    : points;
  const curve = curveSettings(item);
  if (!curve) return rounded;
  return sampleSmoothCurve(rounded, closed, curve.tension, curve.segments);
}

export function cornerRadii(item: JsonRecord, pointCount: number): number[] {
  return readArray(item.corner_radii ?? item.cornerRadii)
    .map(readNumber)
    .filter((value): value is number => value != null)
    .slice(0, pointCount)
    .map((value) => Math.max(0, value));
}

export function pointAt(points: Point[], index: number) {
  return points[((index % points.length) + points.length) % points.length];
}

export function lerpPoint(start: Point, end: Point, t: number): Point {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  };
}

export function roundedPolygonPoints(points: Point[], radii: number[], segments = 8): Point[] {
  if (points.length < 3 || radii.length === 0) return points;
  const rounded: Point[] = [];
  points.forEach((point, index) => {
    const radius = radii[index] ?? 0;
    const previous = pointAt(points, index - 1);
    const next = pointAt(points, index + 1);
    const prevDistance = Math.hypot(point.x - previous.x, point.y - previous.y);
    const nextDistance = Math.hypot(point.x - next.x, point.y - next.y);
    const safeRadius = Math.min(radius, prevDistance / 2, nextDistance / 2);
    if (safeRadius <= 0) {
      rounded.push(point);
      return;
    }
    const from = lerpPoint(point, previous, safeRadius / prevDistance);
    const to = lerpPoint(point, next, safeRadius / nextDistance);
    rounded.push(from);
    for (let step = 1; step < segments; step += 1) {
      const t = step / segments;
      rounded.push({
        x: (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * point.x + t * t * to.x,
        y: (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * point.y + t * t * to.y,
      });
    }
    rounded.push(to);
  });
  return rounded;
}

export function curveSettings(item: JsonRecord) {
  const curve = readRecordOrNull(item.curve);
  if (!curve) return null;
  const rawType = readString(curve.type)?.trim().toLowerCase();
  if (rawType !== "smooth") return null;
  return {
    type: "smooth",
    tension: clamp(readNumber(curve.tension) ?? 0.4, 0, 1),
    segments: Math.max(1, Math.min(96, Math.round(readNumber(curve.segments) ?? 16))),
  };
}

export function hermitePoint(
  start: Point,
  end: Point,
  startTangent: Point,
  endTangent: Point,
  t: number
): Point {
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return {
    x:
      h00 * start.x +
      h10 * startTangent.x +
      h01 * end.x +
      h11 * endTangent.x,
    y:
      h00 * start.y +
      h10 * startTangent.y +
      h01 * end.y +
      h11 * endTangent.y,
  };
}

export function sampleSmoothCurve(points: Point[], closed: boolean, tension: number, segments: number): Point[] {
  if (points.length < 3 || tension <= 0) return points;
  const sampled: Point[] = [];
  const segmentCount = closed ? points.length : points.length - 1;
  for (let index = 0; index < segmentCount; index += 1) {
    const p0 = closed ? pointAt(points, index - 1) : points[Math.max(0, index - 1)];
    const p1 = pointAt(points, index);
    const p2 = pointAt(points, index + 1);
    const p3 = closed ? pointAt(points, index + 2) : points[Math.min(points.length - 1, index + 2)];
    if (index === 0) sampled.push(p1);
    const tangentScale = tension * 0.5;
    const startTangent = {
      x: (p2.x - p0.x) * tangentScale,
      y: (p2.y - p0.y) * tangentScale,
    };
    const endTangent = {
      x: (p3.x - p1.x) * tangentScale,
      y: (p3.y - p1.y) * tangentScale,
    };
    for (let step = 1; step <= segments; step += 1) {
      sampled.push(
        hermitePoint(p1, p2, startTangent, endTangent, step / segments)
      );
    }
  }
  return sampled;
}

export function polygonClosed(item: JsonRecord, points: Point[]): boolean {
  if (readString(item.type) === "vector" && vectorShape(item) === "ellipse") {
    return true;
  }
  const value = item.closed;
  if (value === false || value === "false" || value === "0") return false;
  if (value === true || value === "true" || value === "1") return true;
  return points.length > 2;
}

export function polygonBox(item: JsonRecord, points: Point[]): Box {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  const stroke = readRecord(item.stroke);
  const strokeWidth = Math.max(1, readNumber(stroke.width) ?? 1);
  return {
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, strokeWidth, 1),
    height: Math.max(maxY - minY, strokeWidth, 1),
  };
}

export function boxStyle(item: JsonRecord): string {
  const fill = readRecord(item.fill);
  const stroke = readRecord(item.stroke);
  const shadow = readRecord(item.shadow);
  const radius = readRecord(item.borderRadius ?? item.border_radius);
  let style = transformStyle(item);
  const fillColor = readString(fill.color);
  if (fillColor) {
    style += `background-color:${escapeCssColor(
      colorWithOpacity(fillColor, readNumber(fill.opacity))
    )};`;
  }
  const strokeColor = readString(stroke.color);
  const strokeWidth = readNumber(stroke.width);
  if (strokeColor || strokeWidth != null) {
    style += `border:${cssNumber(strokeWidth ?? 1)}px solid ${escapeCssColor(
      colorWithOpacity(strokeColor ?? "transparent", readNumber(stroke.opacity))
    )};`;
  }
  const borderRadius = borderRadiusStyle(radius);
  if (borderRadius) style += `border-radius:${borderRadius};`;
  const shadowValue = shadowCssValue(shadow);
  if (shadowValue) style += `box-shadow:${shadowValue};`;
  const opacity = readNumber(item.opacity);
  if (opacity != null) style += `opacity:${cssNumber(opacity)};`;
  return style;
}

export function textShadowStyle(item: JsonRecord): string {
  const shadowValue = shadowCssValue(readRecord(item.shadow));
  return shadowValue ? `text-shadow:${shadowValue};` : "";
}

export function shadowCssValue(shadow: JsonRecord): string {
  const shadowOpacity = Object.keys(shadow).length
    ? (readNumber(shadow.opacity) ?? 1)
    : 0;
  if (shadowOpacity <= 0) return "";

  return `${cssNumber(readNumber(shadow.offsetX ?? shadow.offset_x) ?? 0)}px ${cssNumber(
    readNumber(shadow.offsetY ?? shadow.offset_y) ?? 0
  )}px ${cssNumber(readNumber(shadow.blur) ?? 0)}px ${escapeCssColor(
    colorWithOpacity(readString(shadow.color) ?? "#000000", shadowOpacity)
  )}`;
}

export function transformStyle(item: JsonRecord): string {
  const rotation = readNumber(item.rotation);
  const flipH = readBoolean(item.flip_h ?? item.flipH);
  const flipV = readBoolean(item.flip_v ?? item.flipV);
  if (!rotation && !flipH && !flipV) return "";

  const transforms = [];
  if (rotation) transforms.push(`rotate(${cssNumber(rotation)}deg)`);
  if (flipH) transforms.push("scaleX(-1)");
  if (flipV) transforms.push("scaleY(-1)");
  return `transform:${transforms.join(" ")};transform-origin:center;`;
}

export function isComponent(item: JsonRecord): item is JsonRecord & { elements: unknown[] } {
  const type = readString(item.type);
  return Array.isArray(item.elements) && (!type || !ELEMENT_TYPES.has(type));
}

export function readRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

export function readRecordOrNull(value: unknown): JsonRecord | null {
  const record = readRecord(value);
  return Object.keys(record).length ? record : null;
}

export function hasOwn(record: JsonRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function readStringValueOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function readStringValue(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

export function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function readBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === "1";
}

export function readFontWeight(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.round(value));
  }
  const text = readString(value);
  if (!text) return undefined;
  const normalized = text.toLowerCase().replace(/\s+/g, "");
  const namedWeights: Record<string, string> = {
    thin: "100",
    extralight: "200",
    ultralight: "200",
    light: "300",
    regular: "400",
    normal: "400",
    medium: "500",
    semibold: "600",
    demibold: "600",
    bold: "700",
    extrabold: "800",
    ultrabold: "800",
    black: "900",
    heavy: "900",
  };
  if (namedWeights[normalized]) return namedWeights[normalized];
  return /^\d{3}$/.test(normalized) ? normalized : undefined;
}

export function inferFontWeight(value: string): string | undefined {
  const normalized = decodeFontHint(value).toLowerCase();
  if (/\b(black|heavy)\b/.test(normalized)) return "900";
  if (/\b(extra|ultra)[\s_-]?bold\b/.test(normalized)) return "800";
  if (/\bbold\b/.test(normalized)) return "700";
  if (/\b(semi|demi)[\s_-]?bold\b/.test(normalized)) return "600";
  if (/\bmedium\b/.test(normalized)) return "500";
  if (/\bregular\b|\bnormal\b/.test(normalized)) return "400";
  if (/\blight\b/.test(normalized)) return "300";
  if (/\b(extra|ultra)[\s_-]?light\b/.test(normalized)) return "200";
  if (/\bthin\b/.test(normalized)) return "100";
  return undefined;
}

export function readFontStyle(value: unknown): string | undefined {
  const text = readString(value)?.toLowerCase();
  return text === "italic" || text === "oblique" || text === "normal"
    ? text
    : undefined;
}

export function inferFontStyle(value: string): string | undefined {
  return /\bitalic\b/i.test(decodeFontHint(value)) ? "italic" : undefined;
}

export function decodeFontHint(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function paddingStyle(padding: JsonRecord): string {
  return `padding:${cssNumber(readNumber(padding.top) ?? 0)}px ${cssNumber(
    readNumber(padding.right) ?? 0
  )}px ${cssNumber(readNumber(padding.bottom) ?? 0)}px ${cssNumber(
    readNumber(padding.left) ?? 0
  )}px;`;
}

export function borderRadiusStyle(radius: JsonRecord): string {
  const tl = readNumber(radius.tl) ?? 0;
  const tr = readNumber(radius.tr) ?? tl;
  const br = readNumber(radius.br) ?? tl;
  const bl = readNumber(radius.bl) ?? tl;
  return tl || tr || br || bl
    ? `${cssNumber(tl)}px ${cssNumber(tr)}px ${cssNumber(br)}px ${cssNumber(bl)}px`
    : "";
}

export function imageFit(value: unknown): string {
  return value === "cover" || value === "fill" ? value : "contain";
}

export function imageMaskSize(value: unknown): string {
  const fit = imageFit(value);
  return fit === "fill" ? "100% 100%" : fit;
}

export function imageCropScale(item: JsonRecord): number {
  const value = readNumber(item.crop_scale ?? item.cropScale);
  if (value == null) return 1;
  return clamp(value, 1, 6);
}

export function imageCropTransformStyle(item: JsonRecord): string {
  const cropScale = imageCropScale(item);
  if (cropScale <= 1) return "";
  return `transform:scale(${cssNumber(cropScale)});transform-origin:${
    imageFocusValue(item) ?? "center"
  };`;
}

export function imageFocusStyle(item: JsonRecord): string {
  const focus = imageFocusValue(item);
  return focus ? `object-position:${focus};` : "";
}

export function imageFocusValue(item: JsonRecord): string | null {
  const focus = readArray(item.focus);
  const rawX = item.focus_x ?? item.focusX ?? focus[0];
  const rawY = item.focus_y ?? item.focusY ?? focus[1];
  if (rawX == null && rawY == null) return null;

  const focusX = clamp(readNumber(rawX) ?? 50, 0, 100);
  const focusY = clamp(readNumber(rawY) ?? 50, 0, 100);
  return `${cssNumber(focusX)}% ${cssNumber(focusY)}%`;
}

export function clipPathStyle(item: JsonRecord): string {
  const value = normalizeCssClipPath(
    readString(item.clippath ?? item.clipPath ?? item.clip_path)
  );
  return value ? `clip-path:${value};-webkit-clip-path:${value};` : "";
}

export function normalizeCssClipPath(value: string | null): string | null {
  if (!value) return null;

  let normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.toLowerCase() === "none") return null;

  const doubleQuotedPath = normalized.match(/^path\("([^"]*)"\)$/i);
  if (doubleQuotedPath) {
    normalized = `path('${doubleQuotedPath[1]}')`;
  }

  if (/[";{}<>\\]/.test(normalized)) return null;
  if (!/^[a-zA-Z0-9\s.,%()+\-_' ]+$/.test(normalized)) return null;

  const functionName = normalized.match(/^([a-z-]+)\(/i)?.[1]?.toLowerCase();
  if (
    !functionName ||
    !["path", "polygon", "circle", "ellipse", "inset"].includes(functionName) ||
    !normalized.endsWith(")")
  ) {
    return null;
  }

  if (functionName === "path" && !/^path\('[^']*'\)$/i.test(normalized)) {
    return null;
  }

  return normalized;
}

export function horizontalAlign(value: string | null): string {
  return value === "center" ? "center" : value === "right" ? "flex-end" : "flex-start";
}

export function verticalAlign(value: string | null): string {
  return value === "middle" || value === "center"
    ? "center"
    : value === "bottom"
      ? "flex-end"
      : "flex-start";
}

export function textAlign(value: string | null): string {
  return value === "center" || value === "right" || value === "justify"
    ? value
    : "left";
}

export function cssAlignment(value: string | null, fallback: string): string {
  return value === "flex-start" ||
    value === "flex-end" ||
    value === "center" ||
    value === "stretch"
    ? value
    : fallback;
}

export function normalizeCssColor(color: string): string {
  const normalized = color.trim();
  const hex = normalized.match(/^#?([0-9a-fA-F]{6})$/)?.[1];
  return hex ? `#${hex}` : normalized;
}

export function colorWithOpacity(color: string, opacity: number | null): string {
  const normalized = normalizeCssColor(color);
  if (opacity == null || opacity >= 1 || normalized === "transparent") return normalized;
  const hex = normalized.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return normalized;
  const value = Number.parseInt(hex, 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${Math.max(
    0,
    opacity
  )})`;
}

export function cssNumber(value: number): string {
  return Number.isFinite(value) ? String(value) : "0";
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

export function escapeScriptText(value: string): string {
  return value.replaceAll("</script", "<\\/script").replaceAll("<!--", "<\\!--");
}

export function escapeStyleText(value: string): string {
  return value.replaceAll("</style", "<\\/style");
}

export function escapeCssColor(value: string): string {
  return /^[#(),.%\s\w-]+$/.test(value) ? value : "transparent";
}

export function escapeCssFont(value: string): string {
  return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
}

export function cssUrl(value: string): string {
  return `url('${escapeCssUrl(value)}')`;
}

export function escapeCssUrl(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("'", "\\'")
    .replaceAll("\n", "")
    .replaceAll("\r", "");
}

export function isFontStylesheetUrl(url: string): boolean {
  return /\.css(\?|$)/i.test(url) || /fonts\.googleapis\.com/.test(url);
}
