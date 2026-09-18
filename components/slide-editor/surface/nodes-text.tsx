"use client";

import { Group, Text } from "react-konva";
import { effectiveLineHeight } from "@/components/slide-editor/text/text-line-height";
import { textRunsContent } from "@/components/slide-editor/text/text-runs";
import {
  displayText,
  layoutTextListRenderItems,
  layoutRenderTextRuns,
  lineRenderHeight,
  lineStartX,
  rawFont,
  rawRenderTextRuns,
  rawTextContent,
  renderKonvaTextSegment,
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
  const lines = layoutRenderTextRuns(layoutRuns, width, "word");
  const lineMetrics = lines.map((line) => ({
    height: lineRenderHeight(line, textLineHeight),
    width: line.reduce((sum, segment) => sum + segment.width, 0),
  }));
  const totalHeight = lineMetrics.reduce(
    (sum, metric) => sum + metric.height,
    0,
  );
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
    <Group listening={interactive}>
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
          // Keep width automatic. The custom layout owns the x advance; a fixed
          // tight width lets Konva re-wrap and clip the final glyph.
          return (
            <Text
              key={`${lineIndex}:${segmentIndex}`}
              x={segmentX}
              y={lineY}
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
  const { tokens } = layoutTextListRenderItems(element, width, height);

  return (
    <Group listening={interactive}>
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
