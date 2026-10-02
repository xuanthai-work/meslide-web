type RawRecord = Record<string, unknown>;

export type RectBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const BACKGROUND_KEYWORDS = [
  "background",
  "backdrop",
  "canvas_bg",
  "slide_bg",
  "slide_background",
  "canvas_background",
  "base_background",
  "soft_background",
  "framed_background",
  "decor",
  "decorative_background",
  "wallpaper",
];

/**
 * Heuristic for the full-canvas backdrop/decor components that a template
 * paints behind the authored content. They are locked by default so a stray
 * click never selects (or marquee-drags) the whole background.
 */
export function isBackgroundComponent(
  component: RawRecord | null | undefined,
): boolean {
  if (!component || typeof component !== "object") return false;
  if (component.is_background === true || component.role === "background") {
    return true;
  }
  const id = String(component.id || "").toLowerCase();
  const name = String(component.name || "").toLowerCase();
  const desc = String(component.description || "").toLowerCase();
  return BACKGROUND_KEYWORDS.some(
    (keyword) =>
      id.includes(keyword) || name.includes(keyword) || desc.includes(keyword),
  );
}

export function isComponentLocked(
  component: RawRecord | null | undefined,
): boolean {
  if (!component) return false;
  // An explicit unlock always wins, even on a detected background component.
  if (component.locked === false) return false;
  // An explicit lock, or a detected background, is locked.
  return component.locked === true || isBackgroundComponent(component);
}

/** Axis-aligned bounding-box intersection test. Touching edges do not count. */
export function boxesIntersect(a: RectBox, b: RectBox): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Component indexes whose box intersects the marquee, skipping locked
 * components so a rubberband drag never selects the background.
 */
export function componentIndexesInMarquee(
  components: Array<RawRecord | null | undefined>,
  marquee: RectBox,
  boxOf: (component: RawRecord) => RectBox | null | undefined,
): number[] {
  const indexes: number[] = [];
  components.forEach((component, index) => {
    if (!component || isComponentLocked(component)) return;
    const box = boxOf(component);
    if (box && boxesIntersect(marquee, box)) indexes.push(index);
  });
  return indexes;
}
