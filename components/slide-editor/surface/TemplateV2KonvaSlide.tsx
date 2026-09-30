"use client";

import {
  useCallback,
  useEffect,
  useId,
  memo,
  useMemo,
  useRef,
  useState,
  type ChangeEvent as ReactChangeEvent,
} from "react";
import type Konva from "konva";
import { useDispatch, useSelector } from "react-redux";
import { Loader2 } from "lucide-react";
import { notify } from "@/components/ui/sonner";
import type { TemplateV2Layout } from "@/components/slide-editor/importing/template-v2-import";
import {
  templateFontOptionsFromMap,
} from "@/components/slide-editor/text/google-fonts";
import {
  autoUngroupTextComponents,
  canUngroupTemplateV2Component,
  ungroupTemplateV2ComponentInUi,
} from "@/components/slide-editor/model/template-v2-ungroup";
import {
  groupTemplateV2ComponentsInUi,
} from "@/components/slide-editor/model/template-v2-group";
import { textRunsContent } from "@/components/slide-editor/text/text-runs";

import {
  normalizeRawTextMarkdownElement,
  rawTextContent,
  rawTextListRunsForEditor,
  rawTextRunsForEditor,
  rawTextStyle,
  setRawTextListRunsContent,
  setRawTextRunsContent,
} from "@/components/slide-editor/text/template-v2-text";
import type {
  Marker,
  SlideElement,
  TextRun,
} from "@/components/slide-editor/types";
import {
  useTableCellSelection,
  useTemplateV2InlineEditing,
  type ChartSlideElement,
  type TableSlideElement,
} from "@/components/slide-editor/state/state";
import {
  measureWordWrappedTextRunsHeight,
  type TemplateV2InlineEditBox,
  type TemplateV2TextEditStyle,
  wordWrappedTextRuns,
} from "@/components/slide-editor/text/template-v2-text-editing";

import { updateSlideUi } from "@/store/slices/presentationGeneration";
import type { RootState } from "@/store/store";
import type { HtmlSelectionRect } from "@/app/(presentation-generator)/components/HtmlSelectionOverlay";
import { useNearViewport } from "@/app/hooks/useNearViewport";
import { resolveBackendAssetSource } from "@/utils/api";
import { ImagesApi } from "@/app/(presentation-generator)/services/api/images";
import {
  createTemplateV2ClipboardPayload,
  pasteTemplateV2ClipboardPayload,
  type TemplateV2ClipboardPayload,
} from "@/components/slide-editor/clipboard/clipboard";
import { useTemplateV2Clipboard } from "@/components/slide-editor/clipboard/useClipboard";
import {
  isTemplateV2FlowLayoutElement,
  isTemplateV2GroupElement,
  type TemplateV2SelectionComponentActions,
} from "@/components/slide-editor/layout/LayoutToolbar";
import {
  getTemplateV2SelectionToolbarAnchorBox,
  getTemplateV2SelectionToolbarBounds,
  getTemplateV2SelectionToolbarPosition,
  hasTemplateV2SelectionToolbar,
} from "@/components/slide-editor/selection/toolbarPosition";
import {
  getTemplateV2SelectionChartToolbarTarget,
  getTemplateV2SelectionEditorToolbarTarget,
  getTemplateV2SelectionTableToolbarTarget,
  getTemplateV2SelectionToolbarTarget,
} from "@/components/slide-editor/selection/toolbarTarget";
import { updateComponentLayoutElement } from "@/components/slide-editor/layout/layoutResize";
import {
  reorderComponentLayer,
  type ComponentLayerAction,
} from "@/components/slide-editor/selection/layering";
import { useFontLoadState } from "@/components/slide-editor/surface/fontLoading";
import {
  MAX_ALIGNMENT_SCENE_PIXEL_RATIO,
  MAX_BACKGROUND_SCENE_PIXEL_RATIO,
  MIN_ALIGNMENT_SCENE_PIXEL_RATIO,
  MIN_BACKGROUND_SCENE_PIXEL_RATIO,
  calculateContentScenePixelRatio,
  calculateScenePixelRatio,
} from "@/components/slide-editor/surface/pixelRatio";
import { TemplateV2KonvaOverlays } from "@/components/slide-editor/surface/TemplateV2KonvaOverlays";
import { TemplateV2KonvaStage } from "@/components/slide-editor/surface/TemplateV2KonvaStage";
import { useTemplateV2AlignmentDrag } from "@/components/slide-editor/surface/useTemplateV2AlignmentDrag";
import { useTemplateV2Keyboard } from "@/components/slide-editor/surface/useTemplateV2Keyboard";
import {
  MAX_HISTORY_ENTRIES,
  ROOT_ELEMENTS_COMPONENT_INDEX,
  SCROLL_DISMISS_THRESHOLD_PX,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  absoluteBoxForSelection,
  absoluteInlineEditBox,
  appendInsertedContent,
  asRecord,
  childArrayInfo,
  childrenBounds,
  cloneJson,
  componentBox,
  componentForClipboardSelection,
  componentIndexesForSelection,
  deleteSelectionFromUi,
  editorChartToRawChart,
  elementBox,
  elementSize,
  elementWithInlineDraft,
  elementWithNormalizedLayoutChildren,
  eventTargetsThisSlide,
  getElementAtSelection,
  syncComponentHeightToElement,
  isEditableTarget,
  isManualPositioned,
  isRecord,
  isRawIconElement,
  isVectorType,
  keyForSelection,
  keysForSelection,
  layoutChildren,
  normalizeMarkdownTextInUi,
  mergeEditorToolbarElement,
  rawChartToEditorChart,
  rawElementForEditorToolbar,
  readArray,
  readString,
  renderedLocalBoxForElementSelection,
  rootElementsComponent,
  selectionForComponentIndexes,
  selectionForInsertedComponent,
  selectionWithComponentToggle,
  surfaceSelectionTarget,
  updateComponentInUi,
  updateElementInUi,
  type ComponentSelection,
  type ElementSelection,
  type Point,
  type RawComponent,
  type RawElement,
  type RawUi,
  type SelectOptions,
  type Selection,
  type UnknownRecord,
} from "@/components/slide-editor/model/model";
import {
  TEMPLATE_V2_ACTIVATE_SURFACE_EVENT,
  TEMPLATE_V2_INSERT_ELEMENTS_EVENT,
  TEMPLATE_V2_SURFACE_SELECTED_EVENT,
  type TemplateV2ActivateSurfaceDetail,
  type TemplateV2InsertElementsDetail,
  type TemplateV2SurfaceSelectedDetail,
} from "@/components/slide-editor/events/events";

/**
 * Normalizes a raw slide UI for the editor. In edit mode, text-only groups are
 * automatically ungrouped so each heading/paragraph gets its own selectable box
 * (the user no longer has to ungroup before editing a single text element).
 * Presentation mode keeps the authored grouping.
 */
function normalizeEditorUi(ui: RawUi, isEditMode: boolean): RawUi {
  const normalized = normalizeMarkdownTextInUi(cloneJson(ui));
  if (!isEditMode) return normalized;
  return autoUngroupTextComponents(normalized, {
    childArrayInfo,
    componentBox,
    elementBox,
    layoutChildren,
  }) as RawUi;
}

function autoSizeInlineTextFrame(
  frame: TemplateV2InlineEditBox | null | undefined,
  runs: TextRun[],
  style: TemplateV2TextEditStyle,
) {
  if (!frame) return frame;
  const contentHeight = measureWordWrappedTextRunsHeight(
    runs,
    frame.width,
    style,
  );
  return {
    ...frame,
    height: Math.max(1, contentHeight),
  };
}

function canEditVectorPointsForSelection(ui: RawUi, selection: ElementSelection) {
  if (selection.componentIndex === ROOT_ELEMENTS_COMPONENT_INDEX) return true;
  if (selection.elementPath.length !== 1) return false;
  const component = asRecord(readArray(ui.components)[selection.componentIndex]);
  const elements = readArray(component?.elements).filter(isRecord);
  return elements.length === 1;
}

function syncScenePixelRatio(
  layer: Konva.Layer | null,
  pixelRatio: number,
) {
  if (!layer || typeof window === "undefined") return;
  const canvas = layer.getCanvas();
  if (Math.abs(canvas.getPixelRatio() - pixelRatio) < 0.01) return;
  canvas.setPixelRatio(pixelRatio);
  layer.batchDraw();
}

export {
  TEMPLATE_V2_ACTIVATE_SURFACE_EVENT,
  TEMPLATE_V2_INSERT_ELEMENTS_EVENT,
  TEMPLATE_V2_SURFACE_SELECTED_EVENT,
  type TemplateV2ActivateSurfaceDetail,
  type TemplateV2InsertElementsDetail,
  type TemplateV2SurfaceSelectedDetail,
} from "@/components/slide-editor/events/events";

type TemplateV2KonvaSlideProps = {
  layout: TemplateV2Layout;
  isEditMode: boolean;
  slideId?: string | number | null;
  presentationId?: string;
  slideIndex: number;
  renderIndex?: number;
  fonts?: unknown;
  displayScale?: number;
  enableViewportCulling?: boolean;
  isSelected?: boolean;
  historyCommand?: { action: "undo" | "redo"; token: number } | null;
  onHistoryAvailabilityChange?: (availability: {
    canUndo: boolean;
    canRedo: boolean;
  }) => void;
  onLayoutChange?: (layout: TemplateV2Layout) => void;
};

function TemplateV2KonvaSlideComponent({
  layout,
  isEditMode,
  slideId = null,
  slideIndex,
  renderIndex,
  fonts,
  displayScale = 1,
  enableViewportCulling = false,
  isSelected = false,
  historyCommand = null,
  onHistoryAvailabilityChange,
  onLayoutChange,
}: TemplateV2KonvaSlideProps) {
  const selectorEnabled = useSelector(
    (state: RootState) => state.presentationGeneration.enableHtmlSelector,
  );
  const effectiveDisplayScale = Number.isFinite(displayScale)
    ? Math.max(0.1, Math.abs(displayScale))
    : 1;
  const dispatch = useDispatch();
  const surfaceId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [rootElement, setRootElement] = useState<HTMLDivElement | null>(null);
  const nodeRefs = useRef(new Map<string, Konva.Node>());
  const backgroundLayerRef = useRef<Konva.Layer | null>(null);
  const contentLayerRef = useRef<Konva.Layer | null>(null);
  const resetDragStateRef = useRef<() => void>(() => {});
  const imageUploadInputRef = useRef<HTMLInputElement | null>(null);
  const pendingImageUploadRef = useRef<ElementSelection | null>(null);
  const undoStackRef = useRef<RawUi[]>([]);
  const redoStackRef = useRef<RawUi[]>([]);
  const handledHistoryCommandTokenRef = useRef<number | null>(null);
  const [uiDraft, setUiDraft] = useState<RawUi>(() =>
    normalizeEditorUi(layout as RawUi, isEditMode),
  );
  const templateFonts = useMemo(() => templateFontOptionsFromMap(fonts), [
    fonts,
  ]);
  const {
    isNearViewport,
    ref: setViewportRoot,
  } = useNearViewport<HTMLDivElement>({
    enabled: enableViewportCulling,
    forceActive: isSelected,
    rootMargin: "800px 0px",
    rootSelector: "[data-presentation-slides-scroll-container='true']",
  });
  const isRenderActive = !enableViewportCulling || isNearViewport;
  const fontLoadState = useFontLoadState(
    uiDraft,
    templateFonts,
    isRenderActive,
  );
  const currentUiRef = useRef<RawUi>(uiDraft);
  const [selection, setSelection] = useState<Selection>(null);
  const hoveredKonvaNodeRef = useRef<Konva.Node | null>(null);
  const [hoverSelectionRect, setHoverSelectionRect] =
    useState<HtmlSelectionRect | null>(null);
  const selectionRef = useRef<Selection>(selection);

  useEffect(() => {
    if (selectorEnabled) return;
    hoveredKonvaNodeRef.current = null;
    setHoverSelectionRect(null);
  }, [selectorEnabled]);
  const {
    inlineEdit,
    clearInlineEdit,
    startInlineEdit,
    updateInlineDraft,
    updateInlineEdit,
    updateInlineTextSelectionRange,
  } = useTemplateV2InlineEditing<ElementSelection>({
    keyForSelection,
  });
  const [vectorEditSelection, setVectorEditSelection] =
    useState<ElementSelection | null>(null);
  const vectorEditingKey = vectorEditSelection
    ? keyForSelection(vectorEditSelection)
    : null;
  const [iconEditorSelection, setIconEditorSelection] =
    useState<ElementSelection | null>(null);
  const [chartEditorSelection, setChartEditorSelection] =
    useState<ElementSelection | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageCropActive, setImageCropActive] = useState(false);
  const [, setHistoryAvailability] = useState({
    canUndo: false,
    canRedo: false,
  });
  const publishHistoryAvailability = useCallback(() => {
    const availability = {
      canUndo: undoStackRef.current.length > 0,
      canRedo: redoStackRef.current.length > 0,
    };
    setHistoryAvailability(availability);
    onHistoryAvailabilityChange?.(availability);
  }, [onHistoryAvailabilityChange]);
  const {
    clearTableCellEditing,
    clearTableCellSelection,
    editingTableCell,
    editTableCellSelection,
    selectedTableCell,
    selectTableCellSelection,
    visibleSelectedTableCell,
  } = useTableCellSelection<Selection, ElementSelection>({
    keyForSelection,
    selection,
  });
  const setRootNode = useCallback((node: HTMLDivElement | null) => {
    rootRef.current = node;
    setRootElement(node);
    setViewportRoot(node);
  }, [setViewportRoot]);

  const components = useMemo(
    () => readArray(uiDraft.components).filter(isRecord) as RawComponent[],
    [uiDraft.components],
  );
  const rootElements = useMemo(
    () => readArray(uiDraft.elements).filter(isRecord) as RawElement[],
    [uiDraft.elements],
  );
  const setSelectionNodeRef = useCallback(
    (key: string, node: Konva.Node | null) => {
      if (node) nodeRefs.current.set(key, node);
      else nodeRefs.current.delete(key);
    },
    [],
  );
  const selectedComponentIndexes = useMemo(
    () => componentIndexesForSelection(selection),
    [selection],
  );
  const selectedComponentIndexSet = useMemo(
    () => new Set(selectedComponentIndexes),
    [selectedComponentIndexes],
  );
  const selectedKeys = useMemo(() => keysForSelection(selection), [selection]);
  const selectedKey = selectedKeys.length === 1 ? selectedKeys[0] : null;
  const selectedParentComponentKey =
    selection?.kind === "element" &&
      selection.componentIndex !== ROOT_ELEMENTS_COMPONENT_INDEX
      ? keyForSelection({
        kind: "component",
        componentIndex: selection.componentIndex,
      })
      : null;
  const editingKey = inlineEdit ? keyForSelection(inlineEdit.selection) : null;
  const selectedElement =
    selection?.kind === "element"
      ? getElementAtSelection(uiDraft, selection)
      : null;
  const selectedComponent =
    selection?.kind === "component"
      ? asRecord(readArray(uiDraft.components)[selection.componentIndex])
      : null;
  const selectedBox = selection
    ? absoluteBoxForSelection(uiDraft, selection)
    : null;
  const layoutToolbarTarget = useMemo(
    () =>
      getTemplateV2SelectionToolbarTarget({
        selection,
        selectedBox,
        selectedComponent,
        selectedElement,
        absoluteBoxForSelection: (targetSelection) =>
          absoluteBoxForSelection(uiDraft, targetSelection),
      }),
    [selectedBox, selectedComponent, selectedElement, selection, uiDraft],
  );
  const chartToolbarTarget = useMemo(
    () =>
      layoutToolbarTarget
        ? null
        : getTemplateV2SelectionChartToolbarTarget({
            selection,
            selectedBox,
            selectedComponent,
            selectedElement,
            absoluteBoxForSelection: (targetSelection) =>
              absoluteBoxForSelection(uiDraft, targetSelection),
          }),
    [
      layoutToolbarTarget,
      selectedBox,
      selectedComponent,
      selectedElement,
      selection,
      uiDraft,
    ],
  );
  const tableToolbarTarget = useMemo(
    () =>
      layoutToolbarTarget || chartToolbarTarget || editingTableCell
        ? null
        : getTemplateV2SelectionTableToolbarTarget({
            selection,
            selectedBox,
            selectedComponent,
            selectedElement,
            absoluteBoxForSelection: (targetSelection) =>
              absoluteBoxForSelection(uiDraft, targetSelection),
          }),
    [
      chartToolbarTarget,
      editingTableCell,
      layoutToolbarTarget,
      selectedBox,
      selectedComponent,
      selectedElement,
      selection,
      uiDraft,
    ],
  );
  const editorToolbarTarget = useMemo(
    () =>
      layoutToolbarTarget || chartToolbarTarget || tableToolbarTarget
        ? null
        : getTemplateV2SelectionEditorToolbarTarget({
            selection,
            selectedBox,
            selectedComponent,
            selectedElement,
            absoluteBoxForSelection: (targetSelection) =>
              absoluteBoxForSelection(uiDraft, targetSelection),
          }),
    [
      chartToolbarTarget,
      layoutToolbarTarget,
      selectedBox,
      selectedComponent,
      selectedElement,
      selection,
      tableToolbarTarget,
      uiDraft,
    ],
  );
  const horizontalResizeOnly = false;
  const selectedIsVectorElement =
    selection?.kind === "element" &&
    isVectorType(readString(selectedElement?.type));
  const selectedIsImageElement =
    selection?.kind === "element" &&
    readString(selectedElement?.type) === "image";
  const selectedCanEditVectorPoints =
    selection?.kind === "element" &&
    canEditVectorPointsForSelection(uiDraft, selection);
  const selectedIsVectorPointEditing =
    selectedIsVectorElement &&
    selection?.kind === "element" &&
    selectedCanEditVectorPoints &&
    vectorEditingKey === keyForSelection(selection);
  const shouldHideParentComponentBoundary =
    inlineEdit || selectedIsVectorElement || imageCropActive;
  const transformerParentComponentKey = shouldHideParentComponentBoundary
    ? null
    : selectedParentComponentKey;
  const toolbarElement = useMemo(
    () => {
      if (!selectedElement || !selectedBox) return null;
      const inlineTextElement =
        inlineEdit &&
          inlineEdit.kind === "text" &&
          inlineEdit.runs &&
          selection?.kind === "element" &&
          keyForSelection(inlineEdit.selection) === keyForSelection(selection)
          ? setRawTextRunsContent(selectedElement, inlineEdit.runs)
          : inlineEdit &&
            inlineEdit.kind === "text-list" &&
            inlineEdit.runs &&
            selection?.kind === "element" &&
            keyForSelection(inlineEdit.selection) === keyForSelection(selection)
            ? setRawTextListRunsContent(selectedElement, inlineEdit.runs)
            : selectedElement;
      return rawElementForEditorToolbar(inlineTextElement, selectedBox);
    },
    [inlineEdit, selectedBox, selectedElement, selection],
  );
  const canUngroupSelectedComponent = useMemo(
    () =>
      selection?.kind === "component" &&
      selectedComponent != null &&
      canUngroupTemplateV2Component(selectedComponent),
    [selectedComponent, selection],
  );
  const canUngroupLayoutTargetComponent = useMemo(() => {
    const componentIndex = layoutToolbarTarget?.selection.componentIndex;
    if (
      componentIndex == null ||
      componentIndex < 0 ||
      !layoutToolbarTarget ||
      (!isTemplateV2FlowLayoutElement(layoutToolbarTarget.element) &&
        !isTemplateV2GroupElement(layoutToolbarTarget.element))
    ) {
      return false;
    }
    const component = asRecord(readArray(uiDraft.components)[componentIndex]);
    return canUngroupTemplateV2Component(component);
  }, [layoutToolbarTarget, uiDraft.components]);
  const [, setToolbarViewportVersion] = useState(0);
  const hasDismissibleEditorUi = Boolean(
    selection ||
    inlineEdit ||
    iconEditorSelection ||
    chartEditorSelection ||
    selectedTableCell ||
    editingTableCell,
  );
  const floatingToolbarAnchorBox = getTemplateV2SelectionToolbarAnchorBox({
    chartTarget: chartToolbarTarget,
    layoutTarget: layoutToolbarTarget,
    selectedBox,
    selection,
    tableTarget: tableToolbarTarget,
  });
  const hasFloatingToolbar = hasTemplateV2SelectionToolbar({
    anchorBox: floatingToolbarAnchorBox,
    chartTarget: chartToolbarTarget,
    isEditMode,
    layoutTarget: layoutToolbarTarget,
    selection,
    tableTarget: tableToolbarTarget,
  });
  const selectionToolbarPosition = getTemplateV2SelectionToolbarPosition({
    anchorBox: floatingToolbarAnchorBox,
    chartTarget: chartToolbarTarget,
    layoutTarget: layoutToolbarTarget,
    root: rootElement,
    selection,
    tableTarget: tableToolbarTarget,
  });
  const selectionToolbarBounds =
    getTemplateV2SelectionToolbarBounds(rootElement);
  const inlineEditBox = inlineEdit
    ? absoluteInlineEditBox(uiDraft, inlineEdit.selection, inlineEdit.frame)
    : null;
  const iconEditorElement = iconEditorSelection
    ? getElementAtSelection(uiDraft, iconEditorSelection)
    : null;
  const chartEditorElement = chartEditorSelection
    ? getElementAtSelection(uiDraft, chartEditorSelection)
    : null;
  const chartEditorBox = chartEditorSelection
    ? absoluteBoxForSelection(uiDraft, chartEditorSelection)
    : null;
  const chartEditorBase =
    chartEditorElement && readString(chartEditorElement.type) === "chart"
      ? rawChartToEditorChart(chartEditorElement)
      : null;
  const chartEditorChart = chartEditorBase
    ? {
        ...chartEditorBase,
        size: chartEditorBox
          ? { width: chartEditorBox.width, height: chartEditorBox.height }
          : chartEditorBase.size,
      }
    : null;
  const surfaceSlideIndex = useMemo(() => {
    const index = typeof renderIndex === "number" ? renderIndex : slideIndex;
    return Number.isFinite(index) ? index : null;
  }, [renderIndex, slideIndex]);
  const selectedSurfaceTarget = useMemo(
    () => surfaceSelectionTarget(uiDraft, selection, surfaceSlideIndex),
    [selection, surfaceSlideIndex, uiDraft],
  );
  const toolbarSelectedTableCell =
    tableToolbarTarget &&
    selectedTableCell?.elementPath ===
      keyForSelection(tableToolbarTarget.selection)
      ? selectedTableCell
      : null;
  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  useEffect(() => {
    if (!isRenderActive || !fontLoadState.ready) return;
    contentLayerRef.current?.batchDraw();
  }, [
    fontLoadState.ready,
    fontLoadState.revision,
    isRenderActive,
  ]);

  useEffect(() => {
    if (layout === currentUiRef.current) return;
    const next = normalizeEditorUi(layout as RawUi, isEditMode);
    currentUiRef.current = next;
    setUiDraft(next);
    resetDragStateRef.current();
    setSelection(null);
    clearTableCellSelection();
    clearInlineEdit();
    setVectorEditSelection(null);
    setIconEditorSelection(null);
    setChartEditorSelection(null);
    undoStackRef.current = [];
    redoStackRef.current = [];
    publishHistoryAvailability();
  }, [
    clearInlineEdit,
    clearTableCellSelection,
    isEditMode,
    layout,
    publishHistoryAvailability,
  ]);

  useEffect(() => {
    if (
      !isRenderActive ||
      !hasFloatingToolbar ||
      typeof window === "undefined"
    ) {
      return;
    }
    let frame = 0;
    const refreshToolbarPosition = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        setToolbarViewportVersion((version) => version + 1);
      });
    };
    window.addEventListener("resize", refreshToolbarPosition);
    refreshToolbarPosition();
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", refreshToolbarPosition);
    };
  }, [hasFloatingToolbar, isRenderActive]);

  const isSurfaceActive = useCallback(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.dataset.templateV2KonvaActiveSurface === surfaceId,
    [surfaceId],
  );

  const activateSurface = useCallback((nextSelection?: Selection) => {
    if (
      !isEditMode ||
      typeof document === "undefined" ||
      typeof window === "undefined"
    ) {
      return;
    }
    document.documentElement.dataset.templateV2KonvaActiveSurface = surfaceId;
    if (surfaceSlideIndex != null) {
      document.documentElement.dataset.templateV2KonvaActiveSlideIndex =
        String(surfaceSlideIndex);
    }
    window.dispatchEvent(
      new CustomEvent<TemplateV2SurfaceSelectedDetail>(
        TEMPLATE_V2_SURFACE_SELECTED_EVENT,
        {
          detail: {
            slideId,
            slideIndex: surfaceSlideIndex,
            selection: surfaceSelectionTarget(
              currentUiRef.current,
              nextSelection === undefined ? selectionRef.current : nextSelection,
              surfaceSlideIndex,
            ),
          },
        },
      ),
    );
  }, [isEditMode, slideId, surfaceId, surfaceSlideIndex]);

  useEffect(() => {
    if (
      !isRenderActive ||
      !isEditMode ||
      !isSurfaceActive() ||
      typeof window === "undefined"
    ) {
      return;
    }
    window.dispatchEvent(
      new CustomEvent<TemplateV2SurfaceSelectedDetail>(
        TEMPLATE_V2_SURFACE_SELECTED_EVENT,
        {
          detail: {
            slideId,
            slideIndex: surfaceSlideIndex,
            selection: selectedSurfaceTarget,
          },
        },
      ),
    );
  }, [
    isEditMode,
    isRenderActive,
    isSurfaceActive,
    selectedSurfaceTarget,
    slideId,
    surfaceSlideIndex,
  ]);

  useEffect(() => {
    if (!isEditMode || typeof window === "undefined") return;

    const handleActivateSurface = (event: Event) => {
      const detail = (event as CustomEvent<TemplateV2ActivateSurfaceDetail>)
        .detail;
      if (
        !detail ||
        !eventTargetsThisSlide(detail, slideId, surfaceSlideIndex, () => false)
      ) {
        return;
      }
      activateSurface();
    };

    window.addEventListener(
      TEMPLATE_V2_ACTIVATE_SURFACE_EVENT,
      handleActivateSurface,
    );
    return () =>
      window.removeEventListener(
        TEMPLATE_V2_ACTIVATE_SURFACE_EVENT,
        handleActivateSurface,
      );
  }, [activateSurface, isEditMode, slideId, surfaceSlideIndex]);

  const clearSurface = useCallback(() => {
    if (typeof document === "undefined") return;
    if (
      document.documentElement.dataset.templateV2KonvaActiveSurface === surfaceId
    ) {
      delete document.documentElement.dataset.templateV2KonvaActiveSurface;
      delete document.documentElement.dataset.templateV2KonvaActiveSlideIndex;
    }
  }, [surfaceId]);

  const clearEditorUiState = useCallback(
    (options?: { clearActiveSurface?: boolean }) => {
      resetDragStateRef.current();
      selectionRef.current = null;
      setSelection(null);
      clearTableCellSelection();
      clearTableCellEditing();
      clearInlineEdit();
      setVectorEditSelection(null);
      setIconEditorSelection(null);
      setChartEditorSelection(null);
      if (options?.clearActiveSurface) {
        clearSurface();
      }
    },
    [
      clearInlineEdit,
      clearSurface,
      clearTableCellEditing,
      clearTableCellSelection,
    ],
  );

  useEffect(() => {
    if (isEditMode) return;
    clearEditorUiState({ clearActiveSurface: true });
    pendingImageUploadRef.current = null;
  }, [clearEditorUiState, isEditMode]);

  useEffect(() => {
    if (
      !isEditMode ||
      !isRenderActive ||
      !hasDismissibleEditorUi ||
      typeof document === "undefined" ||
      typeof window === "undefined"
    ) {
      return;
    }

    let cleared = false;
    let accumulatedScrollDistance = 0;
    const lastScrollPositionByTarget = new Map<EventTarget, Point>([
      [
        document,
        {
          x: window.scrollX,
          y: window.scrollY,
        },
      ],
    ]);
    const scrollStateForTarget = (target: EventTarget | null) => {
      if (
        target instanceof Element &&
        target !== document.documentElement &&
        target !== document.body
      ) {
        return {
          key: target,
          position: {
            x: target.scrollLeft,
            y: target.scrollTop,
          },
        };
      }

      return {
        key: document,
        position: {
          x: window.scrollX,
          y: window.scrollY,
        },
      };
    };
    const handleScroll = (event: Event) => {
      if (cleared) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("[data-inline-edit-ignore='true']")) return;

      const { key, position } = scrollStateForTarget(event.target);
      const previousPosition = lastScrollPositionByTarget.get(key);
      lastScrollPositionByTarget.set(key, position);
      if (!previousPosition) return;

      accumulatedScrollDistance +=
        Math.abs(position.x - previousPosition.x) +
        Math.abs(position.y - previousPosition.y);
      if (accumulatedScrollDistance < SCROLL_DISMISS_THRESHOLD_PX) return;

      cleared = true;
      clearEditorUiState({ clearActiveSurface: true });
    };

    document.addEventListener("scroll", handleScroll, true);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [
    clearEditorUiState,
    hasDismissibleEditorUi,
    isEditMode,
    isRenderActive,
  ]);

  const commitUi = useCallback(
    (nextUi: RawUi, pushHistory = true) => {
      if (!isEditMode) return;
      if (nextUi === currentUiRef.current) return;
      if (pushHistory) {
        undoStackRef.current.push(currentUiRef.current);
        if (undoStackRef.current.length > MAX_HISTORY_ENTRIES) {
          undoStackRef.current.shift();
        }
        redoStackRef.current = [];
      }
      currentUiRef.current = nextUi;
      setUiDraft(nextUi);
      onLayoutChange?.(nextUi as TemplateV2Layout);
      dispatch(
        updateSlideUi({
          index: surfaceSlideIndex ?? slideIndex,
          ui: nextUi as Record<string, unknown>,
        }),
      );
      publishHistoryAvailability();
    },
    [
      dispatch,
      isEditMode,
      onLayoutChange,
      publishHistoryAvailability,
      slideIndex,
      surfaceSlideIndex,
    ],
  );

  const undo = useCallback(() => {
    const previous = undoStackRef.current.pop();
    if (!previous) return;
    redoStackRef.current.push(currentUiRef.current);
    commitUi(previous, false);
    clearEditorUiState();
  }, [clearEditorUiState, commitUi]);

  const redo = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current.push(currentUiRef.current);
    commitUi(next, false);
    clearEditorUiState();
  }, [clearEditorUiState, commitUi]);

  useEffect(() => {
    if (!historyCommand || !isEditMode) return;
    if (handledHistoryCommandTokenRef.current === historyCommand.token) return;
    handledHistoryCommandTokenRef.current = historyCommand.token;

    if (historyCommand.action === "undo") {
      undo();
      return;
    }
    redo();
  }, [historyCommand, isEditMode, redo, undo]);

  const select = useCallback(
    (nextSelection: Selection, options?: SelectOptions) => {
      clearTableCellSelection();
      const resolvedSelection = selectionWithComponentToggle(
        selectionRef.current,
        nextSelection,
        options,
      );
      selectionRef.current = resolvedSelection;
      setSelection(resolvedSelection);
      setVectorEditSelection((current) =>
        current &&
        resolvedSelection?.kind === "element" &&
        keyForSelection(current) === keyForSelection(resolvedSelection)
          ? current
          : null,
      );
      activateSurface(resolvedSelection);
    },
    [activateSurface, clearTableCellSelection],
  );

  const selectTableCell = useCallback(
    (
      elementSelection: ElementSelection,
      rowIndex: number,
      colIndex: number,
    ) => {
      activateSurface(elementSelection);
      setSelection(elementSelection);
      clearInlineEdit();
      setVectorEditSelection(null);
      setIconEditorSelection(null);
      selectTableCellSelection(elementSelection, rowIndex, colIndex);
    },
    [activateSurface, clearInlineEdit, selectTableCellSelection],
  );

  const editTableCell = useCallback(
    (
      elementSelection: ElementSelection,
      rowIndex: number,
      colIndex: number,
    ) => {
      activateSurface(elementSelection);
      setSelection(elementSelection);
      clearInlineEdit();
      setVectorEditSelection(null);
      setIconEditorSelection(null);
      editTableCellSelection(elementSelection, rowIndex, colIndex);
    },
    [activateSurface, clearInlineEdit, editTableCellSelection],
  );

  const updateComponent = useCallback(
    (
      componentIndex: number,
      updater: (component: RawComponent) => RawComponent,
      pushHistory = true,
    ) => {
      commitUi(updateComponentInUi(currentUiRef.current, componentIndex, updater), pushHistory);
    },
    [commitUi],
  );

  const {
    alignmentGuideLayerRef,
    verticalAlignmentGuideRef,
    horizontalAlignmentGuideRef,
    verticalAlignmentGuideHaloRef,
    horizontalAlignmentGuideHaloRef,
    resetDragState,
    handleElementAlignmentDragStart,
    handleElementAlignmentDragMove,
    handleElementAlignmentDragComplete,
    handleComponentDragStart,
    handleComponentDragMove,
    handleComponentDragEnd,
  } = useTemplateV2AlignmentDrag({
    effectiveDisplayScale,
    currentUiRef,
    nodeRefs,
    selectedComponentIndexes,
    commitUi,
    updateComponent,
  });

  useEffect(() => {
    resetDragStateRef.current = resetDragState;
  }, [resetDragState]);

  useEffect(() => {
    if (!isRenderActive || typeof window === "undefined") {
      return;
    }
    const refreshPixelRatio = () => {
      const devicePixelRatio = window.devicePixelRatio || 1;
      const navigatorWithMemory = window.navigator as Navigator & {
        deviceMemory?: number;
      };
      const contentPixelRatio = calculateContentScenePixelRatio({
        devicePixelRatio,
        displayScale,
        deviceMemory: navigatorWithMemory.deviceMemory,
        hardwareConcurrency: navigatorWithMemory.hardwareConcurrency,
      });
      const backgroundPixelRatio = calculateScenePixelRatio({
        devicePixelRatio,
        displayScale,
        minimum: MIN_BACKGROUND_SCENE_PIXEL_RATIO,
        maximum: MAX_BACKGROUND_SCENE_PIXEL_RATIO,
      });
      const alignmentPixelRatio = calculateScenePixelRatio({
        devicePixelRatio,
        displayScale,
        minimum: MIN_ALIGNMENT_SCENE_PIXEL_RATIO,
        maximum: MAX_ALIGNMENT_SCENE_PIXEL_RATIO,
      });
      syncScenePixelRatio(backgroundLayerRef.current, backgroundPixelRatio);
      syncScenePixelRatio(contentLayerRef.current, contentPixelRatio);
      syncScenePixelRatio(alignmentGuideLayerRef.current, alignmentPixelRatio);
    };
    refreshPixelRatio();
    window.addEventListener("resize", refreshPixelRatio);
    return () => window.removeEventListener("resize", refreshPixelRatio);
  }, [alignmentGuideLayerRef, displayScale, isRenderActive]);

  const updateElement = useCallback(
    (
      elementSelection: ElementSelection,
      updater: (element: RawElement) => RawElement,
      pushHistory = true,
    ) => {
      commitUi(updateElementInUi(currentUiRef.current, elementSelection, updater), pushHistory);
    },
    [commitUi],
  );

  const closeChartEditor = useCallback(() => {
    setChartEditorSelection(null);
  }, []);

  const deleteComponentAtIndex = useCallback(
    (componentIndex: number) => {
      const components = [...readArray(currentUiRef.current.components)];
      if (componentIndex < 0 || componentIndex >= components.length) return;
      components.splice(componentIndex, 1);
      commitUi({ ...currentUiRef.current, components });
      setSelection(null);
      clearTableCellSelection();
      clearInlineEdit();
      setVectorEditSelection(null);
      setIconEditorSelection(null);
      closeChartEditor();
    },
    [
      clearInlineEdit,
      clearTableCellSelection,
      closeChartEditor,
      commitUi,
    ],
  );

  const deleteSelection = useCallback(() => {
    if (!selection) return;
    commitUi(deleteSelectionFromUi(currentUiRef.current, selection));
    setSelection(null);
    clearTableCellSelection();
    clearInlineEdit();
    setVectorEditSelection(null);
    setIconEditorSelection(null);
    closeChartEditor();
  }, [
    clearInlineEdit,
    clearTableCellSelection,
    closeChartEditor,
    commitUi,
    selection,
  ]);

  const createClipboardPayload = useCallback((): TemplateV2ClipboardPayload | null => {
    const clipboardComponent = componentForClipboardSelection(
      currentUiRef.current,
      selection,
    );
    return clipboardComponent
      ? createTemplateV2ClipboardPayload(
        clipboardComponent.components.map((item) => ({
          data: item.component,
          absoluteBox: item.box,
        })),
      )
      : null;
  }, [selection]);

  const pasteClipboardPayload = useCallback(
    (payload: TemplateV2ClipboardPayload, offset: number) => {
      const result = pasteTemplateV2ClipboardPayload({
        sourceUi: currentUiRef.current,
        payload,
        offset,
      });
      if (!result) return;
      commitUi(result.ui);
      setSelection(result.selection);
      clearTableCellSelection();
      clearInlineEdit();
      setVectorEditSelection(null);
      setIconEditorSelection(null);
      activateSurface(result.selection);
    },
    [activateSurface, clearInlineEdit, clearTableCellSelection, commitUi],
  );

  const duplicateComponentAtIndex = useCallback(
    (componentIndex: number) => {
      const clipboardComponent = componentForClipboardSelection(
        currentUiRef.current,
        { kind: "component", componentIndex },
      );
      if (!clipboardComponent) return;
      pasteClipboardPayload(
        createTemplateV2ClipboardPayload(
          clipboardComponent.components.map((item) => ({
            data: item.component,
            absoluteBox: item.box,
          })),
        ),
        16,
      );
    },
    [pasteClipboardPayload],
  );

  const duplicateSelection = useCallback(() => {
    const payload = createClipboardPayload();
    if (!payload) return;
    pasteClipboardPayload(payload, 16);
  }, [createClipboardPayload, pasteClipboardPayload]);

  useTemplateV2Clipboard({
    enabled: isEditMode,
    isSurfaceActive,
    isEditableTarget,
    onCopy: createClipboardPayload,
    onPaste: pasteClipboardPayload,
  });

  const openInlineEditor = useCallback(
    (elementSelection: ElementSelection) => {
      const element = getElementAtSelection(currentUiRef.current, elementSelection);
      if (!element) return;
      clearTableCellEditing();
      setVectorEditSelection(null);
      const type = readString(element.type);
      const frame = renderedLocalBoxForElementSelection(
        currentUiRef.current,
        elementSelection,
      );
      if (type === "text") {
        const normalized = normalizeRawTextMarkdownElement(element);
        if (normalized.changed) {
          updateElement(elementSelection, () => normalized.element, false);
        }
        const style = rawTextStyle(normalized.element);
        const runs = wordWrappedTextRuns(normalized.runs);
        startInlineEdit({
          kind: "text",
          selection: elementSelection,
          draft: textRunsContent(runs),
          runs,
          frame: autoSizeInlineTextFrame(frame, runs, style),
          style,
        });
      } else if (type === "text-list") {
        const runs = wordWrappedTextRuns(rawTextListRunsForEditor(element));
        const style = rawTextStyle(element);
        const marker = readString(element.marker);
        const listMarker: Marker =
          marker === "number" || marker === "none" ? marker : "bullet";
        startInlineEdit({
          kind: "text-list",
          selection: elementSelection,
          draft: textRunsContent(runs),
          runs,
          listMarker,
          frame: autoSizeInlineTextFrame(frame, runs, style),
          style,
        });
      }
    },
    [clearTableCellEditing, startInlineEdit, updateElement],
  );

  const closeInlineEditor = useCallback(
    (commit = true, runsOverride?: TextRun[]) => {
      const current = inlineEdit;
      if (!current) return;
      if (commit) {
        const runs =
          current.kind === "text" || current.kind === "text-list"
            ? runsOverride ?? current.runs
            : current.runs;
        const style =
          (current.kind === "text" || current.kind === "text-list") &&
          current.style
            ? current.style
            : current.style;
        const frame =
          (current.kind === "text" || current.kind === "text-list") &&
          style &&
          runs
            ? autoSizeInlineTextFrame(current.frame, runs, style)
            : current.frame;
        commitUi(
          syncComponentHeightToElement(
            updateElementInUi(
              currentUiRef.current,
              current.selection,
              (element) =>
                elementWithInlineDraft(
                  element,
                  current.kind,
                  runsOverride
                    ? textRunsContent(runsOverride)
                    : current.draft,
                  style,
                  frame,
                  runs,
                ),
            ),
            current.selection,
          ),
        );
      }
      setSelection(current.selection);
      clearInlineEdit();
      setVectorEditSelection(null);
    },
    [clearInlineEdit, commitUi, inlineEdit],
  );

  const commitInlineTextRuns = useCallback(
    (elementSelection: ElementSelection, runs: TextRun[]) => {
      updateInlineEdit(elementSelection, (active) => {
        if (active.kind !== "text" && active.kind !== "text-list") {
          return active;
        }
        const nextRuns = wordWrappedTextRuns(runs);
        const style = active.style
          ? active.style
          : undefined;
        return {
          ...active,
          draft: textRunsContent(nextRuns),
          runs: nextRuns,
          style,
          frame:
            style != null
              ? autoSizeInlineTextFrame(active.frame, nextRuns, style)
              : active.frame,
        };
      });
    },
    [updateInlineEdit],
  );

  const applyToolbarElementChange = useCallback(
    (editorElement: SlideElement) => {
      if (selection?.kind !== "element") return;
      const current = getElementAtSelection(currentUiRef.current, selection);
      const box = absoluteBoxForSelection(currentUiRef.current, selection);
      if (!current || !box) return;
      const next = mergeEditorToolbarElement(current, editorElement, box);
      updateElement(selection, () => next);
      updateInlineEdit(selection, (active) => {
        if (
          !active?.style ||
          keyForSelection(active.selection) !== keyForSelection(selection)
        ) {
          return active;
        }
        if (active.kind === "text") {
          const runs = wordWrappedTextRuns(rawTextRunsForEditor(next));
          const style = rawTextStyle(next);
          return {
            ...active,
            draft: rawTextContent(next),
            runs,
            style,
            frame: autoSizeInlineTextFrame(active.frame, runs, style),
          };
        }
        if (active.kind === "text-list") {
          const runs = wordWrappedTextRuns(rawTextListRunsForEditor(next));
          const style = rawTextStyle(next);
          return {
            ...active,
            draft: textRunsContent(runs),
            runs,
            style,
            frame: autoSizeInlineTextFrame(active.frame, runs, style),
          };
        }
        return { ...active, style: rawTextStyle(next) };
      });
    },
    [selection, updateElement, updateInlineEdit],
  );

  const applyLayoutElementChange = useCallback(
    (changes: Record<string, unknown>) => {
      if (!layoutToolbarTarget) return;
      if (
        layoutToolbarTarget.selection.componentIndex ===
        ROOT_ELEMENTS_COMPONENT_INDEX
      ) {
        const updatedRoot = updateComponentLayoutElement(
          rootElementsComponent(currentUiRef.current),
          layoutToolbarTarget.selection.elementPath,
          changes,
          layoutToolbarTarget.box,
          {
            childrenBounds,
            elementBox,
            elementSize,
            isManualPositioned,
            normalizeLayoutChildren: elementWithNormalizedLayoutChildren,
          },
        );
        commitUi({
          ...currentUiRef.current,
          elements: readArray(updatedRoot.elements),
        });
        return;
      }
      updateComponent(layoutToolbarTarget.selection.componentIndex, (component) =>
        updateComponentLayoutElement(
          component,
          layoutToolbarTarget.selection.elementPath,
          changes,
          layoutToolbarTarget.box,
          {
            childrenBounds,
            elementBox,
            elementSize,
            isManualPositioned,
            normalizeLayoutChildren: elementWithNormalizedLayoutChildren,
          },
        ),
      );
    },
    [commitUi, layoutToolbarTarget, updateComponent],
  );

  const applyChartToolbarElementChange = useCallback(
    (editorElement: ChartSlideElement) => {
      if (!chartToolbarTarget) return;
      const current = getElementAtSelection(
        currentUiRef.current,
        chartToolbarTarget.selection,
      );
      const box = absoluteBoxForSelection(
        currentUiRef.current,
        chartToolbarTarget.selection,
      );
      if (!current || !box) return;
      const next = mergeEditorToolbarElement(current, editorElement, box);
      updateElement(chartToolbarTarget.selection, () => next);
    },
    [chartToolbarTarget, updateElement],
  );

  const applyTableToolbarElementChange = useCallback(
    (editorElement: TableSlideElement) => {
      if (!tableToolbarTarget) return;
      const current = getElementAtSelection(
        currentUiRef.current,
        tableToolbarTarget.selection,
      );
      const box = absoluteBoxForSelection(
        currentUiRef.current,
        tableToolbarTarget.selection,
      );
      if (!current || !box) return;
      const next = mergeEditorToolbarElement(current, editorElement, box);
      updateElement(tableToolbarTarget.selection, () => next);
    },
    [tableToolbarTarget, updateElement],
  );

  const applyEditorToolbarTargetElementChange = useCallback(
    (editorElement: SlideElement) => {
      if (!editorToolbarTarget) return;
      const current = getElementAtSelection(
        currentUiRef.current,
        editorToolbarTarget.selection,
      );
      const box = absoluteBoxForSelection(
        currentUiRef.current,
        editorToolbarTarget.selection,
      );
      if (!current || !box) return;
      const next = mergeEditorToolbarElement(current, editorElement, box);
      updateElement(editorToolbarTarget.selection, () => next);
    },
    [editorToolbarTarget, updateElement],
  );

  const groupSelectedComponents = useCallback(() => {
    const currentSelection = selectionRef.current;
    if (currentSelection?.kind !== "multi-component") return false;
    const result = groupTemplateV2ComponentsInUi(
      currentUiRef.current,
      currentSelection.componentIndexes,
      { componentBox },
    );
    if (!result) return false;

    commitUi(result.ui as RawUi);
    selectionRef.current = result.selection;
    setSelection(result.selection);
    activateSurface(result.selection);
    clearInlineEdit();
    clearTableCellSelection();
    setVectorEditSelection(null);
    setIconEditorSelection(null);
    setChartEditorSelection(null);
    return true;
  }, [
    activateSurface,
    clearInlineEdit,
    clearTableCellSelection,
    commitUi,
  ]);

  const ungroupComponentAtIndex = useCallback((componentIndex: number) => {
    if (componentIndex < 0) return;
    const component = asRecord(
      readArray(currentUiRef.current.components)[componentIndex],
    );
    if (!canUngroupTemplateV2Component(component)) return;
    const result = ungroupTemplateV2ComponentInUi(
      currentUiRef.current,
      componentIndex,
      {
        childArrayInfo,
        componentBox,
        elementBox,
        layoutChildren,
      },
    );
    if (!result) return;
    commitUi(result.ui as RawUi);
    selectionRef.current = result.selection;
    setSelection(result.selection);
    activateSurface(result.selection);
    clearInlineEdit();
    clearTableCellSelection();
    setVectorEditSelection(null);
    setIconEditorSelection(null);
  }, [
    activateSurface,
    clearInlineEdit,
    clearTableCellSelection,
    commitUi,
  ]);

  const ungroupSelectedComponent = useCallback(() => {
    if (selection?.kind !== "component") return;
    ungroupComponentAtIndex(selection.componentIndex);
  }, [selection, ungroupComponentAtIndex]);

  const ungroupLayoutTargetComponent = useCallback(() => {
    const componentIndex = layoutToolbarTarget?.selection.componentIndex;
    if (componentIndex == null || componentIndex < 0) return;
    ungroupComponentAtIndex(componentIndex);
  }, [layoutToolbarTarget, ungroupComponentAtIndex]);

  const reorderComponentLayerAtIndex = useCallback(
    (componentIndex: number, action: ComponentLayerAction) => {
      const result = reorderComponentLayer(
        readArray(currentUiRef.current.components),
        componentIndex,
        action,
      );
      if (!result) return;
      const nextSelection: ComponentSelection = {
        kind: "component",
        componentIndex: result.componentIndex,
      };
      commitUi({
        ...currentUiRef.current,
        components: result.components,
      });
      setSelection(nextSelection);
      clearTableCellSelection();
      clearInlineEdit();
      setVectorEditSelection(null);
      setIconEditorSelection(null);
      activateSurface(nextSelection);
    },
    [
      activateSurface,
      clearInlineEdit,
      clearTableCellSelection,
      commitUi,
    ],
  );

  const reorderSelectedComponentLayer = useCallback(
    (action: ComponentLayerAction) => {
      if (selection?.kind !== "component") return;
      reorderComponentLayerAtIndex(selection.componentIndex, action);
    },
    [reorderComponentLayerAtIndex, selection],
  );

  const targetComponentActions =
    useMemo<TemplateV2SelectionComponentActions | null>(() => {
      const componentIndex =
        tableToolbarTarget?.selection.componentIndex ??
        chartToolbarTarget?.selection.componentIndex;
      if (componentIndex == null || componentIndex < 0) return null;
      const component = asRecord(readArray(uiDraft.components)[componentIndex]);
      return {
        canUngroup: canUngroupTemplateV2Component(component),
        componentCount: components.length,
        componentIndex,
        onDelete: () => deleteComponentAtIndex(componentIndex),
        onDuplicate: () => duplicateComponentAtIndex(componentIndex),
        onLayerAction: (action: ComponentLayerAction) =>
          reorderComponentLayerAtIndex(componentIndex, action),
        onUngroup: () => ungroupComponentAtIndex(componentIndex),
      };
    }, [
      chartToolbarTarget,
      components.length,
      deleteComponentAtIndex,
      duplicateComponentAtIndex,
      reorderComponentLayerAtIndex,
      tableToolbarTarget,
      uiDraft.components,
      ungroupComponentAtIndex,
    ]);

  const openImageUpload = useCallback(
    (elementSelection: ElementSelection) => {
      const element = getElementAtSelection(currentUiRef.current, elementSelection);
      if (readString(element?.type) !== "image") return;
      activateSurface(elementSelection);
      pendingImageUploadRef.current = elementSelection;
      if (imageUploadInputRef.current) {
        imageUploadInputRef.current.value = "";
        imageUploadInputRef.current.click();
      }
    },
    [activateSurface],
  );

  const openIconEditor = useCallback(
    (elementSelection: ElementSelection) => {
      const element = getElementAtSelection(
        currentUiRef.current,
        elementSelection,
      );
      if (!element || !isRawIconElement(element)) {
        return;
      }
      activateSurface(elementSelection);
      setSelection(elementSelection);
      clearInlineEdit();
      setVectorEditSelection(null);
      setIconEditorSelection(elementSelection);
    },
    [activateSurface, clearInlineEdit],
  );

  const handleIconChange = useCallback(
    (newIconUrl: string, query?: string) => {
      if (!iconEditorSelection || !newIconUrl) return;
      updateElement(iconEditorSelection, (element) => ({
        ...element,
        data: newIconUrl,
        ...(query ? { icon_query: query } : {}),
      }));
    },
    [iconEditorSelection, updateElement],
  );

  const openChartEditor = useCallback(
    (elementSelection: ElementSelection) => {
      const element = getElementAtSelection(currentUiRef.current, elementSelection);
      if (!element || readString(element.type) !== "chart") return;
      activateSurface(elementSelection);
      setSelection(elementSelection);
      clearInlineEdit();
      setVectorEditSelection(null);
      setIconEditorSelection(null);
      setChartEditorSelection(elementSelection);
    },
    [activateSurface, clearInlineEdit],
  );

  const handleImageUploadChange = useCallback(
    async (event: ReactChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      const target = pendingImageUploadRef.current;
      if (!file || !target) return;

      if (!file.type.startsWith("image/")) {
        notify.warning("Tệp không hợp lệ", "Vui lòng tải lên tệp ảnh.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        notify.warning("Tệp quá lớn", "Tệp ảnh phải nhỏ hơn 5 MB.");
        return;
      }

      try {
        setIsUploadingImage(true);
        const uploaded = await ImagesApi.uploadImage(file);
        const imageUrl = resolveBackendAssetSource(uploaded);
        if (!imageUrl) throw new Error("Không thể tải ảnh lên.");
        updateElement(target, (element) => ({
          ...element,
          data: imageUrl,
          name: file.name,
          focus_x: 50,
          focus_y: 50,
          crop_scale: null,
        }));
        notify.success("Đã cập nhật ảnh", "Ảnh đã chọn đã được thay thế.");
      } catch (error) {
        notify.error(
          "Tải ảnh thất bại",
          error instanceof Error
            ? error.message
            : "Không thể tải ảnh lên. Vui lòng thử lại.",
        );
      } finally {
        pendingImageUploadRef.current = null;
        setIsUploadingImage(false);
      }
    },
    [updateElement],
  );

  const handleElementDoubleClick = useCallback(
    (elementSelection: ElementSelection) => {
      const element = getElementAtSelection(currentUiRef.current, elementSelection);
      const type = readString(element?.type);
      if (type === "image") {
        return;
      }
      if (type === "chart") {
        openChartEditor(elementSelection);
        return;
      }
      if (isVectorType(type)) {
        activateSurface(elementSelection);
        setSelection(elementSelection);
        clearTableCellSelection();
        clearTableCellEditing();
        clearInlineEdit();
        setIconEditorSelection(null);
        setChartEditorSelection(null);
        setVectorEditSelection(
          canEditVectorPointsForSelection(currentUiRef.current, elementSelection)
            ? elementSelection
            : null,
        );
        return;
      }
      openInlineEditor(elementSelection);
    },
    [
      activateSurface,
      clearInlineEdit,
      clearTableCellEditing,
      clearTableCellSelection,
      openChartEditor,
      openInlineEditor,
    ],
  );

  useEffect(() => {
    if (!isEditMode || typeof window === "undefined") return;

    const handleInsertElements = (event: Event) => {
      const detail = (event as CustomEvent<TemplateV2InsertElementsDetail>).detail;
      const elements = detail?.elements ?? [];
      const insertedComponents = detail?.components ?? [];
      if (elements.length === 0 && insertedComponents.length === 0) return;
      if (!eventTargetsThisSlide(detail, slideId, surfaceSlideIndex, isSurfaceActive)) {
        return;
      }

      const nextIndex = readArray(currentUiRef.current.components).length;
      const nextUi = appendInsertedContent(
        currentUiRef.current,
        elements as unknown as UnknownRecord[],
        insertedComponents as unknown as UnknownRecord[],
        detail.label,
        detail.preserveComponentData,
      );
      const insertedCount = elements.length + insertedComponents.length;
      const nextSelection =
        insertedCount > 1
          ? selectionForComponentIndexes(
              Array.from(
                { length: insertedCount },
                (_, offset) => nextIndex + offset,
              ),
            )
          : selectionForInsertedComponent(nextUi, nextIndex);
      commitUi(nextUi);
      setSelection(nextSelection);
      setVectorEditSelection(
        nextSelection?.kind === "element" ? nextSelection : null,
      );
      detail.handled = true;
    };

    window.addEventListener(TEMPLATE_V2_INSERT_ELEMENTS_EVENT, handleInsertElements);
    return () =>
      window.removeEventListener(
        TEMPLATE_V2_INSERT_ELEMENTS_EVENT,
        handleInsertElements,
      );
  }, [commitUi, isEditMode, isSurfaceActive, slideId, surfaceSlideIndex]);

  useEffect(() => {
    if (!isRenderActive || !isEditMode || typeof document === "undefined") {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      const targetNode = event.target instanceof Node ? event.target : null;
      const target = event.target instanceof Element ? event.target : null;
      if (
        target?.closest(
          "[data-template-v2-floating-toolbar='true'], [data-inline-edit-ignore='true']",
        )
      ) {
        if (isSurfaceActive()) {
          activateSurface();
        }
        return;
      }
      if (targetNode && root?.contains(targetNode)) {
        activateSurface();
        return;
      }

      clearEditorUiState({ clearActiveSurface: true });
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      clearSurface();
    };
  }, [
    activateSurface,
    clearEditorUiState,
    clearSurface,
    isEditMode,
    isRenderActive,
    isSurfaceActive,
  ]);

  useTemplateV2Keyboard({
    enabled: isRenderActive && isEditMode,
    isSurfaceActive,
    selection,
    selectionRef,
    groupSelectedComponents,
    reorderComponentLayerAtIndex,
    deleteSelection,
    undo,
    redo,
  });

  if (!uiDraft) {
    return (
      <div className="flex h-full aspect-video flex-col items-center justify-center rounded-lg bg-[var(--gslide-accent-soft)]">
        <Loader2 className="mb-2 h-4 w-4 animate-spin text-[var(--gslide-accent)]" />
        <p className="text-center text-sm text-[var(--gslide-muted)]">{"Đang tải bố cục slide…"}</p>
      </div>
    );
  }

  return (
    <div
      ref={setRootNode}
      data-template-v2-konva-surface={surfaceId}
      className="relative h-full w-full overflow-hidden bg-white"
      style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}
      onPointerDown={() => activateSurface()}
    >
      {isRenderActive ? (
        <TemplateV2KonvaStage
          isEditMode={isEditMode}
          uiDraft={uiDraft}
          rootElements={rootElements}
          components={components}
          editingKey={editingKey}
          vectorEditingKey={vectorEditingKey}
          visibleSelectedTableCell={visibleSelectedTableCell}
          selectedKey={selectedKey}
          selectedKeys={selectedKeys}
          selectedComponentIndexes={selectedComponentIndexes}
          selectedComponentIndexSet={selectedComponentIndexSet}
          selectionKind={selection?.kind ?? null}
          selectedTableCell={selectedTableCell}
          inlineEdit={inlineEdit}
          imageCropActive={imageCropActive}
          selectedElement={selectedElement}
          selectedIsImageElement={selectedIsImageElement}
          selectedIsVectorElement={selectedIsVectorElement}
          selectedCanEditVectorPoints={selectedCanEditVectorPoints}
          selectedIsVectorPointEditing={selectedIsVectorPointEditing}
          transformerParentComponentKey={transformerParentComponentKey}
          horizontalResizeOnly={horizontalResizeOnly}
          fontRevision={fontLoadState.revision}
          effectiveDisplayScale={effectiveDisplayScale}
          selectorEnabled={selectorEnabled}
          rootElement={rootElement}
          nodeRefs={nodeRefs}
          backgroundLayerRef={backgroundLayerRef}
          contentLayerRef={contentLayerRef}
          alignmentGuideLayerRef={alignmentGuideLayerRef}
          verticalAlignmentGuideRef={verticalAlignmentGuideRef}
          horizontalAlignmentGuideRef={horizontalAlignmentGuideRef}
          verticalAlignmentGuideHaloRef={verticalAlignmentGuideHaloRef}
          horizontalAlignmentGuideHaloRef={horizontalAlignmentGuideHaloRef}
          hoveredKonvaNodeRef={hoveredKonvaNodeRef}
          setSelectionNodeRef={setSelectionNodeRef}
          onSelect={select}
          onTableCellSelect={selectTableCell}
          onTableCellEdit={editTableCell}
          onOpenEditor={handleElementDoubleClick}
          onElementChange={updateElement}
          onComponentChange={updateComponent}
          onElementDragStart={handleElementAlignmentDragStart}
          onElementDragMove={handleElementAlignmentDragMove}
          onElementDragComplete={handleElementAlignmentDragComplete}
          onComponentDragStart={handleComponentDragStart}
          onComponentDragMove={handleComponentDragMove}
          onComponentDragEnd={handleComponentDragEnd}
          onActivateSurface={activateSurface}
          onClearEditorUiState={clearEditorUiState}
          onHoverSelectionRectChange={setHoverSelectionRect}
        />
      ) : null}
      <TemplateV2KonvaOverlays
        isEditMode={isEditMode}
        imageUploadInputRef={imageUploadInputRef}
        onImageUploadChange={handleImageUploadChange}
        selectorEnabled={selectorEnabled}
        hoverSelectionRect={hoverSelectionRect}
        floatingToolbarAnchorBox={floatingToolbarAnchorBox}
        canUngroupSelectedComponent={canUngroupSelectedComponent}
        canUngroupLayoutTargetComponent={canUngroupLayoutTargetComponent}
        chartToolbarTarget={chartToolbarTarget}
        componentsLength={components.length}
        editorToolbarTarget={editorToolbarTarget}
        layoutToolbarTarget={layoutToolbarTarget}
        selectionToolbarPosition={selectionToolbarPosition}
        toolbarSelectedTableCell={toolbarSelectedTableCell}
        selection={selection}
        tableToolbarTarget={tableToolbarTarget}
        targetComponentActions={targetComponentActions}
        templateFonts={templateFonts}
        selectionToolbarBounds={selectionToolbarBounds}
        selectedElement={selectedElement}
        selectedBox={selectedBox}
        toolbarElement={toolbarElement}
        selectedTableCell={selectedTableCell}
        editingTableCell={editingTableCell}
        inlineEdit={inlineEdit}
        inlineEditBox={inlineEditBox}
        chartEditorSelection={chartEditorSelection}
        chartEditorChart={chartEditorChart}
        iconEditorSelection={iconEditorSelection}
        iconEditorElement={iconEditorElement}
        isUploadingImage={isUploadingImage}
        onChartChange={applyChartToolbarElementChange}
        onChartEdit={() => {
          if (chartToolbarTarget) {
            openChartEditor(chartToolbarTarget.selection);
          }
        }}
        onDeleteSelection={deleteSelection}
        onDuplicateSelection={duplicateSelection}
        onEditorChange={applyEditorToolbarTargetElementChange}
        onImageCropModeChange={setImageCropActive}
        onIconEdit={() => {
          if (editorToolbarTarget) {
            openIconEditor(editorToolbarTarget.selection);
          }
        }}
        onLayoutChange={applyLayoutElementChange}
        onLayerAction={reorderSelectedComponentLayer}
        onGroupSelection={groupSelectedComponents}
        onTableChange={applyTableToolbarElementChange}
        onUngroupComponent={ungroupSelectedComponent}
        onUngroupLayoutTarget={ungroupLayoutTargetComponent}
        onToolbarElementChange={applyToolbarElementChange}
        onOpenIconEditor={openIconEditor}
        onOpenImageUpload={openImageUpload}
        onOpenInlineEditor={openInlineEditor}
        onTableEditorClose={clearTableCellEditing}
        onInlineDraftChange={updateInlineDraft}
        onInlineSelectionChange={updateInlineTextSelectionRange}
        onInlineRunsChange={commitInlineTextRuns}
        onInlineClose={closeInlineEditor}
        onChartEditorChange={(chart) => {
          if (!chartEditorSelection) return;
          updateElement(chartEditorSelection, (element) =>
            editorChartToRawChart(
              element,
              chart as unknown as UnknownRecord,
            ),
          );
        }}
        onChartEditorClose={closeChartEditor}
        onIconEditorClose={() => setIconEditorSelection(null)}
        onIconChange={handleIconChange}
      />
    </div>
  );
}

export const TemplateV2KonvaSlide = memo(TemplateV2KonvaSlideComponent);
TemplateV2KonvaSlide.displayName = "TemplateV2KonvaSlide";
