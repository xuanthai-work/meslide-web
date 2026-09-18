"use client";

import { Fragment } from "react";
import type Konva from "konva";
import { Circle, Ellipse, Group, Line, Text } from "react-konva";
import {
  asRecord,
  colorWithOpacity,
  fillColor,
  fillOpacity,
  lineStrokeWidth,
  polygonClosedForElement,
  polygonLocalPointsForElement,
  readArray,
  readBoolean,
  readNumber,
  shadowProps,
  strokeColor,
  strokeOpacity,
  vectorShapeForElement,
  vectorVertexEntriesForElement,
  type Box,
  type Point,
  type RawElement,
} from "@/components/slide-editor/model/model";

const VECTOR_VERTEX_HANDLE_RADIUS = 5;
const VECTOR_VERTEX_HANDLE_STROKE_WIDTH = 2;
const VECTOR_VERTEX_HANDLE_COLOR = "#1D6FE8";
const VECTOR_VERTEX_HANDLE_HIT_RADIUS = 14;
const VECTOR_ADD_HANDLE_RADIUS = 6;
const VECTOR_DELETE_HANDLE_RADIUS = 5;
const VECTOR_DELETE_HANDLE_OFFSET = 11;
const VECTOR_DELETE_HANDLE_COLOR = "#EF4444";

function setStageCursor(
  event: Konva.KonvaEventObject<MouseEvent>,
  cursor: string,
) {
  const container = event.target.getStage()?.container();
  if (container) container.style.cursor = cursor;
}

export function VectorVertexHandles({
  element,
  originBox,
  onSelect,
  onPreview,
  onCommit,
  onInsert,
  onRemove,
}: {
  element: RawElement;
  originBox: Box;
  onSelect: () => void;
  onPreview: (index: number, point: Point) => void;
  onCommit: (index: number, point: Point) => void;
  onInsert: (afterIndex: number, point: Point) => void;
  onRemove: (index: number) => void;
}) {
  const vertices = vectorVertexEntriesForElement(element);
  if (vertices.length === 0) return null;
  const isEllipse = vectorShapeForElement(element) === "ellipse";
  const closed = isEllipse || (readBoolean(element.closed) ?? vertices.length > 2);
  const canRemove = !isEllipse && vertices.length > (closed ? 3 : 2);
  const edges = isEllipse
    ? []
    : vertices.flatMap((vertex, orderIndex) => {
        const next = vertices[orderIndex + 1] ?? (closed ? vertices[0] : null);
        return next ? [{ current: vertex, next }] : [];
      });

  return (
    <>
      {edges.map(({ current, next }) => {
        const x = (current.point.x + next.point.x) / 2 - originBox.x;
        const y = (current.point.y + next.point.y) / 2 - originBox.y;
        const point = {
          x: originBox.x + x,
          y: originBox.y + y,
        };
        return (
          <Group
            key={`${current.index}:${next.index}`}
            x={x}
            y={y}
            listening
            onMouseDown={(event) => {
              event.cancelBubble = true;
              onSelect();
            }}
            onTouchStart={(event) => {
              event.cancelBubble = true;
              onSelect();
            }}
            onMouseEnter={(event) => setStageCursor(event, "copy")}
            onMouseLeave={(event) => setStageCursor(event, "")}
            onClick={(event) => {
              event.cancelBubble = true;
              onInsert(current.index, point);
            }}
            onTap={(event) => {
              event.cancelBubble = true;
              onInsert(current.index, point);
            }}
          >
            <Circle
              radius={VECTOR_ADD_HANDLE_RADIUS}
              fill={VECTOR_VERTEX_HANDLE_COLOR}
              stroke="#FFFFFF"
              strokeWidth={1}
              hitStrokeWidth={VECTOR_VERTEX_HANDLE_HIT_RADIUS}
              perfectDrawEnabled={false}
            />
            <Text
              x={-VECTOR_ADD_HANDLE_RADIUS}
              y={-VECTOR_ADD_HANDLE_RADIUS - 0.5}
              width={VECTOR_ADD_HANDLE_RADIUS * 2}
              height={VECTOR_ADD_HANDLE_RADIUS * 2}
              align="center"
              verticalAlign="middle"
              fill="#FFFFFF"
              fontSize={11}
              fontStyle="bold"
              listening={false}
              text="+"
            />
          </Group>
        );
      })}
      {vertices.map(({ index, point }) => {
        const x = point.x - originBox.x;
        const y = point.y - originBox.y;
        return (
          <Fragment key={index}>
            <Circle
              x={x}
              y={y}
              radius={VECTOR_VERTEX_HANDLE_RADIUS}
              fill="#FFFFFF"
              stroke={VECTOR_VERTEX_HANDLE_COLOR}
              strokeWidth={VECTOR_VERTEX_HANDLE_STROKE_WIDTH}
              hitStrokeWidth={VECTOR_VERTEX_HANDLE_HIT_RADIUS}
              draggable
              listening
              perfectDrawEnabled={false}
              shadowColor="#101828"
              shadowBlur={4}
              shadowOffsetX={0}
              shadowOffsetY={1}
              shadowOpacity={0.18}
              onMouseDown={(event) => {
                event.cancelBubble = true;
                onSelect();
              }}
              onTouchStart={(event) => {
                event.cancelBubble = true;
                onSelect();
              }}
              onClick={(event) => {
                event.cancelBubble = true;
                if (event.evt.altKey && canRemove) onRemove(index);
              }}
              onTap={(event) => {
                event.cancelBubble = true;
              }}
              onDblClick={(event) => {
                event.cancelBubble = true;
                if (canRemove) onRemove(index);
              }}
              onDblTap={(event) => {
                event.cancelBubble = true;
                if (canRemove) onRemove(index);
              }}
              onMouseEnter={(event) => setStageCursor(event, "move")}
              onMouseLeave={(event) => setStageCursor(event, "")}
              onDragStart={(event) => {
                event.cancelBubble = true;
                onSelect();
              }}
              onDragMove={(event) => {
                event.cancelBubble = true;
                onPreview(index, {
                  x: originBox.x + event.target.x(),
                  y: originBox.y + event.target.y(),
                });
              }}
              onDragEnd={(event) => {
                event.cancelBubble = true;
                onCommit(index, {
                  x: originBox.x + event.target.x(),
                  y: originBox.y + event.target.y(),
                });
              }}
            />
            {canRemove ? (
              <Group
                x={x + VECTOR_DELETE_HANDLE_OFFSET}
                y={y - VECTOR_DELETE_HANDLE_OFFSET}
                listening
                onMouseDown={(event) => {
                  event.cancelBubble = true;
                  onSelect();
                }}
                onTouchStart={(event) => {
                  event.cancelBubble = true;
                  onSelect();
                }}
                onMouseEnter={(event) => setStageCursor(event, "pointer")}
                onMouseLeave={(event) => setStageCursor(event, "")}
                onClick={(event) => {
                  event.cancelBubble = true;
                  onRemove(index);
                }}
                onTap={(event) => {
                  event.cancelBubble = true;
                  onRemove(index);
                }}
              >
                <Circle
                  radius={VECTOR_DELETE_HANDLE_RADIUS}
                  fill={VECTOR_DELETE_HANDLE_COLOR}
                  stroke="#FFFFFF"
                  strokeWidth={1}
                  hitStrokeWidth={VECTOR_VERTEX_HANDLE_HIT_RADIUS}
                  perfectDrawEnabled={false}
                />
                <Text
                  x={-VECTOR_DELETE_HANDLE_RADIUS}
                  y={-VECTOR_DELETE_HANDLE_RADIUS - 0.5}
                  width={VECTOR_DELETE_HANDLE_RADIUS * 2}
                  height={VECTOR_DELETE_HANDLE_RADIUS * 2}
                  align="center"
                  verticalAlign="middle"
                  fill="#FFFFFF"
                  fontSize={9}
                  fontStyle="bold"
                  listening={false}
                  text="x"
                />
              </Group>
            ) : null}
          </Fragment>
        );
      })}
    </>
  );
}

export function RawVectorElement({
  element,
  width,
  height,
  interactive,
  vectorOriginBox,
}: {
  element: RawElement;
  width: number;
  height: number;
  interactive: boolean;
  vectorOriginBox?: Box | null;
}) {
  const vectorShape = vectorShapeForElement(element);
  const stroke = colorWithOpacity(
    strokeColor(element.stroke),
    strokeOpacity(element.stroke),
  );
  const lineWidth = lineStrokeWidth(element);
  const lineDash = readArray(asRecord(element.stroke)?.dash)
    .map(readNumber)
    .filter((value): value is number => value != null);

  if (vectorShape === "ellipse") {
    const fill = colorWithOpacity(fillColor(element.fill), fillOpacity(element.fill));
    if (!fill && !(stroke && lineWidth > 0)) return null;
    return (
      <Ellipse
        x={width / 2}
        y={height / 2}
        radiusX={width / 2}
        radiusY={height / 2}
        fill={fill}
        stroke={stroke}
        strokeWidth={stroke ? lineWidth : 0}
        dash={lineDash.length ? lineDash : undefined}
        hitStrokeWidth={Math.max(20, lineWidth)}
        {...shadowProps(element)}
        listening={interactive}
      />
    );
  }

  const points = polygonLocalPointsForElement(
    element,
    vectorOriginBox ?? undefined,
  );
  const closed = polygonClosedForElement(element);
  const fill = closed
    ? colorWithOpacity(fillColor(element.fill), fillOpacity(element.fill))
    : undefined;
  const polygonStroke = colorWithOpacity(
    strokeColor(element.stroke) ?? (!closed ? "#000000" : undefined),
    strokeOpacity(element.stroke),
  );
  if (points.length < 4) return null;
  if (!fill && !(polygonStroke && lineWidth > 0)) return null;
  return (
    <Line
      points={points}
      closed={closed}
      fill={fill}
      stroke={polygonStroke}
      strokeWidth={polygonStroke ? lineWidth : 0}
      dash={lineDash.length ? lineDash : undefined}
      hitStrokeWidth={Math.max(20, lineWidth)}
      {...shadowProps(element)}
      listening={interactive}
    />
  );
}
