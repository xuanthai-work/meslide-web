"use client";

import {
  type ChangeEvent as ReactChangeEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import HtmlSelectionOverlay, {
  type HtmlSelectionRect,
} from "@/app/(presentation-generator)/components/HtmlSelectionOverlay";
import { ChartDataEditorPopover } from "@/components/slide-editor/charts/ChartEditorContent";
import IconsEditor from "@/components/slide-editor/images/IconsEditor";
import {
  isTemplateV2GroupElement,
  isTemplateV2LayoutElement,
  type TemplateV2SelectionComponentActions,
} from "@/components/slide-editor/layout/LayoutToolbar";
import { TemplateV2SelectionToolbar } from "@/components/slide-editor/selection/SelectionToolbar";
import type { ComponentLayerAction } from "@/components/slide-editor/selection/layering";
import type {
  TemplateV2ChartSelectionToolbarTarget,
  TemplateV2EditorSelectionToolbarTarget,
  TemplateV2SelectionToolbarTarget,
  TemplateV2TableSelectionToolbarTarget,
} from "@/components/slide-editor/selection/toolbarTarget";
import type { TemplateV2ToolbarViewportBounds } from "@/components/slide-editor/selection/toolbarPosition";
import type {
  ChartSlideElement,
  TableCellSelection,
  TableSlideElement,
} from "@/components/slide-editor/state/state";
import { TableInlineEditor } from "@/components/slide-editor/tables/TableInlineEditor";
import type { TemplateFontOption } from "@/components/slide-editor/text/google-fonts";
import { TemplateV2InlineEditor } from "@/components/slide-editor/text/TemplateV2InlineEditor";
import type {
  TemplateV2InlineEdit,
  TemplateV2InlineEditBox,
} from "@/components/slide-editor/text/template-v2-text-editing";
import type { TextSelectionRange } from "@/components/slide-editor/text/text-runs";
import { ElementToolbar } from "@/components/slide-editor/toolbar/ElementToolbar";
import type { ChartElement, SlideElement, TextRun } from "@/components/slide-editor/types";
import {
  isRawIconElement,
  keyForSelection,
  rawIconQuery,
  readString,
  type Box,
  type ElementSelection,
  type RawElement,
  type Selection,
  type UnknownRecord,
} from "@/components/slide-editor/model/model";

export type TemplateV2KonvaOverlaysProps = {
  isEditMode: boolean;
  imageUploadInputRef: RefObject<HTMLInputElement | null>;
  onImageUploadChange: (event: ReactChangeEvent<HTMLInputElement>) => void;
  selectorEnabled: boolean;
  hoverSelectionRect: HtmlSelectionRect | null;
  floatingToolbarAnchorBox: Box | null;
  canUngroupSelectedComponent: boolean;
  canUngroupLayoutTargetComponent: boolean;
  chartToolbarTarget: TemplateV2ChartSelectionToolbarTarget | null;
  componentsLength: number;
  editorToolbarTarget: TemplateV2EditorSelectionToolbarTarget | null;
  layoutToolbarTarget: TemplateV2SelectionToolbarTarget | null;
  selectionToolbarPosition: { left: number; top: number } | null;
  toolbarSelectedTableCell: TableCellSelection | null;
  selection: Selection | null;
  tableToolbarTarget: TemplateV2TableSelectionToolbarTarget | null;
  targetComponentActions: TemplateV2SelectionComponentActions | null;
  templateFonts?: TemplateFontOption[];
  selectionToolbarBounds: TemplateV2ToolbarViewportBounds | null;
  selectedElement: RawElement | null;
  selectedBox: Box | null;
  toolbarElement: SlideElement | null;
  selectedTableCell: TableCellSelection | null;
  editingTableCell: TableCellSelection | null;
  inlineEdit: TemplateV2InlineEdit<ElementSelection>;
  inlineEditBox: TemplateV2InlineEditBox | null;
  chartEditorSelection: ElementSelection | null;
  chartEditorChart: ChartElement | null;
  iconEditorSelection: ElementSelection | null;
  iconEditorElement: RawElement | null;
  isUploadingImage: boolean;
  onChartChange: (element: ChartSlideElement) => void;
  onChartEdit: () => void;
  onDeleteSelection: () => void;
  onDuplicateSelection: () => void;
  onEditorChange: (element: SlideElement) => void;
  onImageCropModeChange: (active: boolean) => void;
  onIconEdit: () => void;
  onLayoutChange: (changes: Record<string, unknown>) => void;
  onLayerAction: (action: ComponentLayerAction) => void;
  onGroupSelection: () => boolean | void;
  onTableChange: (element: TableSlideElement) => void;
  onUngroupComponent: () => void;
  onUngroupLayoutTarget: () => void;
  onToolbarElementChange: (element: SlideElement) => void;
  onOpenIconEditor: (selection: ElementSelection) => void;
  onOpenImageUpload: (selection: ElementSelection) => void;
  onOpenInlineEditor: (selection: ElementSelection) => void;
  onTableEditorClose: () => void;
  onInlineDraftChange: (draft: string) => void;
  onInlineSelectionChange: (
    selection: ElementSelection,
    range: TextSelectionRange | null,
  ) => void;
  onInlineRunsChange: (selection: ElementSelection, runs: TextRun[]) => void;
  onInlineClose: (commit: boolean, runs?: TextRun[]) => void;
  onChartEditorChange: (chart: ChartElement) => void;
  onChartEditorClose: () => void;
  onIconEditorClose: () => void;
  onIconChange: (newIconUrl: string, query?: string) => void;
};

export function TemplateV2KonvaOverlays({
  isEditMode,
  imageUploadInputRef,
  onImageUploadChange,
  selectorEnabled,
  hoverSelectionRect,
  floatingToolbarAnchorBox,
  canUngroupSelectedComponent,
  canUngroupLayoutTargetComponent,
  chartToolbarTarget,
  componentsLength,
  editorToolbarTarget,
  layoutToolbarTarget,
  selectionToolbarPosition,
  toolbarSelectedTableCell,
  selection,
  tableToolbarTarget,
  targetComponentActions,
  templateFonts,
  selectionToolbarBounds,
  selectedElement,
  selectedBox,
  toolbarElement,
  selectedTableCell,
  editingTableCell,
  inlineEdit,
  inlineEditBox,
  chartEditorSelection,
  chartEditorChart,
  iconEditorSelection,
  iconEditorElement,
  isUploadingImage,
  onChartChange,
  onChartEdit,
  onDeleteSelection,
  onDuplicateSelection,
  onEditorChange,
  onImageCropModeChange,
  onIconEdit,
  onLayoutChange,
  onLayerAction,
  onGroupSelection,
  onTableChange,
  onUngroupComponent,
  onUngroupLayoutTarget,
  onToolbarElementChange,
  onOpenIconEditor,
  onOpenImageUpload,
  onOpenInlineEditor,
  onTableEditorClose,
  onInlineDraftChange,
  onInlineSelectionChange,
  onInlineRunsChange,
  onInlineClose,
  onChartEditorChange,
  onChartEditorClose,
  onIconEditorClose,
  onIconChange,
}: TemplateV2KonvaOverlaysProps) {
  return (
    <>
      {isEditMode ? (
        <input
          ref={imageUploadInputRef}
          accept="image/*"
          className="hidden"
          type="file"
          onChange={onImageUploadChange}
        />
      ) : null}
      {selectorEnabled &&
        typeof document !== "undefined" &&
        createPortal(
          <HtmlSelectionOverlay
            hoverRect={hoverSelectionRect}
            selectionRect={null}
          />,
          document.body,
        )}
      <TemplateV2SelectionToolbar
        anchorBox={floatingToolbarAnchorBox}
        canUngroupComponent={canUngroupSelectedComponent}
        canUngroupLayoutTarget={canUngroupLayoutTargetComponent}
        chartTarget={chartToolbarTarget}
        componentCount={componentsLength}
        editorTarget={editorToolbarTarget}
        isEditMode={isEditMode}
        layoutTarget={layoutToolbarTarget}
        position={selectionToolbarPosition}
        selectedTableCell={toolbarSelectedTableCell}
        selection={selection}
        selectionKey={keyForSelection(selection)}
        tableTarget={tableToolbarTarget}
        targetComponentActions={targetComponentActions}
        templateFonts={templateFonts}
        toolbarBounds={selectionToolbarBounds}
        onChartChange={onChartChange}
        onChartEdit={onChartEdit}
        onDeleteSelection={onDeleteSelection}
        onDuplicateSelection={onDuplicateSelection}
        onEditorChange={onEditorChange}
        onImageCropModeChange={onImageCropModeChange}
        onIconEdit={onIconEdit}
        onLayoutChange={onLayoutChange}
        onLayerAction={onLayerAction}
        onGroupSelection={onGroupSelection}
        onTableChange={onTableChange}
        onUngroupComponent={onUngroupComponent}
        onUngroupLayoutTarget={onUngroupLayoutTarget}
      />
      {isEditMode &&
        selection?.kind === "element" &&
        selectedElement &&
        selectedBox &&
        toolbarElement &&
        !layoutToolbarTarget &&
        !chartToolbarTarget &&
        !tableToolbarTarget &&
        !isTemplateV2LayoutElement(selectedElement) &&
        !isTemplateV2GroupElement(selectedElement) &&
        !(editingTableCell && readString(selectedElement.type) === "table") ? (
        <ElementToolbar
          element={toolbarElement}
          index={selection.componentIndex}
          anchorBox={selectedBox}
          path={keyForSelection(selection)}
          scale={1}
          selectedTableCell={selectedTableCell}
          templateFonts={templateFonts}
          textSelectionRange={
            inlineEdit &&
              (inlineEdit.kind === "text" || inlineEdit.kind === "text-list") &&
              keyForSelection(inlineEdit.selection) === keyForSelection(selection)
              ? inlineEdit.textSelectionRange
              : null
          }
          onChange={(_index, element) => onToolbarElementChange(element)}
          onImageCropModeChange={onImageCropModeChange}
          onEditIcon={() => onOpenIconEditor(selection)}
          onEditImage={() => onOpenImageUpload(selection)}
          onEditText={() => onOpenInlineEditor(selection)}
        />
      ) : null}
      {isEditMode &&
        selection?.kind === "element" &&
        editingTableCell &&
        toolbarElement &&
        readString((toolbarElement as UnknownRecord).type) === "table" ? (
        <TableInlineEditor
          key={`${keyForSelection(selection)}:${editingTableCell.rowIndex}:${editingTableCell.colIndex}`}
          element={toolbarElement as TableSlideElement}
          index={selection.componentIndex}
          scale={1}
          selectedCell={editingTableCell}
          templateFonts={templateFonts}
          onChange={(_index, element) => onToolbarElementChange(element)}
          onClose={onTableEditorClose}
        />
      ) : null}
      {isEditMode && inlineEdit && inlineEditBox ? (
        <TemplateV2InlineEditor
          key={keyForSelection(inlineEdit.selection)}
          draft={inlineEdit.draft}
          kind={inlineEdit.kind}
          listMarker={inlineEdit.listMarker}
          box={inlineEditBox}
          runs={inlineEdit.runs}
          style={inlineEdit.style}
          fontScale={inlineEdit.fontScale}
          onChange={onInlineDraftChange}
          onSelectionChange={(textSelectionRange) =>
            onInlineSelectionChange(
              inlineEdit.selection,
              textSelectionRange,
            )
          }
          onRunsChange={(runs) =>
            onInlineRunsChange(inlineEdit.selection, runs)
          }
          onClose={(commit, runs) => onInlineClose(commit, runs)}
        />
      ) : null}
      {isEditMode &&
        chartEditorSelection &&
        chartEditorChart ? (
        <ChartDataEditorPopover
          key={keyForSelection(chartEditorSelection)}
          chart={chartEditorChart}
          chartPath={keyForSelection(chartEditorSelection)}
          onChange={onChartEditorChange}
          onClose={onChartEditorClose}
        />
      ) : null}
      {isEditMode &&
        iconEditorSelection &&
        iconEditorElement &&
        isRawIconElement(iconEditorElement) ? (
        <IconsEditor
          key={keyForSelection(iconEditorSelection)}
          icon_prompt={[rawIconQuery(iconEditorElement)]}
          currentIconUrl={readString(iconEditorElement.data) ?? ""}
          onClose={onIconEditorClose}
          onIconChange={onIconChange}
        />
      ) : null}
      {isUploadingImage ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/35">
          <div className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-medium text-[#191919] shadow-md">
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading image...
          </div>
        </div>
      ) : null}
    </>
  );
}
