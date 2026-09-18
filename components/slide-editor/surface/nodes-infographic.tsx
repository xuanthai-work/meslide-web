"use client";

import { Arc, Circle, Group, Rect } from "react-konva";
import {
  asRecord,
  pointOnCircle,
  readArray,
  readString,
  shadowProps,
  valueProgress,
  withHash,
  type RawElement,
} from "@/components/slide-editor/model/model";

export function RawInfographicElement({
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
  const data = asRecord(element.data);
  const colors = readArray(element.colors);
  const infographicType = readString(data?.type) ?? "gauge";
  const progress = valueProgress(element);
  const baseColor =
    withHash(readString(colors[0])) ??
    "#E5E7EB";
  const highlightColor =
    withHash(readString(colors[1])) ?? "#2563EB";
  if (infographicType === "progress_bar") {
    const barHeight = Math.max(6, Math.min(18, Math.round(height * 0.35)));
    const barY = (height - barHeight) / 2;
    const radius = barHeight / 2;
    return (
      <Group listening={interactive} {...shadowProps(element)}>
        <Rect
          y={barY}
          width={width}
          height={barHeight}
          cornerRadius={radius}
          fill={baseColor}
        />
        <Rect
          y={barY}
          width={width * progress}
          height={barHeight}
          cornerRadius={radius}
          fill={highlightColor}
        />
      </Group>
    );
  }

  const valueAngle = 180 * progress;
  const thickness = Math.max(6, Math.min(width * 0.1, height / 6));
  const outerRadius = Math.max(1, Math.min(width * 0.43, height * 0.86));
  const innerRadius = Math.max(1, outerRadius - thickness);
  const middleRadius = (outerRadius + innerRadius) / 2;
  const capRadius = thickness / 2;
  const centerX = width / 2;
  const centerY = Math.min(height - capRadius, height * 0.86);
  const start = pointOnCircle(centerX, centerY, middleRadius, 180);
  const end = pointOnCircle(centerX, centerY, middleRadius, 180 + valueAngle);
  return (
    <Group listening={interactive} {...shadowProps(element)}>
      <Arc
        x={centerX}
        y={centerY}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        angle={180}
        rotation={180}
        fill={baseColor}
      />
      <Circle x={start.x} y={start.y} radius={capRadius} fill={baseColor} />
      <Circle
        x={pointOnCircle(centerX, centerY, middleRadius, 360).x}
        y={pointOnCircle(centerX, centerY, middleRadius, 360).y}
        radius={capRadius}
        fill={baseColor}
      />
      {valueAngle > 0 ? (
        <>
          <Arc
            x={centerX}
            y={centerY}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            angle={valueAngle}
            rotation={180}
            fill={highlightColor}
          />
          <Circle x={start.x} y={start.y} radius={capRadius} fill={highlightColor} />
          <Circle x={end.x} y={end.y} radius={capRadius} fill={highlightColor} />
        </>
      ) : null}
    </Group>
  );
}

