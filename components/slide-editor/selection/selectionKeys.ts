import { ROOT_ELEMENTS_COMPONENT_INDEX } from "@/components/slide-editor/model/core";
import type {
  SelectOptions,
  Selection,
} from "@/components/slide-editor/model/core";

type SelectionModifierKeys = {
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
};

/**
 * True when a pointer event asks to extend the current selection instead of
 * replacing it. Shift has always been additive; Ctrl (Windows/Linux) and Cmd
 * (macOS) are accepted too so multi-component selection matches common editors.
 */
export function isAdditiveSelectionEvent(
  event: SelectionModifierKeys | null | undefined,
): boolean {
  return Boolean(event?.shiftKey || event?.ctrlKey || event?.metaKey);
}

export function keyForSelection(selection: Selection) {
  if (!selection) return "";
  if (selection.kind === "component") return `component:${selection.componentIndex}`;
  if (selection.kind === "multi-component") {
    return `multi-component:${selection.componentIndexes.join(".")}`;
  }
  return `element:${selection.componentIndex}:${selection.elementPath.join(".")}`;
}

export function keysForSelection(selection: Selection) {
  if (!selection) return [];
  if (selection.kind === "multi-component") {
    return selection.componentIndexes.map((componentIndex) =>
      keyForSelection({ kind: "component", componentIndex }),
    );
  }
  return [keyForSelection(selection)];
}

export function selectionWithComponentToggle(
  currentSelection: Selection,
  nextSelection: Selection,
  options?: SelectOptions,
): Selection {
  if (!options?.additive || nextSelection?.kind !== "component") {
    return nextSelection;
  }

  const componentIndex = nextSelection.componentIndex;
  const currentIndexes =
    currentSelection?.kind === "element" &&
    currentSelection.componentIndex !== ROOT_ELEMENTS_COMPONENT_INDEX
      ? [currentSelection.componentIndex]
      : componentIndexesForSelection(currentSelection);
  const nextIndexes = currentIndexes.includes(componentIndex)
    ? currentIndexes.filter((index) => index !== componentIndex)
    : [...currentIndexes, componentIndex];

  return selectionForComponentIndexes(nextIndexes);
}

export function componentIndexesForSelection(selection: Selection) {
  if (!selection) return [];
  if (selection.kind === "component") return [selection.componentIndex];
  if (selection.kind === "multi-component") return selection.componentIndexes;
  return [];
}

export function selectionForComponentIndexes(indexes: number[]): Selection {
  const uniqueIndexes = Array.from(
    new Set(indexes.filter((index) => Number.isInteger(index) && index >= 0)),
  );
  if (uniqueIndexes.length === 0) return null;
  if (uniqueIndexes.length === 1) {
    return { kind: "component", componentIndex: uniqueIndexes[0] };
  }
  return { kind: "multi-component", componentIndexes: uniqueIndexes };
}

export function selectionFromKey(key: string): Selection {
  if (key.startsWith("component:")) {
    const componentIndex = Number(key.split(":")[1]);
    return Number.isFinite(componentIndex)
      ? { kind: "component", componentIndex }
      : null;
  }
  if (key.startsWith("multi-component:")) {
    const componentIndexes = key
      .split(":")[1]
      ?.split(".")
      .map(Number)
      .filter((value) => Number.isInteger(value) && value >= 0) ?? [];
    return selectionForComponentIndexes(componentIndexes);
  }
  const [, component, path] = key.split(":");
  const componentIndex = Number(component);
  const elementPath = path
    ?.split(".")
    .map(Number)
    .filter((value) => Number.isFinite(value));
  if (!Number.isFinite(componentIndex) || !elementPath?.length) return null;
  return { kind: "element", componentIndex, elementPath };
}

export function selectionTouchesComponent(
  key: string | null,
  componentIndex: number,
) {
  return (
    key === `component:${componentIndex}` ||
    key?.startsWith(`element:${componentIndex}:`) === true
  );
}

export function selectionTouchesElement(
  key: string | null,
  componentIndex: number,
  elementPath: number[],
) {
  if (!key) return false;
  const ownKey = `element:${componentIndex}:${elementPath.join(".")}`;
  return key === ownKey || key.startsWith(`${ownKey}.`);
}

export function numberPathEqual(previous: number[], next: number[]) {
  return (
    previous.length === next.length &&
    previous.every((value, index) => value === next[index])
  );
}
