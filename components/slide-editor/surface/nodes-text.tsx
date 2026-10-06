"use client";

import { Group, Text } from "react-konva";
import { effectiveLineHeight } from "@/components/slide-editor/text/text-line-height";
import { verticalGlyphClipBounds } from "@/components/slide-editor/text/template-v2-text-fit.mjs";
import { textRunsContent } from "@/components/slide-editor/text/text-runs";
import {
  displayText,
  fitRenderTextListToBox as fitTextListToBox,
  fitRenderTextToBox as fitTextToBox,
  lineRenderHeight,
  lineStartX,
  rawFont,
  rawRenderTextRuns,
  rawTextContent,
  rawTextListRenderItems,
  renderKonvaTextSegment,
  type LaidToken,
  type RenderTextRun,
} from "@/components/slide-editor/text/template-v2-text";
import { LatexRunNode } from "@/components/slide-editor/math/LatexRunNode";
import {
  colorWithOpacity,
  readString,
  shadowProps,
  withHash,
  type RawElement,
} from "@/components/slide-editor/model/model";

const KONVA_GLYPH_PAD_PX = 2;

function konvaTextPaintWidth(width: number) {
  if (!Number.isFinite(width) || width <= 0) return 0;
  return Math.ceil(width) + KONVA_GLYPH_PAD_PX;
}

export function RawRichTextElement({
  element,
  width,
  height,
  text,
  runs: runsOverride,
  interactive,
}: {
  element: RawElement;
  width: number;
  height: number;
  text?: string;
  runs?: RenderTextRun[];
  interactive: boolean;
}) {
  const font = rawFont(element);
  const renderRuns =
    runsOverride ?? (text == null ? rawRenderTextRuns(element) : []);
  const content =
    text ??
    (runsOverride ? textRunsContent(runsOverride) : rawTextContent(element));
  const displayContent = displayText(content);
  const align = readString(element.alignment?.horizontal) ?? "left";
  const verticalAlign = readString(element.alignment?.vertical) ?? "top";
  const textLineHeight = effectiveLineHeight({
    text: displayContent,
    width,
    fontSize: font.size,
    lineHeight: font.lineHeight,
    fallback: 1.15,
    wrap: "word",
  });

  const layoutRuns =
    renderRuns.length > 0 ? renderRuns : [{ text: displayContent, font }];
  const declaredWidth = Number(element.size?.width);
  const declaredHeight = Number(element.size?.height);
  const fitWidth = declaredWidth > 0 ? declaredWidth : width;
  const fitHeight = declaredHeight > 0 ? declaredHeight : height;
  const fitted = fitTextToBox(layoutRuns, { width: fitWidth, height: fitHeight });
  const lines = fitted.lines as Array<
    Array<RenderTextRun & { width: number }>
  >;
  const lineMetrics = lines.map((line) => ({
    height: lineRenderHeight(line, textLineHeight),
    width: line.reduce((sum, segment) => sum + segment.width, 0),
  }));
  const totalHeight = lineMetrics.reduce(
    (sum, metric) => sum + metric.height,
    0,
  );
  // Narrowing the box mid-resize wraps the copy onto more lines than the box is
  // tall. Clipping to the box would slice the last line through its glyphs, so
  // the window follows the copy whenever it outgrows the box.
  const effectiveClipHeight = Math.max(height, totalHeight, fitHeight);
  const clip = verticalGlyphClipBounds(lines, effectiveClipHeight);
  const startY =
    verticalAlign === "middle"
      ? Math.max(0, (height - totalHeight) / 2)
      : verticalAlign === "bottom"
        ? Math.max(0, height - totalHeight)
        : 0;
  const laidOutSegments: {
    lineIndex: number;
    segmentIndex: number;
    segment: (typeof lines)[number][number];
    segmentX: number;
    lineY: number;
    lineHeight: number;
  }[] = [];
  let y = startY;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const lineMetric = lineMetrics[lineIndex] ?? {
      height: font.size * textLineHeight,
      width: 0,
    };
    const startX = lineStartX(align, width, lineMetric.width, false);
    const justifyGapCount =
      align === "justify" && lineIndex < lines.length - 1
        ? line.filter(
            (segment, segmentIndex) =>
              segmentIndex < line.length - 1 &&
              segment.type !== "latex" &&
              /^\s+$/.test(segment.text),
          ).length
        : 0;
    const justifyGapWidth =
      justifyGapCount > 0
        ? Math.max(0, width - lineMetric.width) / justifyGapCount
        : 0;
    let x = startX;
    const lineY = y;
    y += lineMetric.height;
    for (let segmentIndex = 0; segmentIndex < line.length; segmentIndex += 1) {
      const segment = line[segmentIndex];
      const segmentX = x;
      x +=
        segment.width +
        (segmentIndex < line.length - 1 &&
        segment.type !== "latex" &&
        /^\s+$/.test(segment.text)
          ? justifyGapWidth
          : 0);
      laidOutSegments.push({
        lineIndex,
        segmentIndex,
        segment,
        segmentX,
        lineY,
        lineHeight: lineMetric.height,
      });
    }
  }

  return (
    <Group
      listening={interactive}
      clipX={0}
      clipY={clip.y}
      clipWidth={width}
      clipHeight={clip.height}
    >
      {laidOutSegments.map(
        ({ lineIndex, segmentIndex, segment, segmentX, lineY, lineHeight }) => {
          if (segment.type === "latex" && segment.latex) {
            return (
              <LatexRunNode
                key={`${lineIndex}:${segmentIndex}`}
                x={segmentX}
                y={lineY}
                width={segment.width}
                height={lineHeight}
                latex={segment.latex}
                displayMode={segment.displayMode}
                fontSize={segment.font.size}
                color={textFill(segment.font) ?? "#111827"}
                interactive={interactive}
              />
            );
          }
          return (
            <Text
              key={`${lineIndex}:${segmentIndex}`}
              x={segmentX}
              y={lineY}
              width={konvaTextPaintWidth(segment.width)}
              height={lineHeight}
              text={renderKonvaTextSegment(segment.text)}
              fill={textFill(segment.font)}
              fontFamily={`${segment.font.family}, Helvetica, sans-serif`}
              fontSize={segment.font.size}
              fontStyle={`${segment.font.bold ? "bold" : "normal"} ${segment.font.italic ? "italic" : ""}`}
              textDecoration={segment.font.underline ? "underline" : ""}
              verticalAlign="middle"
              lineHeight={segment.font.lineHeight ?? textLineHeight}
              letterSpacing={segment.font.letterSpacing}
              wrap="none"
              {...shadowProps(element)}
              listening={interactive}
            />
          );
        },
      )}
    </Group>
  );
}

function textFill(font: { color: string; opacity?: number | null }) {
  return colorWithOpacity(withHash(font.color), font.opacity ?? 1);
}

export function RawTextListElement({
  element,
  width,
  height,
  interactive,
}: {
  element: RawElement;
  width: number;
  height: number;
  interactive: boolean;
}) {
  const font = rawFont(element);
  const items = rawTextListRenderItems(element);
  const declaredWidth = Number(element.size?.width);
  const declaredHeight = Number(element.size?.height);
  const fitWidth = declaredWidth > 0 ? declaredWidth : width;
  const fitHeight = declaredHeight > 0 ? declaredHeight : height;
  const fitted = fitTextListToBox(items, { width: fitWidth, height: fitHeight });
  const lines = fitted.lines as Array<
    Array<RenderTextRun & { width: number }>
  >;
  const align = readString(element.alignment?.horizontal) ?? "left";
  const verticalAlign = readString(element.alignment?.vertical) ?? "top";
  const textLineHeight = effectiveLineHeight({
    text: textRunsContent(items.flatMap((item) => item.runs)),
    width,
    fontSize: font.size,
    lineHeight: font.lineHeight,
    fallback: 1.15,
    wrap: "word",
  });
  const lineMetrics = lines.map((line) => ({
    height: lineRenderHeight(line, textLineHeight),
    width: line.reduce((sum, segment) => sum + segment.width, 0),
  }));
  const contentHeight = lineMetrics.reduce(
    (sum, metric) => sum + metric.height,
    0,
  );
  // Same as the rich-text box: the window covers the copy, not just the frame.
  const effectiveClipHeight = Math.max(height, contentHeight, fitHeight);
  const clip = verticalGlyphClipBounds(lines, effectiveClipHeight);
  let y =
    verticalAlign === "middle"
      ? Math.max(0, (height - contentHeight) / 2)
      : verticalAlign === "bottom"
        ? Math.max(0, height - contentHeight)
        : 0;
  const tokens: LaidToken[] = [];

  lines.forEach((line, lineIndex) => {
    const metric = lineMetrics[lineIndex] ?? { height: 1, width: 0 };
    let x = lineStartX(align, width, metric.width, false);
    line.forEach((segment) => {
      const segmentHeight =
        segment.renderHeight ??
        segment.font.size * (segment.font.lineHeight ?? textLineHeight);
      tokens.push({
        ...segment,
        text: segment.text,
        font: segment.font,
        x,
        y: y + (metric.height - segmentHeight),
        width: segment.width,
        height: segmentHeight,
      });
      x += segment.width;
    });
    y += metric.height;
  });

  return (
    <Group
      listening={interactive}
      clipX={0}
      clipY={clip.y}
      clipWidth={width}
      clipHeight={clip.height}
    >
      {tokens.map((token, tokenIndex) => (
        token.type === "latex" && token.latex ? (
          <LatexRunNode
            key={`${tokenIndex}:${token.x}:${token.y}`}
            x={token.x}
            y={token.y}
            width={token.width}
            height={token.height}
            latex={token.latex}
            displayMode={token.displayMode}
            fontSize={token.font.size}
            color={textFill(token.font) ?? "#111827"}
            interactive={interactive}
          />
        ) : (
          <Text
            key={`${tokenIndex}:${token.x}:${token.y}`}
            x={token.x}
            y={token.y}
            width={konvaTextPaintWidth(token.width)}
            height={token.height}
            text={renderKonvaTextSegment(token.text)}
            fill={textFill(token.font)}
            fontFamily={`${token.font.family}, Helvetica, sans-serif`}
            fontSize={token.font.size}
            fontStyle={`${token.font.bold ? "bold" : "normal"} ${token.font.italic ? "italic" : ""}`}
            textDecoration={token.font.underline ? "underline" : ""}
            verticalAlign="middle"
            lineHeight={token.font.lineHeight}
            letterSpacing={token.font.letterSpacing}
            wrap="none"
            {...shadowProps(element)}
            listening={interactive}
          />
        )
      ))}
    </Group>
  );
}
