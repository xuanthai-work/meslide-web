export const DEFAULT_FONT_FAMILY = "Arial";
export const DEFAULT_FONT_WEIGHT = 400;
export const BOLD_FONT_WEIGHT = 700;

const FONT_STYLE_WEIGHT_SUFFIXES = [
  ["ultrablack", 950],
  ["extrablack", 950],
  ["black", 900],
  ["heavy", 900],
  ["extrabold", 800],
  ["ultrabold", 800],
  ["bold", 700],
  ["semibold", 600],
  ["demibold", 600],
  ["medium", 500],
  ["book", 400],
  ["normal", 400],
  ["regular", 400],
  ["light", 300],
  ["extralight", 200],
  ["ultralight", 200],
  ["thin", 100],
  ["hairline", 100],
];

/**
 * Split a template family that carries a style suffix into the family a browser
 * can resolve and the weight the suffix encodes. `"Montserrat Medium"` becomes
 * `{ family: "Montserrat", weight: 500 }`; `"Archivo Black"` is left alone
 * because the whole name is the family.
 */
export function splitFontStyleSuffix(family) {
  const sourceFamily =
    (typeof family === "string" ? family : "").trim() || DEFAULT_FONT_FAMILY;
  const words = sourceFamily.split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    return { family: sourceFamily, suffixWeight: null };
  }
  const last = words[words.length - 1].toLowerCase();
  const match = FONT_STYLE_WEIGHT_SUFFIXES.find(([key]) => key === last);
  if (!match) {
    return { family: sourceFamily, suffixWeight: null };
  }
  return { family: words.slice(0, -1).join(" "), suffixWeight: match[1] };
}

/**
 * Canvas 2D silently falls back to a system font when it cannot resolve the
 * requested family, which makes the measured width disagree with the width the
 * browser actually paints. Normalize the family name and pick the weight that
 * the DOM also renders, so measurement and paint agree.
 */
export function normalizeCanvasFontSpec(font) {
  const sourceFamily =
    (typeof font?.family === "string" ? font.family : "").trim() ||
    DEFAULT_FONT_FAMILY;
  const split = splitFontStyleSuffix(sourceFamily);
  const weight = font?.bold
    ? BOLD_FONT_WEIGHT
    : (split.suffixWeight ?? DEFAULT_FONT_WEIGHT);
  return {
    family: split.family,
    weight,
    sourceFamily,
  };
}

export function quoteFontFamily(family) {
  const name = (typeof family === "string" ? family : "").trim() ||
    DEFAULT_FONT_FAMILY;
  return `"${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** CSS `font` shorthand for `context.font`, with the authored family as fallback. */
export function canvasFontCss(font) {
  const spec = normalizeCanvasFontSpec(font);
  const italic = font?.italic ? "italic " : "";
  const size = Number(font?.size) > 0 ? font.size : 18;
  const families =
    spec.family === spec.sourceFamily
      ? quoteFontFamily(spec.family)
      : `${quoteFontFamily(spec.family)}, ${quoteFontFamily(spec.sourceFamily)}`;
  return `${italic}${spec.weight} ${size}px ${families}, Helvetica, Arial, sans-serif`;
}
