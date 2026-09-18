"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import type Konva from "konva";
import {
  Group,
  Rect,
} from "react-konva";
import { TRANSFORM_ANCHOR_ATTR } from "@/components/slide-editor/selection/transformSession";
import {
  fontScaleFromResize,
  textListVisualLocalBox,
  textVisualLocalBox,
} from "@/components/slide-editor/text/template-v2-text";
import type { TableCellSelection } from "@/components/slide-editor/state/state";
import { constrainComponentTransformBounds } from "@/components/slide-editor/surface/componentFrameBounds";
import {
  createLatestFrameBatch,
  type LatestFrameBatch,
} from "@/components/slide-editor/surface/latestFrameBatch";
import { TemplateV2ChartJsElement as RawChartElement } from "@/components/slide-editor/charts/TemplateV2ChartJsElement";
import { TemplateV2TableElement as RawTableElement } from "@/components/slide-editor/tables/TemplateV2TableElement";
import {
  componentSideResizeBox,
  resizeComponentFromSideTransform,
  type ComponentSideResizeAnchor,
} from "@/components/slide-editor/model/component-resize";
import {
  anchoredFramePositionForResize,
  anchoredFramePositionForResizeUnclamped,
  borderRadius,
  childArrayInfo,
  clamp,
  colorWithOpacity,
  componentBox,
  elementBox,
  fillColor,
  fillOpacity,
  boxEqual,
  insertVectorPointInElement,
  isBoxVisualType,
  isManualPositioned,
  isVectorType,
  isRecord,
  keyForSelection,
  layoutChildren,
  nullableBoxEqual,
  numberPathEqual,
  positionFromNodeInParent,
  polygonElementFromFrame,
  rawElementKey,
  readArray,
  readNumber,
  readPoint,
  readString,
  ROOT_ELEMENTS_COMPONENT_INDEX,
  STAGE_BOX,
  resizeComponent,
  resizeComponentElementBounds,
  resizeComponentFrame,
  scaleRawElementTextMetrics,
  selectionTouchesComponent,
  selectionTouchesElement,
  shadowProps,
  shouldClipElementChildren,
  shouldUseCenterOrigin,
  strokeColor,
  strokeOpacity,
  strokeWidth,
  removeVectorPointFromElement,
  translateVectorElement,
  unclampedPositionFromNodeInParent,
  updateVectorVertexPoint,
  type Box,
  type ComponentSelection,
  type ElementSelection,
  type Point,
  type RawComponent,
  type RawElement,
  type SelectOptions,
  type Selection,
} from "@/components/slide-editor/model/model";
import { RawImageElement } from "@/components/slide-editor/surface/nodes-image";
import { RawInfographicElement } from "@/components/slide-editor/surface/nodes-infographic";
import { RawRichTextElement, RawTextListElement } from "@/components/slide-editor/surface/nodes-text";
import { RawVectorElement, VectorVertexHandles } from "@/components/slide-editor/surface/nodes-vector";

type ComponentTransformAnchor =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "rotater";

type ComponentResizeMode =
  | "scale-content"
  | "resize-element-bounds"
  | "resize-frame";

type ComponentTransformBox = Box & {
  scaleX: number;
  scaleY: number;
  rawWidth: number;
  rawHeight: number;
};

type ComponentSideTransformTarget = {
  anchor: ComponentSideResizeAnchor;
  box: Box;
  rotation: number;
};

type ComponentSideTransformPreview = {
  source: RawComponent;
  sourceBox: Box;
  target: ComponentSideTransformTarget;
};

const HORIZONTAL_RESIZE_ANCHORS = new Set<ComponentTransformAnchor>([
  "middle-left",
  "middle-right",
]);
const VERTICAL_RESIZE_ANCHORS = new Set<ComponentTransformAnchor>([
  "top-center",
  "bottom-center",
]);

function isComponentSideResizeAnchor(
  anchor: ComponentTransformAnchor | null,
): anchor is ComponentSideResizeAnchor {
  return Boolean(
    anchor &&
      (HORIZONTAL_RESIZE_ANCHORS.has(anchor) ||
        VERTICAL_RESIZE_ANCHORS.has(anchor)),
  );
}

function isTopOrLeftSideResizeAnchor(anchor: ComponentSideResizeAnchor) {
  return anchor === "top-center" || anchor === "middle-left";
}

function hasTransformScale(node: Konva.Node) {
  return (
    Math.abs(node.scaleX() - 1) >= 0.001 ||
    Math.abs(node.scaleY() - 1) >= 0.001
  );
}

function componentTransformerForNode(node: Konva.Node) {
  const stage = node.getStage();
  if (!stage) return null;
  return stage
    .find<Konva.Transformer>("Transformer")
    .find((candidate) => candidate.getNodes().includes(node));
}

function componentTransformAnchorForNode(
  node: Konva.Node,
): ComponentTransformAnchor | null {
  const transformer = componentTransformerForNode(node);
  const activeAnchor =
    transformer?.getActiveAnchor() ??
    readString(node.getAttr(TRANSFORM_ANCHOR_ATTR));
  return isComponentTransformAnchor(activeAnchor) ? activeAnchor : null;
}

function isComponentTransformAnchor(
  value: string | null | undefined,
): value is ComponentTransformAnchor {
  return (
    value === "top-left" ||
    value === "top-center" ||
    value === "top-right" ||
    value === "middle-left" ||
    value === "middle-right" ||
    value === "bottom-left" ||
    value === "bottom-center" ||
    value === "bottom-right" ||
    value === "rotater"
  );
}

function componentResizeModeForTransform(
  anchor: ComponentTransformAnchor | null,
  scaleX: number,
  scaleY: number,
): ComponentResizeMode {
  if (anchor === "rotater") return "resize-frame";
  if (
    anchor &&
    (HORIZONTAL_RESIZE_ANCHORS.has(anchor) ||
      VERTICAL_RESIZE_ANCHORS.has(anchor))
  ) {
    return "resize-element-bounds";
  }
  if (anchor) return "scale-content";

  const changedX = Math.abs(scaleX - 1) > 0.001;
  const changedY = Math.abs(scaleY - 1) > 0.001;
  if (changedX && changedY) return "scale-content";
  if (changedX || changedY) return "resize-element-bounds";
  return "resize-frame";
}

function componentBoxFromTransform(
  box: Box,
  scaleX: number,
  scaleY: number,
  anchor: ComponentTransformAnchor | null,
): ComponentTransformBox {
  const isVerticalOnly = anchor ? VERTICAL_RESIZE_ANCHORS.has(anchor) : false;
  const isHorizontalOnly = anchor ? HORIZONTAL_RESIZE_ANCHORS.has(anchor) : false;
  const nextScaleX = isVerticalOnly || anchor === "rotater" ? 1 : scaleX;
  const nextScaleY = isHorizontalOnly || anchor === "rotater" ? 1 : scaleY;
  const rawWidth = Math.max(1, box.width * nextScaleX);
  const rawHeight = Math.max(1, box.height * nextScaleY);

  return {
    ...box,
    width: rawWidth,
    height: rawHeight,
    scaleX: box.width > 0 ? rawWidth / box.width : 1,
    scaleY: box.height > 0 ? rawHeight / box.height : 1,
    rawWidth,
    rawHeight,
  };
}

function positionFromComponentTransform(
  box: Box,
  node: Konva.Node,
  nextBox: ComponentTransformBox,
  anchor: ComponentTransformAnchor | null,
): Point {
  if (isComponentSideResizeAnchor(anchor)) {
    return {
      x: clamp(box.x, 0, Math.max(0, STAGE_BOX.width - nextBox.width)),
      y: clamp(box.y, 0, Math.max(0, STAGE_BOX.height - nextBox.height)),
    };
  }

  const rawPosition = positionFromNodeInParent(node, STAGE_BOX, {
    ...nextBox,
    width: nextBox.rawWidth,
    height: nextBox.rawHeight,
  });
  return {
    x: clamp(
      rawPosition.x,
      0,
      Math.max(0, STAGE_BOX.width - nextBox.width),
    ),
    y: clamp(
      rawPosition.y,
      0,
      Math.max(0, STAGE_BOX.height - nextBox.height),
    ),
  };
}

function componentFromNodeTransform(
  component: RawComponent,
  node: Konva.Group,
  anchor: ComponentTransformAnchor | null,
) {
  const box = componentBox(component);
  const scaleX = node.scaleX();
  const scaleY = node.scaleY();
  const nextBox = componentBoxFromTransform(box, scaleX, scaleY, anchor);
  const resizeMode = componentResizeModeForTransform(anchor, scaleX, scaleY);
  node.scaleX(1);
  node.scaleY(1);
  const position = positionFromComponentTransform(box, node, nextBox, anchor);
  const nextComponentBox = {
    ...position,
    width: nextBox.width,
    height: nextBox.height,
    rotation: node.rotation(),
  };

  if (resizeMode === "resize-frame") {
    return resizeComponentFrame(component, nextComponentBox);
  }
  if (resizeMode === "resize-element-bounds") {
    return resizeComponentElementBounds(component, {
      ...nextComponentBox,
      scaleX: nextBox.scaleX,
      scaleY: nextBox.scaleY,
    });
  }
  return resizeComponent(component, {
    ...nextComponentBox,
    scaleX: nextBox.scaleX,
    scaleY: nextBox.scaleY,
  });
}

function syncComponentNodeBox(node: Konva.Group, box: Box) {
  node.setAttrs({
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
    width: box.width,
    height: box.height,
    offsetX: box.width / 2,
    offsetY: box.height / 2,
    scaleX: 1,
    scaleY: 1,
  });
  componentTransformerForNode(node)?.forceUpdate();
  node.getLayer()?.batchDraw();
}

function componentSideTransformTargetFromNode(
  node: Konva.Group,
  anchor: ComponentSideResizeAnchor,
  sourceBox: Box,
) {
  const transformedWidth = Math.max(1, node.width() * node.scaleX());
  const transformedHeight = Math.max(1, node.height() * node.scaleY());
  const box = componentSideResizeBox(
    sourceBox,
    { width: transformedWidth, height: transformedHeight },
    anchor,
    STAGE_BOX,
  );

  // Stop Konva from stretching the rendered group while React rebuilds its
  // contents at the latest dimensions on the next animation frame.
  syncComponentNodeBox(node, box);
  return { anchor, box, rotation: node.rotation() };
}

function componentFromSideTransformPreview({
  source,
  sourceBox,
  target,
}: ComponentSideTransformPreview) {
  return resizeComponentFromSideTransform(
    source,
    sourceBox,
    { width: target.box.width, height: target.box.height },
    target.anchor,
    STAGE_BOX,
    target.rotation,
  ).component;
}

export function RawComponentNode({
  component,
  componentIndex,
  isEditMode,
  isMultiSelectedComponent,
  editingKey,
  vectorEditingKey,
  selectedTableCell,
  selectedKey,
  setNodeRef,
  onSelect,
  onTableCellSelect,
  onTableCellEdit,
  onOpenElementEditor,
  onComponentChange,
  onComponentDragStart,
  onComponentDragMove,
  onComponentDragEnd,
  onElementChange,
  onElementDragStart,
  onElementDragMove,
  onElementDragComplete,
  fontRevision,
}: {
  component: RawComponent;
  componentIndex: number;
  isEditMode: boolean;
  isMultiSelectedComponent: boolean;
  editingKey: string | null;
  vectorEditingKey: string | null;
  selectedTableCell: TableCellSelection | null;
  selectedKey: string | null;
  setNodeRef: (key: string, node: Konva.Node | null) => void;
  onSelect: (selection: Selection, options?: SelectOptions) => void;
  onTableCellSelect: (
    selection: ElementSelection,
    rowIndex: number,
    colIndex: number,
  ) => void;
  onTableCellEdit: (
    selection: ElementSelection,
    rowIndex: number,
    colIndex: number,
  ) => void;
  onOpenElementEditor: (selection: ElementSelection) => void;
  onComponentChange: (
    componentIndex: number,
    updater: (component: RawComponent) => RawComponent,
  ) => void;
  onComponentDragStart: (componentIndex: number, node: Konva.Node) => void;
  onComponentDragMove: (componentIndex: number, node: Konva.Node) => void;
  onComponentDragEnd: (componentIndex: number, node: Konva.Node) => void;
  onElementChange: (
    selection: ElementSelection,
    updater: (element: RawElement) => RawElement,
  ) => void;
  onElementDragStart: (
    selection: ElementSelection,
    node: Konva.Node,
  ) => void;
  onElementDragMove: (
    selection: ElementSelection,
    node: Konva.Node,
  ) => void;
  onElementDragComplete: (
    selection: ElementSelection,
    node: Konva.Node,
  ) => void;
  fontRevision: number;
}) {
  const groupRef = useRef<Konva.Group | null>(null);
  const transformSourceRef = useRef<RawComponent | null>(null);
  const transformSourceBoxRef = useRef<Box | null>(null);
  const transformPreviewRef = useRef<RawComponent | null>(null);
  const transformPreviewAnchorRef = useRef<ComponentTransformAnchor | null>(null);
  const latestSideTransformRef =
    useRef<ComponentSideTransformPreview | null>(null);
  const transformPreviewBatchRef =
    useRef<LatestFrameBatch<ComponentSideTransformPreview> | null>(null);
  const [transformPreview, setTransformPreview] =
    useState<RawComponent | null>(null);
  const renderTransformPreview = useCallback(
    (pending: ComponentSideTransformPreview) => {
      const next = componentFromSideTransformPreview(pending);
      transformPreviewRef.current = next;
      setTransformPreview(next);
    },
    [],
  );

  useEffect(() => {
    const batch = createLatestFrameBatch(
      (callback) => window.requestAnimationFrame(callback),
      (frame) => window.cancelAnimationFrame(frame),
      renderTransformPreview,
    );
    transformPreviewBatchRef.current = batch;

    return () => {
      batch.cancel();
      if (transformPreviewBatchRef.current === batch) {
        transformPreviewBatchRef.current = null;
      }
    };
  }, [renderTransformPreview]);

  const renderedComponent = transformPreview ?? component;
  const box = componentBox(renderedComponent);
  // React should update the children during the gesture without overwriting
  // the newer imperative frame position maintained by Konva.
  const frameBox = componentBox(component);
  const selection = useMemo<ComponentSelection>(
    () => ({ kind: "component", componentIndex }),
    [componentIndex],
  );
  const key = keyForSelection(selection);
  const setGroupNodeRef = useCallback(
    (node: Konva.Group | null) => {
      groupRef.current = node;
      if (node) constrainComponentTransformBounds(node);
      setNodeRef(key, node);
    },
    [key, setNodeRef],
  );
  const elements = readArray(renderedComponent.elements).filter(
    isRecord,
  ) as RawElement[];
  const isSingleVectorElementComponent =
    elements.length === 1 && isVectorType(readString(elements[0]?.type));
  const canNormalizeSingleVectorWrapper =
    isSingleVectorElementComponent &&
    (readNumber(component.rotation) ?? 0) === 0;
  const handleSingleElementComponentDragEnd = useCallback(
    (elementSelection: ElementSelection, delta: Point) => {
      if (
        elementSelection.componentIndex !== componentIndex ||
        elementSelection.elementPath.length !== 1 ||
        elementSelection.elementPath[0] !== 0 ||
        elements.length !== 1 ||
        (readNumber(component.rotation) ?? 0) !== 0
      ) {
        return false;
      }

      onComponentChange(componentIndex, (current) => {
        const position = readPoint(current.position);
        return {
          ...current,
          position: {
            x: position.x + delta.x,
            y: position.y + delta.y,
          },
        };
      });
      return true;
    },
    [component.rotation, componentIndex, elements, onComponentChange],
  );
  const handleMouseDown = useCallback(
    (event: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isEditMode) return;
      event.cancelBubble = true;
      if (isMultiSelectedComponent && !event.evt.shiftKey) return;
      onSelect(selection, { additive: event.evt.shiftKey });
    },
    [
      isEditMode,
      isMultiSelectedComponent,
      onSelect,
      selection,
    ],
  );
  const handleTouchStart = useCallback(
    (event: Konva.KonvaEventObject<TouchEvent>) => {
      if (!isEditMode) return;
      event.cancelBubble = true;
      if (isMultiSelectedComponent) return;
      onSelect(selection);
    },
    [
      isEditMode,
      isMultiSelectedComponent,
      onSelect,
      selection,
    ],
  );
  const handleDragStart = useCallback(
    (event: Konva.KonvaEventObject<DragEvent>) => {
      if (!isEditMode) return;
      event.cancelBubble = true;
      const node = groupRef.current;
      if (!node) return;
      if (!isMultiSelectedComponent && !event.evt.shiftKey) {
        onSelect(selection);
      }
      onComponentDragStart(componentIndex, node);
    },
    [
      componentIndex,
      isEditMode,
      isMultiSelectedComponent,
      onComponentDragStart,
      onSelect,
      selection,
    ],
  );
  const handleDragMove = useCallback(
    (event: Konva.KonvaEventObject<DragEvent>) => {
      event.cancelBubble = true;
      const node = groupRef.current;
      if (!node) return;
      onComponentDragMove(componentIndex, node);
    },
    [componentIndex, onComponentDragMove],
  );
  const handleDragEnd = useCallback(
    (event: Konva.KonvaEventObject<DragEvent>) => {
      if (!isEditMode) return;
      event.cancelBubble = true;
      const node = groupRef.current;
      if (!node) return;
      onComponentDragEnd(componentIndex, node);
    },
    [componentIndex, isEditMode, onComponentDragEnd],
  );
  const handleTransformStart = useCallback(() => {
    transformPreviewBatchRef.current?.cancel();
    transformSourceRef.current = component;
    transformSourceBoxRef.current = componentBox(component);
    transformPreviewRef.current = null;
    transformPreviewAnchorRef.current = null;
    latestSideTransformRef.current = null;
    setTransformPreview(null);
  }, [component]);
  const handleTransform = useCallback(
    (event: Konva.KonvaEventObject<Event>) => {
      if (!isEditMode) return;
      event.cancelBubble = true;
      const node = groupRef.current;
      if (!node) return;
      const anchor = componentTransformAnchorForNode(node);
      if (!isComponentSideResizeAnchor(anchor)) return;
      if (!hasTransformScale(node)) return;
      const source = transformSourceRef.current ?? component;
      const sourceBox = transformSourceBoxRef.current ?? componentBox(source);
      const pending = {
        source,
        sourceBox,
        target: componentSideTransformTargetFromNode(node, anchor, sourceBox),
      } satisfies ComponentSideTransformPreview;
      latestSideTransformRef.current = pending;
      transformPreviewAnchorRef.current = anchor;

      if (isTopOrLeftSideResizeAnchor(anchor)) {
        transformPreviewBatchRef.current?.cancel();
        flushSync(() => renderTransformPreview(pending));
        return;
      }

      const batch = transformPreviewBatchRef.current;
      if (batch) {
        batch.schedule(pending);
      } else {
        renderTransformPreview(pending);
      }
    },
    [component, isEditMode, renderTransformPreview],
  );
  const handleTransformEnd = useCallback(
    (event: Konva.KonvaEventObject<Event>) => {
      if (!isEditMode) return;
      event.cancelBubble = true;
      const node = groupRef.current;
      if (!node) return;
      transformPreviewBatchRef.current?.cancel();
      const anchor = componentTransformAnchorForNode(node);
      const previewAnchor = transformPreviewAnchorRef.current;
      const sideAnchor = isComponentSideResizeAnchor(anchor)
        ? anchor
        : previewAnchor;
      let next: RawComponent;
      if (isComponentSideResizeAnchor(sideAnchor)) {
        const source = transformSourceRef.current ?? component;
        const sourceBox = transformSourceBoxRef.current ?? componentBox(source);
        let finalPreview = latestSideTransformRef.current;
        if (hasTransformScale(node)) {
          finalPreview = {
            source,
            sourceBox,
            target: componentSideTransformTargetFromNode(
              node,
              sideAnchor,
              sourceBox,
            ),
          };
        }
        next = finalPreview
          ? componentFromSideTransformPreview(finalPreview)
          : transformPreviewRef.current ?? source;
      } else {
        next = componentFromNodeTransform(component, node, anchor);
      }
      transformSourceRef.current = null;
      transformSourceBoxRef.current = null;
      transformPreviewRef.current = null;
      transformPreviewAnchorRef.current = null;
      latestSideTransformRef.current = null;
      node.setAttr(TRANSFORM_ANCHOR_ATTR, null);
      flushSync(() => {
        setTransformPreview(null);
        onComponentChange(componentIndex, () => next);
      });
    },
    [component, componentIndex, isEditMode, onComponentChange],
  );

  return (
    <Group
      ref={setGroupNodeRef}
      x={frameBox.x + frameBox.width / 2}
      y={frameBox.y + frameBox.height / 2}
      width={frameBox.width}
      height={frameBox.height}
      offsetX={frameBox.width / 2}
      offsetY={frameBox.height / 2}
      rotation={readNumber(component.rotation) ?? 0}
      draggable={isEditMode}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onTransformStart={handleTransformStart}
      onTransform={handleTransform}
      onTransformEnd={handleTransformEnd}
    >
      {isEditMode ? <SelectionBoundsRect width={box.width} height={box.height} /> : null}
      {elements.map((element, elementIndex) => (
        <MemoizedRawElementNode
          key={rawElementKey(element, elementIndex)}
          element={element}
          componentIndex={componentIndex}
          elementPath={[elementIndex]}
          isEditMode={isEditMode}
          editingKey={editingKey}
          vectorEditingKey={vectorEditingKey}
          selectedTableCell={selectedTableCell}
          selectedKey={selectedKey}
          setNodeRef={setNodeRef}
          onSelect={onSelect}
          onTableCellSelect={onTableCellSelect}
          onTableCellEdit={onTableCellEdit}
          onOpenEditor={onOpenElementEditor}
          onElementChange={onElementChange}
          onElementDragEnd={handleSingleElementComponentDragEnd}
          onElementDragStart={onElementDragStart}
          onElementDragMove={onElementDragMove}
          onElementDragComplete={onElementDragComplete}
          parentBox={box}
          textConstraintBox={{
            x: 0,
            y: 0,
            width: box.width,
            height: box.height,
          }}
          layoutManaged={false}
          allowVectorResizeBeyondParent={
            canNormalizeSingleVectorWrapper && elementIndex === 0
          }
          allowVectorPointEditing={
            isSingleVectorElementComponent && elementIndex === 0
          }
          allowDirectVectorSelection={
            !isMultiSelectedComponent &&
            isSingleVectorElementComponent &&
            elementIndex === 0
          }
          fontRevision={fontRevision}
        />
      ))}
    </Group>
  );
}

function constrainedWrappedTextVisualBox(
  element: RawElement,
  box: Box,
  parentBox: Box,
): Box {
  const type = readString(element.type);
  if (type !== "text" && type !== "text-list") return box;

  const availableWidth = Math.max(1, parentBox.width - box.x);
  const width = Math.min(box.width, availableWidth);
  if (Math.abs(width - box.width) < 0.01) return box;

  const constrainedBox = { ...box, width };
  return type === "text-list"
    ? textListVisualLocalBox(element, constrainedBox)
    : textVisualLocalBox(element, constrainedBox);
}

export const MemoizedRawComponentNode = memo(
  RawComponentNode,
  (previous, next) => {
    if (
      previous.component !== next.component ||
      previous.componentIndex !== next.componentIndex ||
      previous.isEditMode !== next.isEditMode ||
      previous.isMultiSelectedComponent !== next.isMultiSelectedComponent ||
      previous.vectorEditingKey !== next.vectorEditingKey ||
      previous.setNodeRef !== next.setNodeRef ||
      previous.onSelect !== next.onSelect ||
      previous.onTableCellSelect !== next.onTableCellSelect ||
      previous.onTableCellEdit !== next.onTableCellEdit ||
      previous.onOpenElementEditor !== next.onOpenElementEditor ||
      previous.onComponentChange !== next.onComponentChange ||
      previous.onComponentDragStart !== next.onComponentDragStart ||
      previous.onComponentDragMove !== next.onComponentDragMove ||
      previous.onComponentDragEnd !== next.onComponentDragEnd ||
      previous.onElementChange !== next.onElementChange ||
      previous.onElementDragStart !== next.onElementDragStart ||
      previous.onElementDragMove !== next.onElementDragMove ||
      previous.onElementDragComplete !== next.onElementDragComplete ||
      previous.selectedTableCell !== next.selectedTableCell ||
      previous.selectedKey !== next.selectedKey ||
      previous.fontRevision !== next.fontRevision
    ) {
      return false;
    }
    return !(
      previous.editingKey !== next.editingKey &&
      (selectionTouchesComponent(
        previous.editingKey,
        previous.componentIndex,
      ) ||
        selectionTouchesComponent(next.editingKey, next.componentIndex))
    );
  },
);

function RawElementNode({
  element,
  componentIndex,
  elementPath,
  isEditMode,
  editingKey,
  vectorEditingKey,
  selectedTableCell,
  selectedKey,
  setNodeRef,
  onSelect,
  onTableCellSelect,
  onTableCellEdit,
  onOpenEditor,
  onElementChange,
  onElementDragEnd,
  onElementDragStart,
  onElementDragMove,
  onElementDragComplete,
  parentBox,
  textConstraintBox,
  renderBox,
  layoutManaged = false,
  allowVectorResizeBeyondParent = false,
  allowVectorPointEditing = true,
  allowDirectVectorSelection = true,
  fontRevision,
}: {
  element: RawElement;
  componentIndex: number;
  elementPath: number[];
  isEditMode: boolean;
  editingKey: string | null;
  vectorEditingKey: string | null;
  selectedTableCell: TableCellSelection | null;
  selectedKey: string | null;
  setNodeRef: (key: string, node: Konva.Node | null) => void;
  onSelect: (selection: Selection, options?: SelectOptions) => void;
  onTableCellSelect: (
    selection: ElementSelection,
    rowIndex: number,
    colIndex: number,
  ) => void;
  onTableCellEdit: (
    selection: ElementSelection,
    rowIndex: number,
    colIndex: number,
  ) => void;
  onOpenEditor: (selection: ElementSelection) => void;
  onElementChange: (
    selection: ElementSelection,
    updater: (element: RawElement) => RawElement,
  ) => void;
  onElementDragEnd?: (selection: ElementSelection, delta: Point) => boolean;
  onElementDragStart?: (
    selection: ElementSelection,
    node: Konva.Node,
  ) => void;
  onElementDragMove?: (
    selection: ElementSelection,
    node: Konva.Node,
  ) => void;
  onElementDragComplete?: (
    selection: ElementSelection,
    node: Konva.Node,
  ) => void;
  parentBox: Box;
  textConstraintBox?: Box | null;
  renderBox?: Box | null;
  layoutManaged?: boolean;
  allowVectorResizeBeyondParent?: boolean;
  allowVectorPointEditing?: boolean;
  allowDirectVectorSelection?: boolean;
  fontRevision: number;
}) {
  const groupRef = useRef<Konva.Group | null>(null);
  const transformSourceBoxRef = useRef<Box | null>(null);
  const transformAnchorRef = useRef<ComponentTransformAnchor | null>(null);
  const box = renderBox ?? elementBox(element);
  const boxX = box.x;
  const boxY = box.y;
  const boxWidth = box.width;
  const boxHeight = box.height;
  const selection = useMemo<ElementSelection>(
    () => ({
      kind: "element",
      componentIndex,
      elementPath,
    }),
    [componentIndex, elementPath],
  );
  const key = keyForSelection(selection);
  const isSelected = selectedKey === key;
  const selectedCell =
    selectedTableCell?.elementPath === key ? selectedTableCell : null;
  const editing = editingKey === key;
  const type = readString(element.type);
  const isVector = isVectorType(type);
  const vectorPointEditing = vectorEditingKey === key;
  const [vectorDragPreview, setVectorDragPreview] =
    useState<RawElement | null>(null);
  const renderedElement = vectorDragPreview ?? element;
  const childInfo = childArrayInfo(element);
  const children = childInfo?.items ?? [];
  const laidOutChildren = layoutChildren(element, children, box);
  const clipChildren = shouldClipElementChildren(element, childInfo);
  const shouldConstrainTextVisual =
    componentIndex !== ROOT_ELEMENTS_COMPONENT_INDEX || elementPath.length > 1;
  const visualBox = shouldConstrainTextVisual
    ? constrainedWrappedTextVisualBox(element, box, textConstraintBox ?? parentBox)
    : box;
  const childTextConstraintBox = childInfo
    ? textConstraintBox
      ? {
          ...textConstraintBox,
          x: textConstraintBox.x + box.x,
          y: textConstraintBox.y + box.y,
        }
      : {
          x: 0,
          y: 0,
          width: box.width,
          height: box.height,
        }
    : null;
  const centerOrigin = shouldUseCenterOrigin(element);
  const showVectorPointHandles =
    isEditMode &&
    isSelected &&
    isVector &&
    allowVectorPointEditing &&
    !editing &&
    vectorPointEditing;
  const vectorDraggable =
    isEditMode && isSelected && isVector && !editing && !showVectorPointHandles;
  useEffect(() => {
    if (!isSelected || !isVector) setVectorDragPreview(null);
  }, [isSelected, isVector]);
  const handleTableCellSelect = useCallback(
    (rowIndex: number, colIndex: number) => {
      onTableCellSelect(selection, rowIndex, colIndex);
    },
    [onTableCellSelect, selection],
  );
  const handleTableCellEdit = useCallback(
    (rowIndex: number, colIndex: number) => {
      onTableCellEdit(selection, rowIndex, colIndex);
    },
    [onTableCellEdit, selection],
  );
  const handleVectorDragStart = useCallback(
    (event: Konva.KonvaEventObject<DragEvent>) => {
      if (!vectorDraggable) return;
      event.cancelBubble = true;
      onSelect(selection);
      const node = groupRef.current;
      if (node) onElementDragStart?.(selection, node);
    },
    [onElementDragStart, onSelect, selection, vectorDraggable],
  );
  const handleVectorDragMove = useCallback(
    (event: Konva.KonvaEventObject<DragEvent>) => {
      if (!vectorDraggable) return;
      event.cancelBubble = true;
      const node = groupRef.current;
      if (node) onElementDragMove?.(selection, node);
    },
    [onElementDragMove, selection, vectorDraggable],
  );
  const handleVectorDragEnd = useCallback(
    (event: Konva.KonvaEventObject<DragEvent>) => {
      if (!vectorDraggable) return;
      event.cancelBubble = true;
      const node = groupRef.current;
      if (!node) return;
      onElementDragComplete?.(selection, node);
      const nextPosition = {
        x: node.x() - (centerOrigin ? boxWidth / 2 : 0),
        y: node.y() - (centerOrigin ? boxHeight / 2 : 0),
      };
      const delta = {
        x: nextPosition.x - boxX,
        y: nextPosition.y - boxY,
      };
      if (Math.abs(delta.x) < 0.01 && Math.abs(delta.y) < 0.01) return;
      if (onElementDragEnd?.(selection, delta)) {
        node.position({
          x: centerOrigin ? boxX + boxWidth / 2 : boxX,
          y: centerOrigin ? boxY + boxHeight / 2 : boxY,
        });
        return;
      }
      node.position({
        x: centerOrigin ? nextPosition.x + boxWidth / 2 : nextPosition.x,
        y: centerOrigin ? nextPosition.y + boxHeight / 2 : nextPosition.y,
      });
      onElementChange(selection, (current) => ({
        ...translateVectorElement(current, delta),
        ...(layoutManaged || isManualPositioned(current)
          ? { __gslide_manual_position: true }
          : {}),
      }));
    },
    [
      boxHeight,
      boxWidth,
      boxX,
      boxY,
      centerOrigin,
      layoutManaged,
      onElementChange,
      onElementDragComplete,
      onElementDragEnd,
      selection,
      vectorDraggable,
    ],
  );
  const previewVectorVertex = useCallback(
    (index: number, point: Point) => {
      setVectorDragPreview((current) =>
        updateVectorVertexPoint(current ?? element, index, point),
      );
    },
    [element],
  );
  const commitVectorVertex = useCallback(
    (index: number, point: Point) => {
      setVectorDragPreview(null);
      onElementChange(selection, (current) => ({
        ...updateVectorVertexPoint(current, index, point),
        ...(layoutManaged || isManualPositioned(current)
          ? { __gslide_manual_position: true }
          : {}),
      }));
    },
    [layoutManaged, onElementChange, selection],
  );
  const commitVectorPointInsert = useCallback(
    (afterIndex: number, point: Point) => {
      setVectorDragPreview(null);
      onElementChange(selection, (current) => ({
        ...insertVectorPointInElement(current, afterIndex, point),
        ...(layoutManaged || isManualPositioned(current)
          ? { __gslide_manual_position: true }
          : {}),
      }));
    },
    [layoutManaged, onElementChange, selection],
  );
  const commitVectorPointRemove = useCallback(
    (index: number) => {
      setVectorDragPreview(null);
      onElementChange(selection, (current) => ({
        ...removeVectorPointFromElement(current, index),
        ...(layoutManaged || isManualPositioned(current)
          ? { __gslide_manual_position: true }
          : {}),
      }));
    },
    [layoutManaged, onElementChange, selection],
  );
  const handleTransformStart = useCallback(
    (event: Konva.KonvaEventObject<Event>) => {
      if (!isEditMode) return;
      event.cancelBubble = true;
      transformSourceBoxRef.current = {
        x: boxX,
        y: boxY,
        width: boxWidth,
        height: boxHeight,
      };
      transformAnchorRef.current = null;
      const node = groupRef.current;
      if (node) {
        transformAnchorRef.current = componentTransformAnchorForNode(node);
      }
    },
    [boxHeight, boxWidth, boxX, boxY, isEditMode],
  );
  const handleTransform = useCallback(
    (event: Konva.KonvaEventObject<Event>) => {
      if (!isEditMode) return;
      event.cancelBubble = true;
      const node = groupRef.current;
      if (!node) return;
      const anchor = componentTransformAnchorForNode(node);
      if (anchor) transformAnchorRef.current = anchor;
    },
    [isEditMode],
  );
  const handleTransformEnd = useCallback(
    (event: Konva.KonvaEventObject<Event>) => {
      if (!isEditMode) return;
      event.cancelBubble = true;
      const node = groupRef.current;
      if (!node) {
        transformSourceBoxRef.current = null;
        transformAnchorRef.current = null;
        return;
      }
      const anchor =
        componentTransformAnchorForNode(node) ?? transformAnchorRef.current;
      const sourceBox = transformSourceBoxRef.current ?? {
        x: boxX,
        y: boxY,
        width: boxWidth,
        height: boxHeight,
      };
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      const nextSize = {
        width: Math.max(1, sourceBox.width * scaleX),
        height: Math.max(1, sourceBox.height * scaleY),
      };
      const canOverflowParent =
        isVector &&
        allowVectorResizeBeyondParent &&
        (anchor?.includes("left") || anchor?.includes("top"));
      node.scaleX(1);
      node.scaleY(1);
      const fontScale = fontScaleFromResize(scaleX, scaleY);
      const measuredPosition = canOverflowParent
        ? unclampedPositionFromNodeInParent(node, parentBox, {
            ...sourceBox,
            ...nextSize,
          })
        : positionFromNodeInParent(node, parentBox, {
            ...sourceBox,
            ...nextSize,
          });
      const nextPosition = isVector
        ? canOverflowParent
          ? anchoredFramePositionForResizeUnclamped(
              sourceBox,
              nextSize,
              anchor,
              measuredPosition,
            )
          : anchoredFramePositionForResize(
              sourceBox,
              nextSize,
              anchor,
              measuredPosition,
              parentBox,
            )
        : measuredPosition;
      node.position({
        x: centerOrigin ? nextPosition.x + nextSize.width / 2 : nextPosition.x,
        y: centerOrigin ? nextPosition.y + nextSize.height / 2 : nextPosition.y,
      });
      transformSourceBoxRef.current = null;
      transformAnchorRef.current = null;
      node.setAttr(TRANSFORM_ANCHOR_ATTR, null);
      onElementChange(selection, (current) => {
        const scaled = scaleRawElementTextMetrics(current, fontScale);
        const type = readString(current.type);
        const geometry =
          isVectorType(type)
            ? polygonElementFromFrame(scaled, nextPosition, scaleX, scaleY)
            : {
                ...scaled,
                position: nextPosition,
                size: nextSize,
              };
        return {
          ...geometry,
          rotation: node.rotation(),
          ...(layoutManaged || isManualPositioned(current)
            ? { __gslide_manual_position: true }
            : {}),
        };
      });
    },
    [
      allowVectorResizeBeyondParent,
      boxHeight,
      boxWidth,
      boxX,
      boxY,
      centerOrigin,
      isEditMode,
      isVector,
      layoutManaged,
      onElementChange,
      parentBox,
      selection,
    ],
  );

  return (
    <Group
      ref={(node) => {
        groupRef.current = node;
        setNodeRef(key, node);
      }}
      x={centerOrigin ? box.x + box.width / 2 : box.x}
      y={centerOrigin ? box.y + box.height / 2 : box.y}
      width={box.width}
      height={box.height}
      offsetX={centerOrigin ? box.width / 2 : 0}
      offsetY={centerOrigin ? box.height / 2 : 0}
      clipX={clipChildren ? 0 : undefined}
      clipY={clipChildren ? 0 : undefined}
      clipWidth={clipChildren ? box.width : undefined}
      clipHeight={clipChildren ? box.height : undefined}
      rotation={readNumber(element.rotation) ?? 0}
      opacity={readNumber(element.opacity) ?? 1}
      draggable={vectorDraggable}
      onMouseDown={(event) => {
        if (!isEditMode) return;
        if (isVector) {
          if (!allowDirectVectorSelection) {
            event.cancelBubble = false;
            return;
          }
          if (
            event.evt.shiftKey &&
            componentIndex !== ROOT_ELEMENTS_COMPONENT_INDEX
          ) {
            event.cancelBubble = false;
            return;
          }
          event.cancelBubble = true;
          onSelect(selection);
          return;
        }
        if (vectorDraggable) {
          event.cancelBubble = true;
          onSelect(selection);
          return;
        }
        event.cancelBubble = false;
      }}
      onTouchStart={(event) => {
        if (!isEditMode) return;
        if (isVector) {
          if (!allowDirectVectorSelection) {
            event.cancelBubble = false;
            return;
          }
          event.cancelBubble = true;
          onSelect(selection);
          return;
        }
        if (vectorDraggable) {
          event.cancelBubble = true;
          onSelect(selection);
          return;
        }
        event.cancelBubble = false;
      }}
      onClick={(event) => {
        if (!isEditMode) return;
        if (componentIndex === ROOT_ELEMENTS_COMPONENT_INDEX) {
          event.cancelBubble = true;
          onSelect(selection);
        }
      }}
      onTap={(event) => {
        if (!isEditMode) return;
        if (componentIndex === ROOT_ELEMENTS_COMPONENT_INDEX) {
          event.cancelBubble = true;
          onSelect(selection);
        }
      }}
      onDblClick={(event) => {
        if (!isEditMode) return;
        event.cancelBubble = true;
        onSelect(selection);
        onOpenEditor(selection);
      }}
      onDblTap={(event) => {
        if (!isEditMode) return;
        event.cancelBubble = true;
        onSelect(selection);
        onOpenEditor(selection);
      }}
      onDragStart={handleVectorDragStart}
      onDragMove={handleVectorDragMove}
      onDragEnd={handleVectorDragEnd}
      onTransformStart={handleTransformStart}
      onTransform={handleTransform}
      onTransformEnd={handleTransformEnd}
    >
      {isEditMode ? (
        <SelectionBoundsRect width={box.width} height={box.height} />
      ) : null}
      {editing ? null : (
        <MemoizedRawElementVisual
          element={renderedElement}
          width={visualBox.width}
          height={visualBox.height}
          interactive={isEditMode}
          vectorOriginBox={isVector ? box : null}
          selectedTableCell={selectedCell}
          onTableCellSelect={handleTableCellSelect}
          onTableCellEdit={handleTableCellEdit}
          fontRevision={fontRevision}
        />
      )}
      {showVectorPointHandles ? (
        <VectorVertexHandles
          element={renderedElement}
          originBox={box}
          onCommit={commitVectorVertex}
          onInsert={commitVectorPointInsert}
          onPreview={previewVectorVertex}
          onRemove={commitVectorPointRemove}
          onSelect={() => onSelect(selection)}
        />
      ) : null}
      {laidOutChildren.map(({ child, index, box: childBox, layoutManaged }) => (
        <MemoizedRawElementNode
          key={rawElementKey(child, index)}
          element={child}
          componentIndex={componentIndex}
          elementPath={[...elementPath, index]}
          isEditMode={isEditMode}
          editingKey={editingKey}
          vectorEditingKey={vectorEditingKey}
          selectedTableCell={selectedTableCell}
          selectedKey={selectedKey}
          setNodeRef={setNodeRef}
          onSelect={onSelect}
          onTableCellSelect={onTableCellSelect}
          onTableCellEdit={onTableCellEdit}
          onOpenEditor={onOpenEditor}
          onElementChange={onElementChange}
          onElementDragEnd={onElementDragEnd}
          onElementDragStart={onElementDragStart}
          onElementDragMove={onElementDragMove}
          onElementDragComplete={onElementDragComplete}
          allowVectorResizeBeyondParent={false}
          allowVectorPointEditing={allowVectorPointEditing}
          allowDirectVectorSelection={allowDirectVectorSelection}
          parentBox={{
            x: parentBox.x + box.x,
            y: parentBox.y + box.y,
            width: box.width,
            height: box.height,
          }}
          textConstraintBox={childTextConstraintBox}
          renderBox={childBox}
          layoutManaged={layoutManaged}
          fontRevision={fontRevision}
        />
      ))}
    </Group>
  );
}

export const MemoizedRawElementNode = memo(RawElementNode, (previous, next) => {
  if (
    previous.element !== next.element ||
    previous.componentIndex !== next.componentIndex ||
    previous.isEditMode !== next.isEditMode ||
    previous.layoutManaged !== next.layoutManaged ||
    previous.allowVectorResizeBeyondParent !==
      next.allowVectorResizeBeyondParent ||
    previous.allowVectorPointEditing !== next.allowVectorPointEditing ||
    previous.allowDirectVectorSelection !== next.allowDirectVectorSelection ||
    previous.fontRevision !== next.fontRevision ||
    previous.vectorEditingKey !== next.vectorEditingKey ||
    previous.selectedTableCell !== next.selectedTableCell ||
    previous.selectedKey !== next.selectedKey ||
    previous.setNodeRef !== next.setNodeRef ||
    previous.onSelect !== next.onSelect ||
    previous.onTableCellSelect !== next.onTableCellSelect ||
    previous.onTableCellEdit !== next.onTableCellEdit ||
    previous.onOpenEditor !== next.onOpenEditor ||
    previous.onElementChange !== next.onElementChange ||
    previous.onElementDragEnd !== next.onElementDragEnd ||
    previous.onElementDragStart !== next.onElementDragStart ||
    previous.onElementDragMove !== next.onElementDragMove ||
    previous.onElementDragComplete !== next.onElementDragComplete ||
    !numberPathEqual(previous.elementPath, next.elementPath) ||
    !boxEqual(previous.parentBox, next.parentBox) ||
    !nullableBoxEqual(previous.textConstraintBox, next.textConstraintBox) ||
    !nullableBoxEqual(previous.renderBox, next.renderBox)
  ) {
    return false;
  }
  return !(
    previous.editingKey !== next.editingKey &&
    (selectionTouchesElement(
      previous.editingKey,
      previous.componentIndex,
      previous.elementPath,
    ) ||
      selectionTouchesElement(
        next.editingKey,
        next.componentIndex,
        next.elementPath,
      ))
  );
});

function SelectionBoundsRect({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  return (
    <Rect
      width={width}
      height={height}
      fill="rgba(0,0,0,0)"
      listening={false}
      perfectDrawEnabled={false}
      shadowForStrokeEnabled={false}
    />
  );
}

function RawElementVisual({
  element,
  width,
  height,
  interactive,
  vectorOriginBox,
  selectedTableCell,
  onTableCellSelect,
  onTableCellEdit,
  fontRevision,
}: {
  element: RawElement;
  width: number;
  height: number;
  interactive: boolean;
  vectorOriginBox?: Box | null;
  selectedTableCell: TableCellSelection | null;
  onTableCellSelect: (rowIndex: number, colIndex: number) => void;
  onTableCellEdit: (rowIndex: number, colIndex: number) => void;
  fontRevision: number;
}) {
  void fontRevision;
  const type = readString(element.type);
  if (isBoxVisualType(type)) {
    const fill = colorWithOpacity(
      fillColor(element.fill),
      fillOpacity(element.fill),
    );
    const stroke = colorWithOpacity(
      strokeColor(element.stroke),
      strokeOpacity(element.stroke),
    );
    if (!fill && !(stroke && strokeWidth(element.stroke) > 0)) return null;
    return (
      <Rect
        width={width}
        height={height}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth(element.stroke)}
        cornerRadius={borderRadius(element)}
        {...shadowProps(element)}
        listening={interactive}
      />
    );
  }
  if (isVectorType(type)) {
    return (
      <RawVectorElement
        element={element}
        width={width}
        height={height}
        interactive={interactive}
        vectorOriginBox={vectorOriginBox}
      />
    );
  }
  if (type === "text") {
    return (
      <RawRichTextElement
        element={element}
        width={width}
        height={height}
        interactive={interactive}
      />
    );
  }
  if (type === "text-list") {
    return (
      <RawTextListElement
        element={element}
        width={width}
        height={height}
        interactive={interactive}
      />
    );
  }
  if (type === "image") {
    return <RawImageElement element={element} width={width} height={height} interactive={interactive} />;
  }
  if (type === "table") {
    return (
      <RawTableElement
        element={element}
        width={width}
        height={height}
        interactive={interactive}
        selectedCell={selectedTableCell}
        onCellSelect={onTableCellSelect}
        onCellEdit={onTableCellEdit}
      />
    );
  }
  if (type === "chart") {
    const legendState = Object.prototype.hasOwnProperty.call(element, "legend")
      ? String(element.legend)
      : String(element.showLegend ?? "auto");
    return (
      <RawChartElement
        key={`chart-legend-${legendState}`}
        element={element}
        width={width}
        height={height}
        interactive={interactive}
      />
    );
  }
  if (type === "infographic") {
    return <RawInfographicElement element={element} width={width} height={height} interactive={interactive} />;
  }
  return null;
}

const MemoizedRawElementVisual = memo(
  RawElementVisual,
  (previous, next) =>
    previous.element === next.element &&
    previous.width === next.width &&
    previous.height === next.height &&
    previous.interactive === next.interactive &&
    nullableBoxEqual(previous.vectorOriginBox, next.vectorOriginBox) &&
    previous.selectedTableCell === next.selectedTableCell &&
    previous.onTableCellSelect === next.onTableCellSelect &&
    previous.onTableCellEdit === next.onTableCellEdit &&
    previous.fontRevision === next.fontRevision,
);
