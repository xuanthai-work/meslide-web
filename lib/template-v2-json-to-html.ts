import { resolveBackendAssetUrl } from "@/utils/api";
import {
  fitRenderTextListToBox as fitTextListToBox,
  fitRenderTextToBox as fitTextToBox,
  normalizeRawTextMarkdownElement,
} from "@/components/slide-editor/text/template-v2-text";
import { isLatexTextRun } from "@/components/slide-editor/text/text-runs";
import { normalizeMathLatex, renderMathHtml } from "@/lib/math";
import {
  hasChartItem,
  normalizeChartColor,
  renderChart,
  renderChartScripts,
  renderInfographic,
} from "@/lib/template-v2-html-chart";
import {
  TEMPLATE_V2_HTML_HEIGHT,
  TEMPLATE_V2_HTML_WIDTH,
  TEMPLATE_V2_MATH_CSS,
  boxStyle,
  childrenBounds,
  clamp,
  clipPathStyle,
  colorWithOpacity,
  cssAlignment,
  cssNumber,
  cssUrl,
  escapeAttribute,
  escapeCssColor,
  escapeCssFont,
  escapeCssUrl,
  escapeHtml,
  escapeStyleText,
  frameStyle,
  frameStyleFromBox,
  hasOwn,
  horizontalAlign,
  imageCropTransformStyle,
  imageFit,
  imageFocusStyle,
  imageMaskSize,
  inferFontStyle,
  inferFontWeight,
  isComponent,
  isFontStylesheetUrl,
  normalizeCssColor,
  paddingStyle,
  polygonBox,
  polygonClosed,
  polygonPoints,
  polygonSourcePoints,
  readArray,
  readBoolean,
  readBox,
  readFontStyle,
  readFontWeight,
  readNumber,
  readRecord,
  readRecordOrNull,
  readString,
  readStringValue,
  readStringValueOrNull,
  textAlign,
  textShadowStyle,
  transformStyle,
  vectorShape,
  verticalAlign,
  type Box,
  type FontFaceDefinition,
  type JsonRecord,
  type JsonToHtmlItem,
  type RenderMode,
  type TemplateV2HtmlOptions,
  type TemplateV2RenderPayload,
} from "@/lib/template-v2-html-shared";

export {
  TEMPLATE_V2_HTML_HEIGHT,
  TEMPLATE_V2_HTML_WIDTH,
} from "@/lib/template-v2-html-shared";

export function templateV2UiToHtml(
  ui: unknown,
  options: TemplateV2HtmlOptions = {}
): string | null {
  const payload = templateV2RenderPayload(ui, options);
  if (!payload) return null;

  return jsonToHtml(
    payload.items,
    payload.width,
    payload.height,
    payload.fonts,
    payload.background
  );
}

export function templateV2UiToHtmlFragment(
  ui: unknown,
  options: TemplateV2HtmlOptions = {}
): string | null {
  const payload = templateV2RenderPayload(ui, options);
  if (!payload) return null;

  return jsonToHtmlFragment(
    payload.items,
    payload.width,
    payload.height,
    payload.fonts,
    payload.background
  );
}

function templateV2RenderPayload(
  ui: unknown,
  options: TemplateV2HtmlOptions
): TemplateV2RenderPayload | null {
  const record = readRecord(ui);
  const rootElements = readArray(record.elements);
  const components = readArray(record.components);
  const items = [...rootElements, ...components].map((item) =>
    readRecord(normalizeTemplateV2AssetUrls(item))
  );

  if (items.length === 0) {
    return null;
  }

  const width = options.width ?? TEMPLATE_V2_HTML_WIDTH;
  const height = options.height ?? TEMPLATE_V2_HTML_HEIGHT;
  const background = normalizeCssColor(readString(record.background) ?? "#FFFFFF");

  return {
    items,
    width,
    height,
    fonts: options.fonts,
    background,
  };
}

export function hasTemplateV2RenderableUi(ui: unknown): boolean {
  const record = readRecord(ui);
  return readArray(record.components).length > 0 || readArray(record.elements).length > 0;
}

function normalizeTemplateV2AssetUrls(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeTemplateV2AssetUrls);
  }

  const record = readRecord(value);
  if (!Object.keys(record).length) return value;

  const normalized = Object.fromEntries(
    Object.entries(record).map(([key, child]) => [
      key,
      normalizeTemplateV2AssetUrls(child),
    ])
  ) as JsonRecord;

  if (readString(normalized.type) === "image") {
    const source = readString(normalized.data);
    if (source) {
      normalized.data = resolveBackendAssetUrl(source);
    }
  }

  return normalized;
}

function jsonToHtml(
  items: JsonToHtmlItem[],
  width: number,
  height: number,
  fonts: unknown = {},
  background = "#FFFFFF"
): string {
  const records = items.map(readRecord);
  const chartScripts = records.some(hasChartItem) ? renderChartScripts() : "";
  const fontAssetTags = renderFontAssetTags(fonts);
  const bg = escapeCssColor(background);
  const slideRoot = renderSlideRoot(records, width, height, bg);

  return `<!doctype html>
<html><head><meta charset="utf-8">${fontAssetTags}<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${bg}}
body{font-family:Arial,Helvetica,sans-serif}
*,*::before,*::after{box-sizing:border-box}
${TEMPLATE_V2_MATH_CSS}
</style></head><body>${slideRoot}${chartScripts}</body></html>`;
}

function jsonToHtmlFragment(
  items: JsonToHtmlItem[],
  width: number,
  height: number,
  fonts: unknown = {},
  background = "#FFFFFF"
): string {
  const records = items.map(readRecord);
  const bg = escapeCssColor(background);

  return `${renderFontAssetTags(fonts)}<style>${TEMPLATE_V2_MATH_CSS}</style>${renderSlideRoot(
    records,
    width,
    height,
    bg
  )}`;
}

function renderSlideRoot(
  records: JsonRecord[],
  width: number,
  height: number,
  background: string
): string {
  const content = records.map((item) => renderItem(item, "absolute")).join("");

  return `<div class="relative overflow-hidden" data-template-v2-html-slide="true" style="box-sizing:border-box;position:relative;width:${cssNumber(
    width
  )}px;height:${cssNumber(
    height
  )}px;overflow:hidden;background:${background};font-family:Arial,Helvetica,sans-serif">${content}</div>`;
}

function renderFontAssetTags(fonts: unknown): string {
  const css = readStringValueOrNull(fonts);
  if (css) {
    return `<style>${escapeStyleText(css)}${fontCssFamilyAliases(css)}</style>`;
  }

  const tags: string[] = [];
  const records = readRecord(fonts);
  const embeddedCss = readStringValueOrNull(records.css ?? records.font_css);
  if (embeddedCss) {
    tags.push(
      `<style>${escapeStyleText(embeddedCss)}${fontCssFamilyAliases(embeddedCss)}</style>`
    );
  }

  const faceEntries = readArray(records.fonts).length ? records.fonts : fonts;
  tags.push(...normalizeFontFaces(faceEntries).map(renderFontFaceDefinition));

  const stylesheets = normalizeFontStylesheetUrls(faceEntries);
  tags.push(
    ...stylesheets.map(
      (url) =>
        `<link rel="stylesheet" href="${escapeAttribute(resolveBackendAssetUrl(url))}">`
    )
  );

  return tags.join("");
}

function normalizeFontFaces(fonts: unknown): FontFaceDefinition[] {
  if (Array.isArray(fonts)) {
    return fonts.flatMap((entry) => normalizeFontFaceEntry(undefined, entry));
  }

  return Object.entries(readRecord(fonts)).flatMap(([family, value]) =>
    family === "css" || family === "font_css" || family === "fonts"
      ? []
      : normalizeFontFaceEntry(family, value)
  );
}

function normalizeFontFaceEntry(
  fallbackFamily: string | undefined,
  value: unknown
): FontFaceDefinition[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => normalizeFontFaceEntry(fallbackFamily, entry));
  }

  const url = readString(value);
  if (url) {
    if (isFontStylesheetUrl(url)) return [];
    const family = fallbackFamily?.trim();
    return family
      ? [
        {
          family,
          url,
          weight: inferFontWeight(`${family} ${url}`),
          style: inferFontStyle(`${family} ${url}`),
        },
      ]
      : [];
  }

  const record = readRecord(value);
  const family = readString(
    record.family ?? record.name ?? record.fontFamily ?? record.font_family
  ) ?? fallbackFamily?.trim();
  const source = readString(
    record.url ?? record.src ?? record.href ?? record.data ?? record.source
  );
  if (!family || !source || isFontStylesheetUrl(source)) return [];

  return [
    {
      family,
      url: source,
      format: readString(record.format) ?? undefined,
      weight:
        readFontWeight(record.weight ?? record.fontWeight ?? record.font_weight) ??
        inferFontWeight(`${family} ${source}`),
      style:
        readFontStyle(record.style ?? record.fontStyle ?? record.font_style) ??
        inferFontStyle(`${family} ${source}`),
    },
  ];
}

function normalizeFontStylesheetUrls(fonts: unknown): string[] {
  if (Array.isArray(fonts)) {
    return fonts.flatMap(normalizeFontStylesheetUrls);
  }

  const directUrl = readString(fonts);
  if (directUrl && isFontStylesheetUrl(directUrl)) return [directUrl];

  return Object.values(readRecord(fonts)).flatMap((value) => {
    const url = readString(value);
    if (url && isFontStylesheetUrl(url)) return [url];

    const record = readRecord(value);
    const source = readString(
      record.url ?? record.src ?? record.href ?? record.data ?? record.source
    );
    return source && isFontStylesheetUrl(source) ? [source] : [];
  });
}

function renderFontFaceDefinition(definition: FontFaceDefinition): string {
  const aliases = fontFamilyAliases(definition.family, definition.weight);
  const src = `url("${escapeCssUrl(resolveBackendAssetUrl(definition.url))}")${definition.format ? ` format("${escapeCssUrl(definition.format)}")` : ""
    }`;
  return aliases
    .map(
      (family) =>
        `<style>@font-face{font-family:${escapeCssFont(
          family
        )};src:${src};font-weight:${definition.weight ?? "400"};font-style:${definition.style ?? "normal"
        };font-display:swap}</style>`
    )
    .join("");
}

function fontCssFamilyAliases(css: string): string {
  const aliases: string[] = [];
  const facePattern = /@font-face\s*\{[^}]*font-family\s*:\s*(['"]?)([^;'"}]+)\1[^}]*\}/gi;
  for (const match of css.matchAll(facePattern)) {
    const block = match[0];
    const family = match[2]?.trim();
    if (!family) continue;
    const weight = /font-weight\s*:\s*([^;}]+)/i.exec(block)?.[1]?.trim();
    for (const alias of fontFamilyAliases(family, weight).filter(
      (item) => item !== family
    )) {
      aliases.push(
        block.replace(
          /font-family\s*:\s*(['"]?)([^;'"}]+)\1/i,
          `font-family:${escapeCssFont(alias)}`
        )
      );
    }
  }
  return aliases.join("");
}

function fontFamilyAliases(family: string, weight?: string): string[] {
  const normalized = family.trim();
  const aliases = new Set([normalized]);
  const alias = normalized
    .replace(/\s+(regular|bold\s*italic|bold|italic|black|semibold|semi\s*bold|medium|light)$/i, "")
    .trim();

  if (alias && alias !== normalized && (weight || inferFontWeight(normalized))) {
    aliases.add(alias);
  }

  return [...aliases];
}

function renderItem(item: JsonRecord, mode: RenderMode): string {
  if (isComponent(item)) {
    const { size, ...component } = item;
    void size;
    return renderGroup(
      { ...component, type: "group", children: item.elements },
      mode
    );
  }

  switch (readString(item.type)) {
    case "vector":
      return renderPolygon(item, mode);
    case "svg":
      return renderSvg(item, mode);
    case "image":
      return renderImage(item, mode);
    case "text":
      return renderText(item, mode);
    case "text-list":
      return renderTextList(item, mode);
    case "table":
      return renderTable(item, mode);
    case "container":
      return renderContainer(item, mode);
    case "flex":
    case "list-view":
      return renderFlex(item, mode);
    case "grid":
    case "grid-view":
      return renderGrid(item, mode);
    case "group":
      return renderGroup(item, mode);
    case "chart":
      return renderChart(item, mode);
    case "infographic":
      return renderInfographic(item, mode);
    default:
      if (Array.isArray(item.children)) return renderGroup(item, mode);
      if (readRecordOrNull(item.child)) return renderContainer(item, mode);
      return "";
  }
}

function renderImage(item: JsonRecord, mode: RenderMode): string {
  const source = readString(item.data);
  if (!source) return "";
  const color = normalizeChartColor(readString(item.color));
  const clipPath = clipPathStyle(item);
  if (color && readBoolean(item.isIcon ?? item.is_icon)) {
    const maskUrl = cssUrl(source);
    const maskSize = imageMaskSize(item.fit);
    return `<div style="${frameStyle(item, mode)}${boxStyle(
      item
    )}color:${escapeCssColor(
      color
    )};background:currentColor;-webkit-mask:${maskUrl} center/${maskSize} no-repeat;mask:${maskUrl} center/${maskSize} no-repeat;${clipPath}"></div>`;
  }
  const fit = imageFit(item.fit);
  const focusStyle = imageFocusStyle(item);
  const cropTransformStyle = imageCropTransformStyle(item);
  if (cropTransformStyle) {
    return `<div style="${frameStyle(item, mode)}${boxStyle(
      item
    )}${clipPath}overflow:hidden;"><img alt="" src="${escapeAttribute(
      source
    )}" style="display:block;max-width:none;max-height:none;height:100%;width:100%;object-fit:${fit};${focusStyle}${cropTransformStyle}"></div>`;
  }
  if (clipPath) {
    return `<div style="${frameStyle(item, mode)}${boxStyle(
      item
    )}${clipPath}overflow:hidden;"><img alt="" src="${escapeAttribute(
      source
    )}" style="display:block;max-width:none;max-height:none;height:100%;width:100%;object-fit:${fit};${focusStyle}"></div>`;
  }
  return `<img alt="" src="${escapeAttribute(source)}" style="${frameStyle(
    item,
    mode
  )}${boxStyle(
    item
  )}display:block;max-width:none;max-height:none;object-fit:${fit};${focusStyle}${clipPath}">`;
}

function htmlPreparedRuns(runs: JsonRecord[], font: JsonRecord): JsonRecord[] {
  return runs.map((run) => ({
    ...run,
    text:
      readString(run.type) === "latex"
        ? normalizeMathLatex(run.latex)
        : readStringValue(run.text),
    font: { ...font, ...readRecord(run.font) },
    displayMode: readBoolean(run.display_mode ?? run.displayMode) ?? false,
  }));
}

function htmlTextFitBox(item: JsonRecord): { width: number; height: number } | null {
  const fallback = Array.isArray(item.children)
    ? childrenBounds(readArray(item.children).map(readRecord))
    : undefined;
  const box = readBox(item, fallback);
  if (box.width != null && box.width > 0 && box.height != null && box.height > 0) {
    return { width: box.width, height: box.height };
  }
  return null;
}

function renderUnfittedRunsHtml(runs: JsonRecord[]): string {
  return runs
    .map((run) => renderTextRunHtml(run, readRecord(run.font)))
    .join("");
}

function renderText(item: JsonRecord, mode: RenderMode): string {
  const font = readRecord(item.font);
  const alignment = readRecord(item.alignment);
  const horizontal = readString(alignment.horizontal);
  const vertical = readString(alignment.vertical);
  const runs = htmlPreparedRuns(normalizedRunsForHtml(item, font), font);
  const fitBox = htmlTextFitBox(item);
  const fitted = fitBox ? fitTextToBox(runs, fitBox) : null;
  const lineHtml = fitted
    ? renderFittedLinesHtml(fitted.lines)
    : renderUnfittedRunsHtml(runs);

  return `<div style="${frameStyle(item, mode)}${transformStyle(item)}${fontStyle(font, {
    includeLineHeight: false,
    includeTextDecoration: false,
  })}${textShadowStyle(item)}display:flex;align-items:${verticalAlign(
    vertical
  )};justify-content:${horizontalAlign(horizontal)};${lineHeightStyle(
    font,
    1.1
  )}overflow:visible;white-space:pre-wrap;text-align:${textAlign(horizontal)};"><span style="display:block;width:100%">${lineHtml}</span></div>`;
}

function renderTextList(item: JsonRecord, mode: RenderMode): string {
  const marker = readString(item.marker);
  const font = readRecord(item.font);
  const listItems = readArray(item.items).map((entry, index) => {
    const runs = htmlPreparedRuns(normalizedListRunsForHtml(entry, font), font);
    return {
      marker:
        marker === "none" ? "" : marker === "number" ? `${index + 1}. ` : "• ",
      markerFont: runs[0] ? readRecord(runs[0].font) : font,
      runs,
    };
  });
  const fitBox = htmlTextFitBox(item);
  const fitted = fitBox ? fitTextListToBox(listItems, fitBox) : null;
  const lineHtml = fitted
    ? renderFittedLinesHtml(fitted.lines)
    : listItems
        .map((entry) =>
          `${escapeHtml(entry.marker)}${renderUnfittedRunsHtml(entry.runs)}`,
        )
        .join("");

  return `<div style="${frameStyle(item, mode)}${transformStyle(item)}${fontStyle(
    font,
    { includeTextDecoration: false }
  )}${textOverflowStyle()}">${lineHtml}</div>`;
}

function renderFittedLinesHtml(lines: unknown): string {
  return readArray(lines)
    .map((line) => {
      const segments = readArray(line).map(readRecord);
      const sizes = segments
        .map((segment) => readNumber(readRecord(segment.font).size))
        .filter((size): size is number => size != null && size > 0);
      const fontSize = sizes.length ? Math.max(...sizes) : undefined;
      const lineHeights = segments
        .map((segment) =>
          readNumber(
            readRecord(segment.font).lineHeight ??
              readRecord(segment.font).line_height,
          ),
        )
        .filter((value): value is number => value != null);
      const lineHeight = lineHeights.length ? Math.max(...lineHeights) : 1.15;
      const content = segments
        .map((segment) => {
          const text = readStringValue(segment.text);
          const width = readNumber(segment.width);
          if (
            !text &&
            width != null &&
            width > 0 &&
            readString(segment.type) !== "latex"
          ) {
            return `<span style="display:inline-block;width:${cssNumber(width)}px;"></span>`;
          }
          return renderTextRunHtml(segment, readRecord(segment.font));
        })
        .join("");
      const sizeStyle =
        fontSize != null ? `font-size:${cssNumber(fontSize)}px;` : "";
      return `<span style="display:block;width:100%;white-space:pre;${sizeStyle}line-height:${cssNumber(lineHeight)};">${content}</span>`;
    })
    .join("");
}

function renderTable(item: JsonRecord, mode: RenderMode): string {
  const rows = tableRows(item);
  if (!rows.length) {
    return `<div style="${frameStyle(
      item,
      mode
    )}${transformStyle(item)}overflow:hidden"></div>`;
  }

  const rowCount = Math.max(1, rows.length);
  const colCount = Math.max(1, ...rows.map((row) => row.length));
  const tableFont = tableBaseFont(item);
  const cells = rows
    .flatMap((row, rowIndex) =>
      Array.from({ length: colCount }, (_, colIndex) => {
        const cell = row[colIndex] ?? {};
        const isHeader = rowIndex === 0;
        return `<div style="${tableCellStyle(
          cell,
          isHeader,
          tableFont
        )}">${cellText(cell, tableFont, isHeader)}</div>`;
      })
    )
    .join("");
  return `<div style="${frameStyle(
    item,
    mode
  )}${transformStyle(item)}display:grid;grid-template-columns:repeat(${colCount},minmax(0,1fr));grid-template-rows:repeat(${rowCount},minmax(0,1fr));overflow:hidden">${cells}</div>`;
}

function renderContainer(item: JsonRecord, mode: RenderMode): string {
  const child = readRecordOrNull(item.child);
  const alignment = readRecord(item.alignment);
  const style = `${frameStyle(item, mode)}${boxStyle(item)}${paddingStyle(
    readRecord(item.padding)
  )}display:flex;align-items:${verticalAlign(
    readString(alignment.vertical)
  )};justify-content:${horizontalAlign(
    readString(alignment.horizontal)
  )};${containerOverflowStyle(item, child)}`;
  return `<div style="${style}">${
    child ? renderItem(child, readRecordOrNull(child.position) ? "absolute" : "flow") : ""
  }</div>`;
}

function containerOverflowStyle(
  item: JsonRecord,
  child: JsonRecord | null
): string {
  const overflow = readString(item.overflow);
  if (overflow === "hidden" || overflow === "visible") {
    return `overflow:${overflow}`;
  }
  if (readBoolean(item.clip)) return "overflow:hidden";
  if (!child || readString(child.type) !== "image") return "overflow:visible";

  const childHasClipPath = Boolean(readString(child.clip_path ?? child.clipPath));
  const hasPositionedChild = Boolean(readRecordOrNull(child.position));
  if (!hasPositionedChild) return "overflow:visible";
  if (childHasClipPath) return "overflow:hidden";

  const containerBox = readBox(item);
  const childBox = readBox(child);
  if (containerBox.width == null || containerBox.height == null) {
    return "overflow:visible";
  }

  const epsilon = 0.01;
  const childOverflows =
    childBox.x < -epsilon ||
    childBox.y < -epsilon ||
    (childBox.width != null &&
      childBox.x + childBox.width > containerBox.width + epsilon) ||
    (childBox.height != null &&
      childBox.y + childBox.height > containerBox.height + epsilon);

  return childOverflows ? "overflow:hidden" : "overflow:visible";
}

function renderFlex(item: JsonRecord, mode: RenderMode): string {
  const direction = readString(item.direction) === "row" ? "row" : "column";
  const gap = readNumber(item.gap) ?? 0;
  const rowGap = readNumber(item.rowGap ?? item.row_gap) ?? gap;
  const columnGap = readNumber(item.columnGap ?? item.column_gap) ?? gap;
  const childrenList = readLayoutChildren(item);
  const children = childrenList
    .map((child) => renderItem(readRecord(child), "flow"))
    .join("");
  const style = `${flexFrameStyle(
    item,
    mode,
    childrenList,
    direction,
    readBoolean(item.wrap),
    columnGap,
    rowGap,
  )}${boxStyle(item)}${paddingStyle(
    readRecord(item.padding)
  )}display:flex;flex-direction:${direction};flex-wrap:${readBoolean(item.wrap) ? "wrap" : "nowrap"};align-items:${cssAlignment(
    readString(item.alignItems ?? item.align_items),
    "stretch"
  )};justify-content:${cssAlignment(
    readString(item.justifyContent ?? item.justify_content),
    "flex-start"
  )};gap:${cssNumber(gap)}px;column-gap:${cssNumber(columnGap)}px;row-gap:${cssNumber(rowGap)}px;overflow:visible`;
  return `<div style="${style}">${children}</div>`;
}

function flexFrameStyle(
  item: JsonRecord,
  mode: RenderMode,
  children: unknown[],
  direction: "row" | "column",
  wrap: boolean,
  columnGap: number,
  rowGap: number
) {
  const box = readBox(item);
  const expanded = flexExpandedSize(item, box, children, direction, wrap, columnGap, rowGap);
  let style = frameStyleFromBox(box, mode);
  if (expanded.width != null && (box.width == null || expanded.width > box.width)) {
    style += `width:${cssNumber(expanded.width)}px;`;
  }
  if (expanded.height != null && (box.height == null || expanded.height > box.height)) {
    style += `height:${cssNumber(expanded.height)}px;`;
  }
  return style;
}

function flexExpandedSize(
  item: JsonRecord,
  box: Box,
  children: unknown[],
  direction: "row" | "column",
  wrap: boolean,
  columnGap: number,
  rowGap: number
): { width?: number; height?: number } {
  const records = children.map(readRecord);
  if (!records.length) return {};

  const padding = readRecord(item.padding);
  const paddingX = (readNumber(padding.left) ?? 0) + (readNumber(padding.right) ?? 0);
  const paddingY = (readNumber(padding.top) ?? 0) + (readNumber(padding.bottom) ?? 0);
  const sizes = records.map(flowChildSize);

  if (!wrap) {
    if (direction === "row") {
      return {
        width:
          paddingX +
          sizes.reduce((sum, size) => sum + size.width, 0) +
          columnGap * Math.max(0, sizes.length - 1),
      };
    }
    return {
      height:
        paddingY +
        sizes.reduce((sum, size) => sum + size.height, 0) +
        rowGap * Math.max(0, sizes.length - 1),
    };
  }

  const mainLimit =
    direction === "row"
      ? box.width == null
        ? null
        : Math.max(1, box.width - paddingX)
      : box.height == null
        ? null
        : Math.max(1, box.height - paddingY);
  if (mainLimit == null) return {};

  const lines: Array<{ cross: number; main: number }> = [];
  const mainGap = direction === "row" ? columnGap : rowGap;
  const crossGap = direction === "row" ? rowGap : columnGap;
  sizes.forEach((size) => {
    const childMain = direction === "row" ? size.width : size.height;
    const childCross = direction === "row" ? size.height : size.width;
    let line = lines.at(-1);
    if (!line || (line.main > 0 && line.main + mainGap + childMain > mainLimit)) {
      line = { cross: 0, main: 0 };
      lines.push(line);
    }
    line.main += (line.main > 0 ? mainGap : 0) + childMain;
    line.cross = Math.max(line.cross, childCross);
  });

  const requiredCross =
    lines.reduce((sum, line) => sum + line.cross, 0) +
    crossGap * Math.max(0, lines.length - 1);
  return direction === "row"
    ? { height: paddingY + requiredCross }
    : { width: paddingX + requiredCross };
}

function flowChildSize(child: JsonRecord) {
  const fallback = Array.isArray(child.children)
    ? childrenBounds(readArray(child.children).map(readRecord))
    : undefined;
  const box = readBox(child, fallback);
  return {
    width: box.width ?? 1,
    height: box.height ?? 1,
  };
}

function renderGrid(item: JsonRecord, mode: RenderMode): string {
  const columns = Math.max(1, Math.floor(readNumber(item.columns) ?? 1));
  const gap = readNumber(item.gap) ?? 0;
  const rowGap = readNumber(item.rowGap ?? item.row_gap) ?? gap;
  const columnGap = readNumber(item.columnGap ?? item.column_gap) ?? gap;
  const childrenList = readLayoutChildren(item);
  const renderedRows = Math.max(1, Math.ceil(childrenList.length / columns));
  const declaredRows = readNumber(item.rows);
  const rows = declaredRows == null ? null : Math.max(1, Math.floor(declaredRows));
  const size = readRecord(item.size);
  const explicitHeight = readNumber(size.height);
  const explicitWidth = readNumber(size.width);
  const children = childrenList
    .map((child) => renderItem(readRecord(child), "flow"))
    .join("");
  const rowTemplate = gridRowTemplate(rows, renderedRows, explicitHeight, rowGap);
  const columnTemplate = gridColumnTemplate(columns, explicitWidth, columnGap);
  const style = `${frameStyle(item, mode)}${boxStyle(item)}${paddingStyle(
    readRecord(item.padding)
  )}display:grid;grid-template-columns:${columnTemplate};${rowTemplate}align-items:${cssAlignment(
      readString(item.alignItems ?? item.align_items),
      "stretch"
    )};justify-items:${cssAlignment(
      readString(item.justifyItems ?? item.justify_items),
      "stretch"
    )};column-gap:${cssNumber(columnGap)}px;row-gap:${cssNumber(rowGap)}px;overflow:visible`;
  return `<div style="${style}">${children}</div>`;
}

function gridColumnTemplate(columns: number, explicitWidth: number | null, columnGap: number) {
  if (explicitWidth == null) return `repeat(${columns},minmax(0,1fr))`;
  const columnWidth = Math.max(1, (explicitWidth - columnGap * (columns - 1)) / columns);
  return `repeat(${columns},${cssNumber(columnWidth)}px)`;
}

function gridRowTemplate(
  rows: number | null,
  renderedRows: number,
  explicitHeight: number | null,
  rowGap: number
) {
  if (!rows) return "";
  if (explicitHeight == null) {
    return `grid-template-rows:repeat(${Math.max(rows, renderedRows)},minmax(0,1fr));`;
  }

  const rowHeight = Math.max(1, (explicitHeight - rowGap * (rows - 1)) / rows);
  return `grid-template-rows:repeat(${Math.max(rows, renderedRows)},${cssNumber(rowHeight)}px);`;
}

function readLayoutChildren(item: JsonRecord): unknown[] {
  const children = readArray(item.children);
  if (children.length) return children;

  const elements = readArray(item.elements);
  if (elements.length) return elements;

  const child = readRecordOrNull(item.item);
  const count = Math.max(0, Math.floor(readNumber(item.count) ?? 0));
  return child && count ? Array.from({ length: count }, () => child) : [];
}

function renderGroup(item: JsonRecord, mode: RenderMode): string {
  const children = readArray(item.children).map(readRecord);
  const content = children.map((child) => renderItem(child, "absolute")).join("");
  return `<div style="${frameStyle(item, mode, childrenBounds(children))}${boxStyle(
    item
  )}overflow:visible">${content}</div>`;
}

function renderPolygon(item: JsonRecord, mode: RenderMode): string {
  if (readString(item.type) === "vector" && vectorShape(item) === "ellipse") {
    return renderEllipseVector(item, mode);
  }

  const points = polygonPoints(item);
  if (points.length < 2) return "";

  const box = polygonBox(item, points);
  const closed = polygonClosed(item, points);
  const stroke = readRecord(item.stroke);
  const fill = readRecord(item.fill);
  const fillColor = closed
    ? colorWithOpacity(readString(fill.color) ?? "", readNumber(fill.opacity))
    : "";
  const strokeWidth = Math.max(0, readNumber(stroke.width) ?? 1);
  const strokeColor = colorWithOpacity(
    readString(stroke.color) ?? (!closed ? "#000000" : ""),
    readNumber(stroke.opacity)
  );
  if (!fillColor && !(strokeColor && strokeWidth > 0)) return "";

  const pointString = points
    .map((point) => `${cssNumber(point.x - box.x)},${cssNumber(point.y - box.y)}`)
    .join(" ");
  const dash = readArray(stroke.dash)
    .map(readNumber)
    .filter((value): value is number => value != null)
    .join(" ");
  const shape = closed
    ? `<polygon points="${escapeAttribute(pointString)}"${fillColor ? ` fill="${escapeAttribute(fillColor)}"` : ` fill="none"`}${strokeColor && strokeWidth > 0
      ? ` stroke="${escapeAttribute(strokeColor)}" stroke-width="${cssNumber(strokeWidth)}"`
      : ""
    }${dash ? ` stroke-dasharray="${dash}"` : ""}/>`
    : `<polyline points="${escapeAttribute(pointString)}" fill="none"${strokeColor && strokeWidth > 0
      ? ` stroke="${escapeAttribute(strokeColor)}" stroke-width="${cssNumber(strokeWidth)}"`
      : ""
    }${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
  return `<div style="${frameStyleFromBox(box, mode)}${transformStyle(
    item
  )}overflow:visible"><svg width="100%" height="100%" viewBox="0 0 ${cssNumber(
    box.width ?? 1
  )} ${cssNumber(
    box.height ?? 1
  )}" preserveAspectRatio="none" style="display:block;overflow:visible">${shape}</svg></div>`;
}

function renderEllipseVector(item: JsonRecord, mode: RenderMode): string {
  const points = polygonSourcePoints(item);
  if (points.length < 2) return "";

  const box = polygonBox(item, points);
  const stroke = readRecord(item.stroke);
  const fill = readRecord(item.fill);
  const fillColor = colorWithOpacity(
    readString(fill.color) ?? "",
    readNumber(fill.opacity)
  );
  const strokeWidth = Math.max(0, readNumber(stroke.width) ?? 1);
  const strokeColor = colorWithOpacity(
    readString(stroke.color) ?? "",
    readNumber(stroke.opacity)
  );
  if (!fillColor && !(strokeColor && strokeWidth > 0)) return "";

  const dash = readArray(stroke.dash)
    .map(readNumber)
    .filter((value): value is number => value != null)
    .join(" ");
  const width = box.width ?? 1;
  const height = box.height ?? 1;
  const shape = `<ellipse cx="${cssNumber(width / 2)}" cy="${cssNumber(
    height / 2
  )}" rx="${cssNumber(width / 2)}" ry="${cssNumber(height / 2)}"${fillColor
    ? ` fill="${escapeAttribute(fillColor)}"`
    : ` fill="none"`}${strokeColor && strokeWidth > 0
    ? ` stroke="${escapeAttribute(strokeColor)}" stroke-width="${cssNumber(strokeWidth)}"`
    : ""
  }${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;

  return `<div style="${frameStyleFromBox(box, mode)}${transformStyle(
    item
  )}overflow:visible"><svg width="100%" height="100%" viewBox="0 0 ${cssNumber(
    width
  )} ${cssNumber(
    height
  )}" preserveAspectRatio="none" style="display:block;overflow:visible">${shape}</svg></div>`;
}

function renderSvg(item: JsonRecord, mode: RenderMode): string {
  const svg = readStringValue(item.svg);
  if (!svg) return "";
  return `<div style="${frameStyle(item, mode)}${transformStyle(
    item
  )}overflow:hidden">${svg}</div>`;
}

function fontStyle(
  fontValue: unknown,
  options: { includeLineHeight?: boolean; includeTextDecoration?: boolean } = {}
): string {
  const font = readRecord(fontValue);
  let style = `color:${escapeCssColor(
    colorWithOpacity(readString(font.color) ?? "#111827", readNumber(font.opacity))
  )};`;
  const family = readString(font.family);
  const size = readNumber(font.size);
  if (family) style += `font-family:${escapeCssFont(family)};`;
  if (size != null) style += `font-size:${cssNumber(size)}px;`;
  if (hasOwn(font, "italic")) {
    style += readBoolean(font.italic) ? "font-style:italic;" : "font-style:normal;";
  }
  if (hasOwn(font, "bold")) {
    style += readBoolean(font.bold) ? "font-weight:700;" : "font-weight:400;";
  }
  if (options.includeLineHeight !== false) style += lineHeightStyle(font);
  const letterSpacing = readNumber(font.letterSpacing ?? font.letter_spacing);
  if (letterSpacing != null) style += `letter-spacing:${cssNumber(letterSpacing)}px;`;
  if (options.includeTextDecoration !== false) {
    style += textDecorationStyle(font);
  }
  return style;
}

function textDecorationStyle(font: JsonRecord): string {
  if (hasOwn(font, "underline")) {
    return readBoolean(font.underline)
      ? "text-decoration:underline;"
      : "text-decoration:none;";
  }

  const decorations = [font.text_decoration, font.textDecoration]
    .map((value) => readString(value)?.toLowerCase())
    .filter(Boolean);
  if (decorations.includes("underline")) return "text-decoration:underline;";
  if (decorations.includes("none")) return "text-decoration:none;";
  return "";
}

function lineHeightStyle(font: JsonRecord, fallback?: number): string {
  const lineHeight = readNumber(font.lineHeight ?? font.line_height) ?? fallback;
  if (lineHeight == null) return "";

  return `line-height:${cssNumber(lineHeight)};`;
}

function tableRows(item: JsonRecord): unknown[][] {
  const columns = readArray(item.columns);
  const bodyRows = readArray(item.rows).map(readArray);
  return (columns.length ? [columns, ...bodyRows] : bodyRows).filter((row) =>
    Array.isArray(row)
  );
}

function tableBaseFont(item: JsonRecord): JsonRecord {
  return {
    family: "Arial",
    size: 18,
    color: "#111827",
    line_height: 1.15,
    wrap: "word",
    ...readRecord(item.font),
  };
}

function tableCellStyle(
  cellValue: unknown,
  header: boolean,
  tableFont: JsonRecord
): string {
  const cell = readRecord(cellValue);
  const cellFont = tableCellFont(cellValue, tableFont);
  const alignment =
    readString(cell.alignment) ??
    readString(readRecord(cell.alignment).horizontal) ??
    readString(readRecord(readRecord(cell.text).alignment).horizontal);
  const fill = readRecord(cell.color ?? cell.fill);
  const stroke = readRecord(cell.stroke);
  const fillColor = readString(fill.color);
  const background = fillColor
    ? colorWithOpacity(fillColor, readNumber(fill.opacity))
    : "transparent";
  const forceHeaderBold = header && !tableCellHasExplicitBold(cellValue);
  let style = `${fontStyle(cellFont, {
    includeTextDecoration: false,
  })}display:flex;align-items:center;justify-content:${horizontalAlign(
    alignment
  )};border:${cssNumber(
    readNumber(stroke.width) ?? 1
  )}px solid ${escapeCssColor(
    colorWithOpacity(readString(stroke.color) ?? "#D1D5DB", readNumber(stroke.opacity))
  )};min-height:0;min-width:0;overflow:hidden;padding:4px 6px;text-align:${textAlign(
    alignment
  )};vertical-align:middle;white-space:pre-wrap;word-break:break-word;`;
  if (forceHeaderBold && !readBoolean(cellFont.bold)) style += "font-weight:700;";
  style += `background:${escapeCssColor(background)};`;
  return style;
}

function tableCellFont(cellValue: unknown, tableFont: JsonRecord): JsonRecord {
  if (typeof cellValue === "string" || typeof cellValue === "number") {
    return tableFont;
  }

  const cell = readRecord(cellValue);
  const firstRun = readRecord(readArray(cell.runs)[0]);
  const text = readRecord(cell.text);
  return {
    ...tableFont,
    ...readRecord(cell.font),
    ...(Object.keys(firstRun).length ? readRecord(firstRun.font) : {}),
    ...(Object.keys(text).length ? readRecord(text.font) : {}),
  };
}

function tableCellHasExplicitBold(cellValue: unknown): boolean {
  if (typeof cellValue === "string" || typeof cellValue === "number") {
    return false;
  }

  const cell = readRecord(cellValue);
  const firstRun = readRecord(readArray(cell.runs)[0]);
  const text = readRecord(cell.text);
  return (
    Object.prototype.hasOwnProperty.call(readRecord(cell.font), "bold") ||
    Object.prototype.hasOwnProperty.call(readRecord(firstRun.font), "bold") ||
    Object.prototype.hasOwnProperty.call(readRecord(text.font), "bold")
  );
}

function cellText(
  cellValue: unknown,
  tableFont: JsonRecord,
  header: boolean
): string {
  if (typeof cellValue === "string" || typeof cellValue === "number") {
    return escapeHtml(readStringValue(cellValue));
  }

  const cell = readRecord(cellValue);
  const fill = readRecord(cell.color ?? cell.fill);
  const fillColor = readString(fill.color)
    ? colorWithOpacity(readString(fill.color) ?? "", readNumber(fill.opacity))
    : null;
  const forceHeaderBold = header && !tableCellHasExplicitBold(cellValue);
  const headerFontPatch = forceHeaderBold ? { bold: true } : {};
  const directRuns = readArray(cell.runs).map(readRecord);
  if (directRuns.length) {
    const runs = normalizeRunsForHtml(
      directRuns,
      Object.prototype.hasOwnProperty.call(cell, "text")
        ? cell.text
        : joinedRunText(directRuns),
      cell.font,
    );
    return runs
      .map((run) => {
        const runFont = readableTableFont(
          {
            ...tableFont,
            ...readRecord(cell.font),
            ...readRecord(run.font),
            ...headerFontPatch,
          },
          fillColor,
          header
        );
        return renderTextRunHtml(run, runFont);
      })
      .join("");
  }

  const text = cell.text;
  if (typeof text === "string") {
    return `<span style="${fontStyle(
      readableTableFont(
        { ...tableFont, ...readRecord(cell.font), ...headerFontPatch },
        fillColor,
        header
      )
    )}">${escapeHtml(text)}</span>`;
  }
  const textRecord = readRecord(text);
  const textRuns = normalizedRunsForHtml(textRecord, textRecord.font);
  if (textRuns.length) {
    return textRuns
      .map((run) => {
        const runFont = readableTableFont(
          {
            ...tableFont,
            ...readRecord(cell.font),
            ...readRecord(textRecord.font),
            ...readRecord(run.font),
            ...headerFontPatch,
          },
          fillColor,
          header
        );
        return renderTextRunHtml(run, runFont);
      })
      .join("");
  }
  return `<span style="${fontStyle(
    readableTableFont(
      { ...tableFont, ...readRecord(cell.font), ...headerFontPatch },
      fillColor,
      header
    )
  )}">${escapeHtml(readStringValue(textRecord.text))}</span>`;
}

function readableTableFont(
  font: JsonRecord,
  fillColor: string | null,
  header: boolean
): JsonRecord {
  if (header) return font;
  return {
    ...font,
    color: readableTableTextColor(readString(font.color), fillColor),
  };
}

function readableTableTextColor(
  color: string | null,
  fill: string | null
): string {
  const textColor = normalizeReadableColor(color) ?? "#111827";
  const textLuminance = colorLuminance(textColor);
  const fillLuminance = colorLuminance(fill);
  if (textLuminance == null || fillLuminance == null) return textColor;

  const lighter = Math.max(textLuminance, fillLuminance);
  const darker = Math.min(textLuminance, fillLuminance);
  const contrast = (lighter + 0.05) / (darker + 0.05);
  if (contrast >= 3) return textColor;
  return fillLuminance > 0.5 ? "#111827" : "#FFFFFF";
}

function colorLuminance(color: string | null): number | null {
  const rgb = parseRgbColor(color);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function parseRgbColor(color: string | null): [number, number, number] | null {
  const value = normalizeReadableColor(color);
  if (!value) return null;

  const hex = value.startsWith("#") ? value.slice(1) : value;
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return [
      Number.parseInt(hex[0] + hex[0], 16),
      Number.parseInt(hex[1] + hex[1], 16),
      Number.parseInt(hex[2] + hex[2], 16),
    ];
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return [
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16),
    ];
  }

  const rgb = value.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i
  );
  if (!rgb) return null;
  return [
    clamp(Number(rgb[1]), 0, 255),
    clamp(Number(rgb[2]), 0, 255),
    clamp(Number(rgb[3]), 0, 255),
  ];
}

function normalizeReadableColor(color: string | null): string | null {
  if (!color) return null;
  const value = color.trim();
  if (!value) return null;
  return value.startsWith("#") || value.startsWith("rgb") ? value : `#${value}`;
}

function readRuns(item: JsonRecord): JsonRecord[] {
  const runs = readArray(item.runs).map(readRecord);
  return runs.length ? runs : [{ text: readStringValue(item.text) }];
}

function normalizedRunsForHtml(item: JsonRecord, fallbackFont: unknown): JsonRecord[] {
  const runs = readRuns(item);
  return normalizeRunsForHtml(
    runs,
    Object.prototype.hasOwnProperty.call(item, "text")
      ? item.text
      : joinedRunText(runs),
    item.font ?? fallbackFont,
  );
}

function normalizedListRunsForHtml(value: unknown, fallbackFont: unknown): JsonRecord[] {
  const runs = readListRuns(value);
  const record = readRecord(value);
  return normalizeRunsForHtml(
    runs,
    Object.prototype.hasOwnProperty.call(record, "text")
      ? record.text
      : joinedRunText(runs),
    record.font ?? fallbackFont,
  );
}

function normalizeRunsForHtml(
  runs: JsonRecord[],
  text: unknown,
  fallbackFont: unknown,
): JsonRecord[] {
  const normalized = normalizeRawTextMarkdownElement({
    type: "text",
    font: fallbackFont,
    text: readStringValue(text),
    runs,
  }).runs;

  return normalized.map((run) =>
    isLatexTextRun(run)
      ? {
          type: "latex",
          latex: run.latex,
          display_mode: run.display_mode ?? false,
          font: run.font,
        }
      : { text: run.text, font: run.font },
  );
}

function joinedRunText(runs: JsonRecord[]): string {
  return runs
    .map((run) =>
      readString(run.type) === "latex"
        ? normalizeMathLatex(run.latex)
        : readStringValue(run.text),
    )
    .join("");
}

function renderTextRunHtml(run: JsonRecord, font: JsonRecord): string {
  if (readString(run.type) !== "latex") {
    return `<span style="${fontStyle(font)}">${escapeHtml(
      readStringValue(run.text),
    )}</span>`;
  }

  const latex = normalizeMathLatex(run.latex);
  if (!latex) return "";
  const displayMode = readBoolean(run.display_mode ?? run.displayMode) ?? false;
  const display = displayMode ? "block" : "inline-block";
  return `<span class="gslide-math" data-gslide-math="true" data-screenshot="true" data-screenshot-include-children="true" aria-label="${escapeAttribute(
    `Mathematical expression: ${latex}`,
  )}" style="${fontStyle(
    font,
    { includeLineHeight: false },
  )}display:${display};vertical-align:middle;max-width:100%;line-height:normal;overflow:visible;">${renderMathHtml(
    latex,
    { displayMode, output: "mathml" },
  )}</span>`;
}

function readListRuns(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.map(readRecord);
  const record = readRecord(value);
  const runs = readArray(record.runs).map(readRecord);
  if (runs.length) return runs;
  if (Object.prototype.hasOwnProperty.call(record, "text")) {
    return [{ text: readStringValue(record.text), font: record.font }];
  }
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return [{ text: readStringValue(value) }];
  }
  return [];
}

function textOverflowStyle(): string {
  return "overflow:hidden;white-space:pre-wrap;";
}
