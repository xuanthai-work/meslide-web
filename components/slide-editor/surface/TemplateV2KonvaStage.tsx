"use client";

import type { MutableRefObject, RefObject } from "react";
import type Konva from "konva";
import { Layer, Line, Rect, Stage } from "react-konva";
import {
  MemoizedRawComponentNode,
  MemoizedRawElementNode,
} from "@/components/slide-editor/surface/nodes";
import { TemplateV2SelectionTransformers } from "@/components/slide-editor/selection/SelectionTransformers";
import type { TableCellSelection } from "@/components/slide-editor/state/state";
import {
  ROOT_ELEMENTS_COMPONENT_INDEX,
  STAGE_BOX,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  backgroundColor,
  componentKey,
  rawElementKey,
  readString,
  type ElementSelection,
  type RawComponent,
  type RawElement,
  type RawUi,
  type SelectOptions,
  type Selection,
} from "@/components/slide-editor/model/model";
import type { HtmlSelectionRect } from "@/app/(presentation-generator)/components/HtmlSelectionOverlay";
import {
  ALIGNMENT_GUIDE_COLOR,
  ALIGNMENT_GUIDE_DASH_PX,
  ALIGNMENT_GUIDE_HALO_COLOR,
  ALIGNMENT_GUIDE_HALO_WIDTH_PX,
  ALIGNMENT_GUIDE_STROKE_WIDTH_PX,
} from "@/components/slide-editor/surface/alignmentGuideRender";

export type TemplateV2KonvaStageProps = {
  isEditMode: boolean;
  uiDraft: RawUi;
  rootElements: RawElement[];
  components: RawComponent[];
  editingKey: string | null;
  vectorEditingKey: string | null;
  visibleSelectedTableCell: TableCellSelection | null;
  selectedKey: string | null;
  selectedKeys: string[];
  selectedComponentIndexes: number[];
  selectedComponentIndexSet: Set<number>;
  selectionKind: "component" | "multi-component" | "element" | null;
  selectedTableCell: TableCellSelection | null;
  inlineEdit: unknown;
  imageCropActive: boolean;
  selectedElement: RawElement | null;
  selectedIsImageElement: boolean;
  selectedIsVectorElement: boolean;
  selectedCanEditVectorPoints: boolean;
  selectedIsVectorPointEditing: boolean;
  transformerParentComponentKey: string | null;
  horizontalResizeOnly: boolean;
  fontRevision: number;
  effectiveDisplayScale: number;
  selectorEnabled: boolean;
  rootElement: HTMLDivElement | null;
  nodeRefs: RefObject<Map<string, Konva.Node>>;
  backgroundLayerRef: RefObject<Konva.Layer | null>;
  contentLayerRef: RefObject<Konva.Layer | null>;
  alignmentGuideLayerRef: RefObject<Konva.Layer | null>;
  verticalAlignmentGuideRef: RefObject<Konva.Line | null>;
  horizontalAlignmentGuideRef: RefObject<Konva.Line | null>;
  verticalAlignmentGuideHaloRef: RefObject<Konva.Line | null>;
  horizontalAlignmentGuideHaloRef: RefObject<Konva.Line | null>;
  hoveredKonvaNodeRef: MutableRefObject<Konva.Node | null>;
  setSelectionNodeRef: (key: string, node: Konva.Node | null) => void;
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
  onComponentChange: (
    componentIndex: number,
    updater: (component: RawComponent) => RawComponent,
  ) => void;
  onElementDragStart: (selection: ElementSelection, node: Konva.Node) => void;
  onElementDragMove: (selection: ElementSelection, node: Konva.Node) => void;
  onElementDragComplete: (selection: ElementSelection, node: Konva.Node) => void;
  onComponentDragStart: (componentIndex: number, node: Konva.Node) => void;
  onComponentDragMove: (componentIndex: number, node: Konva.Node) => void;
  onComponentDragEnd: (componentIndex: number, node: Konva.Node) => void;
  onActivateSurface: (selection?: Selection) => void;
  onClearEditorUiState: () => void;
  onHoverSelectionRectChange: (rect: HtmlSelectionRect | null) => void;
};

export function TemplateV2KonvaStage({
  isEditMode,
  uiDraft,
  rootElements,
  components,
  editingKey,
  vectorEditingKey,
  visibleSelectedTableCell,
  selectedKey,
  selectedKeys,
  selectedComponentIndexes,
  selectedComponentIndexSet,
  selectionKind,
  selectedTableCell,
  inlineEdit,
  imageCropActive,
  selectedElement,
  selectedIsImageElement,
  selectedIsVectorElement,
  selectedCanEditVectorPoints,
  selectedIsVectorPointEditing,
  transformerParentComponentKey,
  horizontalResizeOnly,
  fontRevision,
  effectiveDisplayScale,
  selectorEnabled,
  rootElement,
  nodeRefs,
  backgroundLayerRef,
  contentLayerRef,
  alignmentGuideLayerRef,
  verticalAlignmentGuideRef,
  horizontalAlignmentGuideRef,
  verticalAlignmentGuideHaloRef,
  horizontalAlignmentGuideHaloRef,
  hoveredKonvaNodeRef,
  setSelectionNodeRef,
  onSelect,
  onTableCellSelect,
  onTableCellEdit,
  onOpenEditor,
  onElementChange,
  onComponentChange,
  onElementDragStart,
  onElementDragMove,
  onElementDragComplete,
  onComponentDragStart,
  onComponentDragMove,
  onComponentDragEnd,
  onActivateSurface,
  onClearEditorUiState,
  onHoverSelectionRectChange,
}: TemplateV2KonvaStageProps) {
  return (
    <Stage
      width={STAGE_WIDTH}
      height={STAGE_HEIGHT}
      onMouseDown={(event) => {
        if (event.target === event.target.getStage()) {
          onActivateSurface(null);
          onClearEditorUiState();
          return;
        }
        onActivateSurface();
      }}
      onTouchStart={(event) => {
        if (event.target === event.target.getStage()) {
          onActivateSurface(null);
          onClearEditorUiState();
          return;
        }
        onActivateSurface();
      }}
      onMouseMove={(event) => {
        if (!selectorEnabled || !rootElement) return;
        const stage = event.target.getStage();
        const contentLayer = contentLayerRef.current;
        if (
          !stage ||
          !contentLayer ||
          event.target === stage ||
          event.target.getLayer() !== contentLayer ||
          event.target.findAncestor("Transformer")
        ) {
          hoveredKonvaNodeRef.current = null;
          onHoverSelectionRectChange(null);
          return;
        }

        let hoverTarget = event.target as Konva.Node;
        while (
          hoverTarget.getParent() &&
          hoverTarget.getParent() !== contentLayer
        ) {
          hoverTarget = hoverTarget.getParent() as Konva.Node;
        }
        if (hoveredKonvaNodeRef.current === hoverTarget) return;
        hoveredKonvaNodeRef.current = hoverTarget;

        const box = hoverTarget.getClientRect({
          relativeTo: stage,
          skipShadow: true,
        });
        const viewport = rootElement.getBoundingClientRect();
        const scaleX = viewport.width / STAGE_WIDTH;
        const scaleY = viewport.height / STAGE_HEIGHT;
        onHoverSelectionRectChange(
          box.width > 0 && box.height > 0
            ? {
                left: viewport.left + box.x * scaleX,
                top: viewport.top + box.y * scaleY,
                width: box.width * scaleX,
                height: box.height * scaleY,
              }
            : null,
        );
      }}
      onMouseLeave={() => {
        hoveredKonvaNodeRef.current = null;
        onHoverSelectionRectChange(null);
      }}
    >
      <Layer ref={backgroundLayerRef} listening={false}>
        <Rect width={STAGE_WIDTH} height={STAGE_HEIGHT} fill={backgroundColor(uiDraft)} />
      </Layer>
      <Layer ref={contentLayerRef} listening={isEditMode}>
        {rootElements.map((element, elementIndex) => (
          <MemoizedRawElementNode
            key={`root:${rawElementKey(element, elementIndex)}`}
            element={element}
            componentIndex={ROOT_ELEMENTS_COMPONENT_INDEX}
            elementPath={[elementIndex]}
            isEditMode={isEditMode}
            editingKey={editingKey}
            vectorEditingKey={vectorEditingKey}
            selectedTableCell={visibleSelectedTableCell}
            selectedKey={selectedKey}
            setNodeRef={setSelectionNodeRef}
            onSelect={onSelect}
            onTableCellSelect={onTableCellSelect}
            onTableCellEdit={onTableCellEdit}
            onOpenEditor={onOpenEditor}
            onElementChange={onElementChange}
            onElementDragStart={onElementDragStart}
            onElementDragMove={onElementDragMove}
            onElementDragComplete={onElementDragComplete}
            parentBox={STAGE_BOX}
            layoutManaged={false}
            fontRevision={fontRevision}
          />
        ))}
        {components.map((component, componentIndex) => (
          <MemoizedRawComponentNode
            key={componentKey(component, componentIndex)}
            component={component}
            componentIndex={componentIndex}
            isEditMode={isEditMode}
            isMultiSelectedComponent={
              selectedComponentIndexes.length > 1 &&
              selectedComponentIndexSet.has(componentIndex)
            }
            editingKey={editingKey}
            vectorEditingKey={vectorEditingKey}
            selectedTableCell={visibleSelectedTableCell}
            selectedKey={selectedKey}
            setNodeRef={setSelectionNodeRef}
            onSelect={onSelect}
            onTableCellSelect={onTableCellSelect}
            onTableCellEdit={onTableCellEdit}
            onOpenElementEditor={onOpenEditor}
            onComponentChange={onComponentChange}
            onComponentDragStart={onComponentDragStart}
            onComponentDragMove={onComponentDragMove}
            onComponentDragEnd={onComponentDragEnd}
            onElementChange={onElementChange}
            onElementDragStart={onElementDragStart}
            onElementDragMove={onElementDragMove}
            onElementDragComplete={onElementDragComplete}
            fontRevision={fontRevision}
          />
        ))}
        {isEditMode ? (
          <TemplateV2SelectionTransformers
            nodeRefs={nodeRefs}
            parentComponentKey={transformerParentComponentKey}
            selectedKey={selectedKey}
            selectedKeys={selectedKeys}
            selectionKind={selectionKind}
            horizontalResizeOnly={horizontalResizeOnly}
            fullElementTransform={
              selectedIsImageElement ||
              (selectedIsVectorElement && selectedCanEditVectorPoints)
            }
            suppressSelectedOutline={Boolean(
              selectedTableCell ||
                inlineEdit ||
                imageCropActive ||
                readString(selectedElement?.type) === "chart" ||
                selectedIsVectorPointEditing,
            )}
          />
        ) : null}
      </Layer>
      {isEditMode ? (
        <Layer ref={alignmentGuideLayerRef} listening={false}>
          <Line
            ref={verticalAlignmentGuideHaloRef}
            points={[0, 0, 0, 0]}
            visible={false}
            stroke={ALIGNMENT_GUIDE_HALO_COLOR}
            strokeWidth={ALIGNMENT_GUIDE_HALO_WIDTH_PX / effectiveDisplayScale}
            dash={ALIGNMENT_GUIDE_DASH_PX.map(
              (value) => value / effectiveDisplayScale,
            )}
            lineCap="round"
            listening={false}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
          <Line
            ref={horizontalAlignmentGuideHaloRef}
            points={[0, 0, 0, 0]}
            visible={false}
            stroke={ALIGNMENT_GUIDE_HALO_COLOR}
            strokeWidth={ALIGNMENT_GUIDE_HALO_WIDTH_PX / effectiveDisplayScale}
            dash={ALIGNMENT_GUIDE_DASH_PX.map(
              (value) => value / effectiveDisplayScale,
            )}
            lineCap="round"
            listening={false}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
          <Line
            ref={verticalAlignmentGuideRef}
            points={[0, 0, 0, 0]}
            visible={false}
            stroke={ALIGNMENT_GUIDE_COLOR}
            strokeWidth={
              ALIGNMENT_GUIDE_STROKE_WIDTH_PX / effectiveDisplayScale
            }
            dash={ALIGNMENT_GUIDE_DASH_PX.map(
              (value) => value / effectiveDisplayScale,
            )}
            lineCap="round"
            listening={false}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
          <Line
            ref={horizontalAlignmentGuideRef}
            points={[0, 0, 0, 0]}
            visible={false}
            stroke={ALIGNMENT_GUIDE_COLOR}
            strokeWidth={
              ALIGNMENT_GUIDE_STROKE_WIDTH_PX / effectiveDisplayScale
            }
            dash={ALIGNMENT_GUIDE_DASH_PX.map(
              (value) => value / effectiveDisplayScale,
            )}
            lineCap="round"
            listening={false}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
        </Layer>
      ) : null}
    </Stage>
  );
}
