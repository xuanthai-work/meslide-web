"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
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

const ARROW_NUDGE_DELTAS: Record<string, { dx: number; dy: number }> = {
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
};

export function arrowNudgeDelta(
  key: string,
  shiftKey: boolean,
): { dx: number; dy: number } | null {
  const delta = ARROW_NUDGE_DELTAS[key];
  if (!delta) return null;
  const step = shiftKey ? 10 : 1;
  return { dx: delta.dx * step, dy: delta.dy * step };
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
  onNudge,
  isInlineEditing,
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
  onNudge?: (dx: number, dy: number, pushHistory: boolean) => void;
  isInlineEditing?: () => boolean;
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

  const isNudgingRef = useRef(false);

  useEffect(() => {
    if (!enabled || typeof document === "undefined" || !onNudge) {
      return;
    }

    const handleArrowKeyDown = (event: KeyboardEvent) => {
      const delta = arrowNudgeDelta(event.key, event.shiftKey);
      if (!delta) return;
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditableTarget(event.target) ||
        isInlineEditing?.() ||
        !isSurfaceActive()
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      // The first press of a hold records history; auto-repeat presses only
      // update the position so Ctrl+Z returns to the pre-nudge spot in one step.
      const pushHistory = !isNudgingRef.current;
      isNudgingRef.current = true;
      onNudge(delta.dx, delta.dy, pushHistory);
    };

    const handleArrowKeyUp = (event: KeyboardEvent) => {
      if (!ARROW_NUDGE_DELTAS[event.key]) return;
      isNudgingRef.current = false;
    };

    document.addEventListener("keydown", handleArrowKeyDown, true);
    document.addEventListener("keyup", handleArrowKeyUp, true);
    return () => {
      document.removeEventListener("keydown", handleArrowKeyDown, true);
      document.removeEventListener("keyup", handleArrowKeyUp, true);
      isNudgingRef.current = false;
    };
  }, [enabled, isInlineEditing, isSurfaceActive, onNudge]);
}
