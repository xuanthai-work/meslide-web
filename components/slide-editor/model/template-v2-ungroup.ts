type RawRecord = Record<string, any>;

export type TemplateV2UngroupBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ChildArrayInfo = {
  items: unknown[];
};

type LaidOutChild = {
  child: RawRecord;
  box: TemplateV2UngroupBox | null;
};

type UngroupEntry = {
  element: RawRecord;
  box: TemplateV2UngroupBox;
  rotation: number;
  sourceBox: TemplateV2UngroupBox;
  /** True for the preserved card background generated while ungrouping. */
  isBackground?: boolean;
};

type UngroupDeps = {
  childArrayInfo: (element: RawRecord) => ChildArrayInfo | null;
  componentBox: (component: RawRecord) => TemplateV2UngroupBox;
  elementBox: (element: RawRecord) => TemplateV2UngroupBox;
  layoutChildren: (
    parent: RawRecord,
    children: unknown[],
    parentBox: TemplateV2UngroupBox,
  ) => LaidOutChild[];
};

/** Minimum breathing room between two vertically stacked text components. */
export const MIN_STACK_GAP = 12;

export type TemplateV2UngroupSelection = {
  kind: "component";
  componentIndex: number;
} | null;

export function canUngroupTemplateV2Component(
  component: RawRecord | null | undefined,
) {
  if (!component) return false;
  const elements = readArray(component.elements).filter(isRecord);
  if (elements.length > 1) return true;
  return elements.some(hasUngroupableLayout);
}

export function ungroupTemplateV2ComponentInUi(
  sourceUi: RawRecord,
  componentIndex: number,
  deps: UngroupDeps,
  enforceStackGap = false,
): { ui: RawRecord; selection: TemplateV2UngroupSelection } | null {
  const components = [...readArray(sourceUi.components)];
  const component = asRecord(components[componentIndex]);
  if (!component || !canUngroupTemplateV2Component(component)) return null;

  const ungroupedComponents = ungroupedComponentsFromComponent(
    component,
    componentIndex,
    deps,
    enforceStackGap,
  );
  if (ungroupedComponents.length === 0) return null;

  components.splice(componentIndex, 1, ...ungroupedComponents);
  return {
    ui: {
      ...sourceUi,
      components,
    },
    selection: null,
  };
}

/**
 * A component is auto-ungroupable when loading it into the editor should give
 * the user one independent box per authored item instead of a single sticky
 * group. This covers text stacks (headings/paragraphs), flow layouts that hold
 * repeated items (flex/grid/list-view card grids), and components authored with
 * several top-level elements. Only one level is split: the contents of each
 * item stay intact inside its own component.
 */
export function isAutoUngroupableComponent(component: RawRecord): boolean {
  if (!canUngroupTemplateV2Component(component)) return false;

  // 1. Text-only stacks (title + subtitle + paragraph).
  if (isTextOnlyComponent(component)) return true;

  const elements = readArray(component.elements).filter(isRecord);

  // 2. A single flow layout holding repeated items (card grids, lists).
  if (elements.length === 1) {
    const element = elements[0];
    if (isFlowLayoutType(readString(element.type))) {
      const childInfo = childArrayInfoFromRecord(element);
      const children = (childInfo?.items ?? []).filter(isRecord);
      return children.length > 1;
    }
  }

  // 3. Several independent top-level elements.
  if (elements.length > 1) return true;

  return false;
}

/**
 * Ungroups every component that should be split when a slide is loaded into
 * the editor (see {@link isAutoUngroupableComponent}) into one component per
 * authored item. Text stacks keep the vertical gap guard so a taller heading
 * never overlaps the paragraph below it; card/flow layouts keep the exact
 * coordinates computed by the layout so horizontal gaps stay untouched.
 */
export function autoUngroupComponents(
  sourceUi: RawRecord,
  deps: UngroupDeps,
): RawRecord {
  let ui = sourceUi;
  let index = 0;
  while (index < readArray(ui.components).length) {
    const component = asRecord(readArray(ui.components)[index]);
    if (component && isAutoUngroupableComponent(component)) {
      const isTextStack = isTextOnlyComponent(component);
      const before = readArray(ui.components).length;
      const result = ungroupTemplateV2ComponentInUi(ui, index, deps, isTextStack);
      if (result) {
        const created = readArray(result.ui.components).length - before + 1;
        ui = result.ui;
        if (isTextStack) {
          // Re-check the components spliced in at this index: a nested text
          // container is flattened on the following passes.
          continue;
        }
        // Card/flow items are split one level only. Skip past the new
        // components so their inner structure is preserved.
        index += created;
        continue;
      }
    }
    index += 1;
  }
  return ui;
}

/** @deprecated Use {@link autoUngroupComponents}; kept for compatibility. */
export const autoUngroupTextComponents = autoUngroupComponents;

function isTextOnlyComponent(component: RawRecord): boolean {
  const elements = readArray(component.elements).filter(isRecord);
  if (elements.length === 0) return false;
  return elements.every(isTextOnlyElement);
}

function isTextOnlyElement(element: RawRecord): boolean {
  const type = readString(element.type);
  if (type === "text" || type === "text-list") return true;
  if (!isUngroupableLayoutType(type)) return false;
  const childInfo = childArrayInfoFromRecord(element);
  const children = (childInfo?.items ?? []).filter(isRecord);
  return children.length > 0 && children.every(isTextOnlyElement);
}

function ungroupedComponentsFromComponent(
  component: RawRecord,
  componentIndex: number,
  deps: UngroupDeps,
  enforceStackGap = false,
): RawRecord[] {
  const componentBoxValue = deps.componentBox(component);
  const componentRotation = readNumber(component.rotation) ?? 0;
  const idBase = normalizeId(
    readString(component.id) ??
      readString(component.name) ??
      readString(component.description) ??
      `component_${componentIndex + 1}`,
  );
  const elements = readArray(component.elements).filter(isRecord);
  const entries =
    elements.length === 1
      ? ungroupElementOneLevel(
          elements[0],
          absoluteElementEntry(elements[0], componentBoxValue, deps).box,
          deps,
        )
      : elements.map((element) =>
          absoluteElementEntry(element, componentBoxValue, deps),
        );

  const spacedEntries = enforceStackGap ? enforceVerticalStackGap(entries) : entries;
  return spacedEntries.map((entry, index) =>
    ungroupedComponent(entry, idBase, index, componentBoxValue, componentRotation),
  );
}

/**
 * Ungrouped text components inherit their authored offsets. If an element in a
 * vertical stack is taller than the gap its neighbour reserved, its next
 * sibling would flow straight under it and overlap. Push each following
 * component down so the stack always keeps at least ``MIN_STACK_GAP``.
 */
function enforceVerticalStackGap(entries: UngroupEntry[]): UngroupEntry[] {
  let previous: UngroupEntry | null = null;
  return entries.map((entry) => {
    if (entry.isBackground) return entry;
    const box = entry.box;
    if (previous?.box && box) {
      const previousBox = previous.box;
      const overlapsX =
        previousBox.x < box.x + box.width && box.x < previousBox.x + previousBox.width;
      if (overlapsX && box.y >= previousBox.y) {
        const minY = previousBox.y + previousBox.height + MIN_STACK_GAP;
        if (box.y < minY) {
          const shifted: UngroupEntry = { ...entry, box: { ...box, y: minY } };
          previous = shifted;
          return shifted;
        }
      }
    }
    previous = entry;
    return entry;
  });
}

/**
 * Vertical-push physics for an edited stack.
 *
 * ``anchorIndex`` is the box that grew (or shrank) by ``deltaHeight``. Every
 * horizontally-overlapping box at or below it is pushed by the same delta so
 * the authored gaps survive and the anchor never overlaps the copy below it.
 * When the anchor grows, the first pushed box is additionally clamped to at
 * least ``minGap`` below the anchor's new bottom.
 */
export function pushStackedBoxes(
  boxes: Array<TemplateV2UngroupBox | null | undefined>,
  anchorIndex: number,
  deltaHeight: number,
  minGap = MIN_STACK_GAP,
): Array<TemplateV2UngroupBox | null | undefined> {
  const anchor = boxes[anchorIndex];
  if (!anchor || !Number.isFinite(deltaHeight) || Math.abs(deltaHeight) < 0.01) {
    return boxes;
  }
  const anchorBottom = anchor.y + anchor.height;
  return boxes.map((box, index) => {
    if (index === anchorIndex || !box) return box;
    const overlapsX =
      anchor.x < box.x + box.width && box.x < anchor.x + anchor.width;
    if (!overlapsX || box.y < anchor.y) return box;
    const shiftedY = box.y + deltaHeight;
    const y =
      deltaHeight > 0 ? Math.max(shiftedY, anchorBottom + minGap) : shiftedY;
    if (Math.abs(y - box.y) < 0.01) return box;
    return { ...box, y };
  });
}

function absoluteElementEntry(
  element: RawRecord,
  componentBoxValue: TemplateV2UngroupBox,
  deps: UngroupDeps,
): UngroupEntry {
  const box = deps.elementBox(element);
  return {
    element,
    sourceBox: box,
    rotation: 0,
    box: {
      x: componentBoxValue.x + box.x,
      y: componentBoxValue.y + box.y,
      width: box.width,
      height: box.height,
    },
  };
}

function ungroupElementOneLevel(
  element: RawRecord,
  box: TemplateV2UngroupBox,
  deps: UngroupDeps,
): UngroupEntry[] {
  const childInfo = deps.childArrayInfo(element);
  if (!childInfo) return [];
  const elementRotation = readNumber(element.rotation) ?? 0;

  const childEntries = deps
    .layoutChildren(
      element,
      childInfo.items,
      { x: 0, y: 0, width: box.width, height: box.height },
    )
    .map((item) => {
      const childBox = item.box ?? deps.elementBox(item.child);
      const unrotatedBox = {
        x: box.x + childBox.x,
        y: box.y + childBox.y,
        width: childBox.width,
        height: childBox.height,
      };
      return {
        element: item.child,
        sourceBox: childBox,
        rotation: elementRotation,
        box: rotatedChildComponentBox(unrotatedBox, box, elementRotation),
      };
    });

  if (!hasBoxVisual(element)) return childEntries;

  // The card container owns the background fill / border / stroke / shadow.
  // Splitting it away would drop the visual, so keep a background component at
  // the bottom of the layer stack and float the children above it.
  const backgroundEntry: UngroupEntry = {
    element: backgroundElementFromContainer(element, box),
    sourceBox: { ...box },
    rotation: elementRotation,
    box: { ...box },
    isBackground: true,
  };
  return [backgroundEntry, ...childEntries];
}

function hasBoxVisual(element: RawRecord): boolean {
  const fill = asRecord(element.fill);
  if (fill && isVisibleColor(fill.color)) return true;

  const stroke = asRecord(element.stroke);
  if (stroke && isVisibleColor(stroke.color) && (readNumber(stroke.width) ?? 0) > 0) {
    return true;
  }

  return Boolean(asRecord(element.shadow));
}

function isVisibleColor(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const color = value.trim().toLowerCase();
  if (!color || color === "transparent" || color === "none") return false;
  // Fully transparent 8-digit hex (e.g. #FFFFFF00 / RRGGBBAA).
  if (/^#[0-9a-f]{8}$/.test(color) && color.endsWith("00")) return false;
  return true;
}

function backgroundElementFromContainer(
  element: RawRecord,
  box: TemplateV2UngroupBox,
): RawRecord {
  const background: RawRecord = {
    type: "container",
    position: { x: 0, y: 0 },
    size: { width: box.width, height: box.height },
  };
  for (const key of [
    "fill",
    "stroke",
    "border_radius",
    "borderRadius",
    "cornerRadius",
    "corner_radii",
    "shadow",
    "opacity",
    "clippath",
    "clipPath",
    "clip_path",
  ]) {
    if (element[key] != null) {
      background[key] = cloneJson(element[key]);
    }
  }
  return background;
}

function hasUngroupableLayout(element: RawRecord): boolean {
  const childInfo = childArrayInfoFromRecord(element);
  if (!childInfo) return false;
  const children = childInfo.items.filter(isRecord);
  if (isUngroupableLayoutType(readString(element.type)) && children.length > 0) {
    return true;
  }
  return children.some(hasUngroupableLayout);
}

function ungroupedComponent(
  entry: UngroupEntry,
  idBase: string,
  index: number,
  parentBox: TemplateV2UngroupBox,
  parentRotation: number,
): RawRecord {
  const { box, element, rotation, sourceBox } = entry;
  const position = rotatedChildComponentPosition(box, parentBox, parentRotation);
  const inheritedRotation = parentRotation + rotation;
  return {
    id: `${idBase}_part_${index + 1}`,
    description: "Ungrouped component element",
    position,
    ...(inheritedRotation !== 0 ? { rotation: inheritedRotation } : {}),
    elements: [ungroupedElement(element, sourceBox)],
  };
}

function rotatedChildComponentBox(
  box: TemplateV2UngroupBox,
  parentBox: TemplateV2UngroupBox,
  parentRotation: number,
): TemplateV2UngroupBox {
  return {
    ...box,
    ...rotatedChildComponentPosition(box, parentBox, parentRotation),
  };
}

function rotatedChildComponentPosition(
  box: TemplateV2UngroupBox,
  parentBox: TemplateV2UngroupBox,
  parentRotation: number,
) {
  if (parentRotation === 0) return { x: box.x, y: box.y };

  const radians = (parentRotation * Math.PI) / 180;
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);
  const parentCenter = {
    x: parentBox.x + parentBox.width / 2,
    y: parentBox.y + parentBox.height / 2,
  };
  const childCenter = {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
  const dx = childCenter.x - parentCenter.x;
  const dy = childCenter.y - parentCenter.y;
  const rotatedCenter = {
    x: parentCenter.x + dx * cos - dy * sin,
    y: parentCenter.y + dx * sin + dy * cos,
  };
  return {
    x: rotatedCenter.x - box.width / 2,
    y: rotatedCenter.y - box.height / 2,
  };
}

function ungroupedElement(
  element: RawRecord,
  sourceBox: TemplateV2UngroupBox,
) {
  const cloned = cloneJson(element);
  return {
    ...cloned,
    ...(readString(cloned.type) === "vector"
      ? { points: translatePointArray(cloned.points, -sourceBox.x, -sourceBox.y) }
      : {}),
    position: { x: 0, y: 0 },
    size: { width: sourceBox.width, height: sourceBox.height },
    __gslide_manual_position: true,
  };
}

function translatePointArray(value: unknown, deltaX: number, deltaY: number) {
  return readArray(value).map((item) => {
    const point = asRecord(item);
    const x = readNumber(point?.x);
    const y = readNumber(point?.y);
    if (x == null || y == null) return item;
    return { ...point, x: x + deltaX, y: y + deltaY };
  });
}

function childArrayInfoFromRecord(element: RawRecord): ChildArrayInfo | null {
  if (Array.isArray(element.children)) return { items: element.children };
  if (Array.isArray(element.elements)) return { items: element.elements };
  if (asRecord(element.child)) return { items: [element.child] };
  return null;
}

function isFlowLayoutType(type: string | null) {
  return (
    type === "flex" ||
    type === "grid" ||
    type === "list-view" ||
    type === "grid-view"
  );
}

function isUngroupableLayoutType(type: string | null) {
  return isFlowLayoutType(type) || type === "group";
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): RawRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RawRecord)
    : null;
}

function isRecord(value: unknown): value is RawRecord {
  return Boolean(asRecord(value));
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "component";
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
