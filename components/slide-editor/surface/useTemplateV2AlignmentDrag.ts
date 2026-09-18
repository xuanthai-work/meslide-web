"use client";

import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import type Konva from "konva";
import {
  createAlignmentSnapTargets,
  snapBoxToAlignmentGuides,
  type AlignmentGuide,
  type AlignmentSnapTargets,
} from "@/components/slide-editor/surface/alignmentGuides";
import {
  ALIGNMENT_GUIDE_SNAP_DISTANCE_PX,
  renderedNodeBox,
  syncAlignmentGuideNode,
} from "@/components/slide-editor/surface/alignmentGuideRender";
import {
  ROOT_ELEMENTS_COMPONENT_INDEX,
  STAGE_BOX,
  absoluteBoxForSelection,
  asRecord,
  boxContainingBoxes,
  componentBox,
  elementBox,
  keyForSelection,
  readArray,
  readPoint,
  setComponentPositionsInUi,
  type Box,
  type ElementSelection,
  type MultiComponentDragState,
  type Point,
  type RawComponent,
  type RawUi,
} from "@/components/slide-editor/model/model";

type ComponentAlignmentDragState = {
  draggedComponentIndex: number;
  draggedNodeStart: Point;
  movingBoxStart: Box;
  targets: AlignmentSnapTargets;
};

type ElementAlignmentDragState = {
  draggedKey: string;
  draggedNodeStart: Point;
  movingBoxStart: Box;
  targets: AlignmentSnapTargets;
};

export function useTemplateV2AlignmentDrag({
  effectiveDisplayScale,
  currentUiRef,
  nodeRefs,
  selectedComponentIndexes,
  commitUi,
  updateComponent,
}: {
  effectiveDisplayScale: number;
  currentUiRef: MutableRefObject<RawUi>;
  nodeRefs: MutableRefObject<Map<string, Konva.Node>>;
  selectedComponentIndexes: number[];
  commitUi: (next: RawUi, pushHistory?: boolean) => void;
  updateComponent: (
    componentIndex: number,
    updater: (component: RawComponent) => RawComponent,
    pushHistory?: boolean,
  ) => void;
}) {
  const alignmentGuideLayerRef = useRef<Konva.Layer | null>(null);
  const verticalAlignmentGuideRef = useRef<Konva.Line | null>(null);
  const horizontalAlignmentGuideRef = useRef<Konva.Line | null>(null);
  const verticalAlignmentGuideHaloRef = useRef<Konva.Line | null>(null);
  const horizontalAlignmentGuideHaloRef = useRef<Konva.Line | null>(null);
  const multiComponentDragRef = useRef<MultiComponentDragState | null>(null);
  const componentAlignmentDragRef =
    useRef<ComponentAlignmentDragState | null>(null);
  const elementAlignmentDragRef =
    useRef<ElementAlignmentDragState | null>(null);
  const selectedComponentIndexesRef = useRef(selectedComponentIndexes);

  useEffect(() => {
    selectedComponentIndexesRef.current = selectedComponentIndexes;
  }, [selectedComponentIndexes]);

  const showAlignmentGuides = useCallback((guides: AlignmentGuide[]) => {
    const vertical = guides.find((guide) => guide.axis === "vertical");
    const horizontal = guides.find((guide) => guide.axis === "horizontal");
    const verticalChanged = syncAlignmentGuideNode(
      verticalAlignmentGuideRef.current,
      vertical,
    );
    const horizontalChanged = syncAlignmentGuideNode(
      horizontalAlignmentGuideRef.current,
      horizontal,
    );
    const verticalHaloChanged = syncAlignmentGuideNode(
      verticalAlignmentGuideHaloRef.current,
      vertical,
    );
    const horizontalHaloChanged = syncAlignmentGuideNode(
      horizontalAlignmentGuideHaloRef.current,
      horizontal,
    );
    if (
      verticalChanged ||
      horizontalChanged ||
      verticalHaloChanged ||
      horizontalHaloChanged
    ) {
      alignmentGuideLayerRef.current?.batchDraw();
    }
  }, []);
  const clearAlignmentGuides = useCallback(
    () => showAlignmentGuides([]),
    [showAlignmentGuides],
  );

  const resetDragState = useCallback(() => {
    componentAlignmentDragRef.current = null;
    elementAlignmentDragRef.current = null;
    multiComponentDragRef.current = null;
    clearAlignmentGuides();
  }, [clearAlignmentGuides]);

  const componentAlignmentTargetBoxes = useCallback(
    (
      movingComponentIndexes: Set<number>,
      movingRootElementIndex: number | null = null,
    ) => {
      const current = currentUiRef.current;
      const currentComponents = readArray(current.components);
      const componentTargets = currentComponents.flatMap((entry, index) => {
        if (movingComponentIndexes.has(index)) return [];
        const component = asRecord(entry);
        if (!component) return [];
        const fallback = componentBox(component);
        const targetNode = nodeRefs.current.get(
          keyForSelection({ kind: "component", componentIndex: index }),
        );
        return [targetNode ? renderedNodeBox(targetNode, fallback) : fallback];
      });
      const rootTargets = readArray(current.elements).flatMap((entry, index) => {
        if (index === movingRootElementIndex) return [];
        const element = asRecord(entry);
        if (!element) return [];
        const fallback = elementBox(element);
        const targetNode = nodeRefs.current.get(
          keyForSelection({
            kind: "element",
            componentIndex: ROOT_ELEMENTS_COMPONENT_INDEX,
            elementPath: [index],
          }),
        );
        return [targetNode ? renderedNodeBox(targetNode, fallback) : fallback];
      });
      return [...componentTargets, ...rootTargets];
    },
    [currentUiRef, nodeRefs],
  );

  const snapDraggedComponentToGuides = useCallback(
    (componentIndex: number, node: Konva.Node) => {
      const dragState = componentAlignmentDragRef.current;
      if (
        !dragState ||
        dragState.draggedComponentIndex !== componentIndex
      ) {
        return;
      }
      const position = node.position();
      const rawDelta = {
        x: position.x - dragState.draggedNodeStart.x,
        y: position.y - dragState.draggedNodeStart.y,
      };
      const movingBox = {
        ...dragState.movingBoxStart,
        x: dragState.movingBoxStart.x + rawDelta.x,
        y: dragState.movingBoxStart.y + rawDelta.y,
      };
      const snapped = snapBoxToAlignmentGuides({
        movingBox,
        stageBox: STAGE_BOX,
        targets: dragState.targets,
        threshold:
          ALIGNMENT_GUIDE_SNAP_DISTANCE_PX /
          effectiveDisplayScale,
      });
      const snappedDelta = {
        x: snapped.position.x - dragState.movingBoxStart.x,
        y: snapped.position.y - dragState.movingBoxStart.y,
      };
      node.position({
        x: dragState.draggedNodeStart.x + snappedDelta.x,
        y: dragState.draggedNodeStart.y + snappedDelta.y,
      });
      showAlignmentGuides(snapped.guides);
    },
    [effectiveDisplayScale, showAlignmentGuides],
  );

  const snapDraggedElementToGuides = useCallback(
    (elementSelection: ElementSelection, node: Konva.Node) => {
      const dragState = elementAlignmentDragRef.current;
      if (
        !dragState ||
        dragState.draggedKey !== keyForSelection(elementSelection)
      ) {
        return;
      }
      const position = node.absolutePosition();
      const rawDelta = {
        x: position.x - dragState.draggedNodeStart.x,
        y: position.y - dragState.draggedNodeStart.y,
      };
      const movingBox = {
        ...dragState.movingBoxStart,
        x: dragState.movingBoxStart.x + rawDelta.x,
        y: dragState.movingBoxStart.y + rawDelta.y,
      };
      const snapped = snapBoxToAlignmentGuides({
        movingBox,
        stageBox: STAGE_BOX,
        targets: dragState.targets,
        threshold:
          ALIGNMENT_GUIDE_SNAP_DISTANCE_PX /
          effectiveDisplayScale,
      });
      node.absolutePosition({
        x:
          dragState.draggedNodeStart.x +
          snapped.position.x -
          dragState.movingBoxStart.x,
        y:
          dragState.draggedNodeStart.y +
          snapped.position.y -
          dragState.movingBoxStart.y,
      });
      showAlignmentGuides(snapped.guides);
    },
    [effectiveDisplayScale, showAlignmentGuides],
  );

  const handleElementAlignmentDragStart = useCallback(
    (elementSelection: ElementSelection, node: Konva.Node) => {
      const current = currentUiRef.current;
      const fallback =
        absoluteBoxForSelection(current, elementSelection) ??
        ({
          ...node.absolutePosition(),
          width: Math.max(1, node.width()),
          height: Math.max(1, node.height()),
        } satisfies Box);
      const draggedNodeStart = node.absolutePosition();
      const isRootElement =
        elementSelection.componentIndex === ROOT_ELEMENTS_COMPONENT_INDEX;
      elementAlignmentDragRef.current = {
        draggedKey: keyForSelection(elementSelection),
        draggedNodeStart: {
          x: draggedNodeStart.x,
          y: draggedNodeStart.y,
        },
        movingBoxStart: renderedNodeBox(node, fallback),
        targets: createAlignmentSnapTargets(
          STAGE_BOX,
          componentAlignmentTargetBoxes(
            new Set<number>(
              isRootElement ? [] : [elementSelection.componentIndex],
            ),
            isRootElement ? elementSelection.elementPath[0] ?? null : null,
          ),
        ),
      };
      componentAlignmentDragRef.current = null;
      multiComponentDragRef.current = null;
      clearAlignmentGuides();
    },
    [clearAlignmentGuides, componentAlignmentTargetBoxes, currentUiRef],
  );

  const handleElementAlignmentDragMove = useCallback(
    (elementSelection: ElementSelection, node: Konva.Node) => {
      snapDraggedElementToGuides(elementSelection, node);
    },
    [snapDraggedElementToGuides],
  );

  const handleElementAlignmentDragComplete = useCallback(
    (elementSelection: ElementSelection, node: Konva.Node) => {
      snapDraggedElementToGuides(elementSelection, node);
      elementAlignmentDragRef.current = null;
      clearAlignmentGuides();
    },
    [clearAlignmentGuides, snapDraggedElementToGuides],
  );

  const handleComponentDragStart = useCallback(
    (componentIndex: number, node: Konva.Node) => {
      elementAlignmentDragRef.current = null;
      const selectedIndexes = selectedComponentIndexesRef.current;
      const isMultiComponentDrag =
        selectedIndexes.length >= 2 &&
        selectedIndexes.includes(componentIndex);
      const movingIndexes = isMultiComponentDrag
        ? selectedIndexes
        : [componentIndex];
      const sourceComponents = readArray(currentUiRef.current.components);
      const movingBoxes = movingIndexes.flatMap((movingIndex) => {
        const component = asRecord(sourceComponents[movingIndex]);
        if (!component) return [];
        const fallback = componentBox(component);
        const movingNode =
          movingIndex === componentIndex
            ? node
            : nodeRefs.current.get(
                keyForSelection({
                  kind: "component",
                  componentIndex: movingIndex,
                }),
              );
        return [movingNode ? renderedNodeBox(movingNode, fallback) : fallback];
      });
      const draggedNodeStart = node.position();
      componentAlignmentDragRef.current = {
        draggedComponentIndex: componentIndex,
        draggedNodeStart: {
          x: draggedNodeStart.x,
          y: draggedNodeStart.y,
        },
        movingBoxStart:
          movingBoxes.length > 0
            ? boxContainingBoxes(movingBoxes)
            : {
                x: draggedNodeStart.x,
                y: draggedNodeStart.y,
                width: 1,
                height: 1,
              },
        targets: createAlignmentSnapTargets(
          STAGE_BOX,
          componentAlignmentTargetBoxes(new Set(movingIndexes)),
        ),
      };
      clearAlignmentGuides();

      if (!isMultiComponentDrag) {
        multiComponentDragRef.current = null;
        return;
      }

      const nodes = selectedIndexes.flatMap((selectedIndex) => {
        const selectedNode = nodeRefs.current.get(
          keyForSelection({ kind: "component", componentIndex: selectedIndex }),
        );
        if (!selectedNode) return [];
        const nodePosition = selectedNode.position();
        const component = asRecord(sourceComponents[selectedIndex]);
        const modelPosition = component
          ? readPoint(component.position)
          : nodePosition;
        return [
          {
            componentIndex: selectedIndex,
            node: selectedNode,
            nodeStart: { x: nodePosition.x, y: nodePosition.y },
            modelStart: { x: modelPosition.x, y: modelPosition.y },
          },
        ];
      });
      multiComponentDragRef.current = {
        draggedComponentIndex: componentIndex,
        draggedNodeStart: { x: draggedNodeStart.x, y: draggedNodeStart.y },
        nodes,
      };
    },
    [
      clearAlignmentGuides,
      componentAlignmentTargetBoxes,
      currentUiRef,
      nodeRefs,
    ],
  );

  const handleComponentDragMove = useCallback(
    (componentIndex: number, node: Konva.Node) => {
      snapDraggedComponentToGuides(componentIndex, node);
      const dragState = multiComponentDragRef.current;
      if (!dragState || dragState.draggedComponentIndex !== componentIndex) {
        return;
      }
      const position = node.position();
      const delta = {
        x: position.x - dragState.draggedNodeStart.x,
        y: position.y - dragState.draggedNodeStart.y,
      };
      dragState.nodes.forEach(({ node, nodeStart }) => {
        node.position({
          x: nodeStart.x + delta.x,
          y: nodeStart.y + delta.y,
        });
      });
      node.getLayer()?.batchDraw();
    },
    [snapDraggedComponentToGuides],
  );

  const handleComponentDragEnd = useCallback(
    (componentIndex: number, node: Konva.Node) => {
      snapDraggedComponentToGuides(componentIndex, node);
      componentAlignmentDragRef.current = null;
      clearAlignmentGuides();
      const dragState = multiComponentDragRef.current;
      if (!dragState || dragState.draggedComponentIndex !== componentIndex) {
        updateComponent(componentIndex, (current) => {
          const box = componentBox(current);
          return {
            ...current,
            position: {
              x: node.x() - box.width / 2,
              y: node.y() - box.height / 2,
            },
          };
        });
        return;
      }

      multiComponentDragRef.current = null;
      const position = node.position();
      const delta = {
        x: position.x - dragState.draggedNodeStart.x,
        y: position.y - dragState.draggedNodeStart.y,
      };
      if (Math.abs(delta.x) < 0.01 && Math.abs(delta.y) < 0.01) {
        return;
      }
      commitUi(
        setComponentPositionsInUi(
          currentUiRef.current,
          dragState.nodes.map(({ componentIndex, modelStart }) => ({
            componentIndex,
            position: {
              x: modelStart.x + delta.x,
              y: modelStart.y + delta.y,
            },
          })),
        ),
      );
    },
    [
      clearAlignmentGuides,
      commitUi,
      currentUiRef,
      snapDraggedComponentToGuides,
      updateComponent,
    ],
  );

  return {
    alignmentGuideLayerRef,
    verticalAlignmentGuideRef,
    horizontalAlignmentGuideRef,
    verticalAlignmentGuideHaloRef,
    horizontalAlignmentGuideHaloRef,
    clearAlignmentGuides,
    resetDragState,
    handleElementAlignmentDragStart,
    handleElementAlignmentDragMove,
    handleElementAlignmentDragComplete,
    handleComponentDragStart,
    handleComponentDragMove,
    handleComponentDragEnd,
  };
}
