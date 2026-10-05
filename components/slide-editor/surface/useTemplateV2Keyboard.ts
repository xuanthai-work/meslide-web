"use client";

import { useEffect, type MutableRefObject } from "react";
import { isTemplateV2GroupShortcut } from "@/components/slide-editor/model/template-v2-group";
import {
  isEditableTarget,
  ROOT_ELEMENTS_COMPONENT_INDEX,
  type Selection,
} from "@/components/slide-editor/model/model";
import {
  componentLayerActionForShortcut,
  type ComponentLayerAction,
} from "@/components/slide-editor/selection/layering";

export function componentIndexForLayerShortcut(selection: Selection) {
  if (!selection) return null;
  if (selection.kind !== "component" && selection.kind !== "element") {
    return null;
  }
  if (selection.componentIndex === ROOT_ELEMENTS_COMPONENT_INDEX) return null;
  return selection.componentIndex;
}

export function useTemplateV2Keyboard({
  enabled,
  isSurfaceActive,
  selection,
  selectionRef,
  groupSelectedComponents,
  reorderComponentLayerAtIndex,
  deleteSelection,
  undo,
  redo,
}: {
  enabled: boolean;
  isSurfaceActive: () => boolean;
  selection: Selection;
  selectionRef: MutableRefObject<Selection>;
  groupSelectedComponents: () => void;
  reorderComponentLayerAtIndex: (
    componentIndex: number,
    action: ComponentLayerAction,
  ) => void;
  deleteSelection: () => void;
  undo: () => void;
  redo: () => void;
}) {
  useEffect(() => {
    if (!enabled || typeof document === "undefined") {
      return;
    }

    const handleGroupShortcut = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        !isSurfaceActive() ||
        isEditableTarget(event.target) ||
        !isTemplateV2GroupShortcut(event)
      ) {
        return;
      }
      if (selectionRef.current?.kind !== "multi-component") return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      groupSelectedComponents();
    };

    document.addEventListener("keydown", handleGroupShortcut, true);
    return () =>
      document.removeEventListener("keydown", handleGroupShortcut, true);
  }, [enabled, groupSelectedComponents, isSurfaceActive, selectionRef]);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") {
      return;
    }

    const handleLayerShortcut = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        !isSurfaceActive() ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      const action = componentLayerActionForShortcut(event);
      if (!action) return;

      const componentIndex = componentIndexForLayerShortcut(selectionRef.current);
      if (componentIndex == null) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      reorderComponentLayerAtIndex(componentIndex, action);
    };

    document.addEventListener("keydown", handleLayerShortcut, true);
    return () =>
      document.removeEventListener("keydown", handleLayerShortcut, true);
  }, [
    enabled,
    isSurfaceActive,
    reorderComponentLayerAtIndex,
    selectionRef,
  ]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        (event.key !== "Delete" && event.key !== "Backspace") ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }
      if (!selection) return;
      event.preventDefault();
      event.stopPropagation();
      deleteSelection();
    };
    // Capture Phase: khi có selection trên canvas, phím Delete/Backspace được
    // xử lý và triệt tiêu ngay lập tức, không lọt tới listener window khác
    // (ví dụ listener xóa slide trong SidePanel).
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [deleteSelection, enabled, selection]);

  useEffect(() => {
    if (!enabled || typeof document === "undefined") {
      return;
    }

    const handleUndoRedoShortcut = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        !isSurfaceActive() ||
        isEditableTarget(event.target) ||
        !(event.metaKey || event.ctrlKey) ||
        event.altKey
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      const wantsUndo = key === "z" && !event.shiftKey;
      const wantsRedo = key === "y" || (key === "z" && event.shiftKey);
      if (!wantsUndo && !wantsRedo) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (wantsUndo) {
        undo();
        return;
      }
      redo();
    };

    document.addEventListener("keydown", handleUndoRedoShortcut, true);
    return () =>
      document.removeEventListener("keydown", handleUndoRedoShortcut, true);
  }, [enabled, isSurfaceActive, redo, undo]);
}
