/**
 * Template authors can ship deeply negative letter_spacing (Momentum's cover
 * title used -10.73), which drags glyphs backwards until they collide
 * horizontally. Clamp the negative side so characters never overlap.
 *
 * The floor matches the backend template normalizer (`min letter_spacing =
 * -1.5`) so authored data and the render guard agree.
 */
export const MIN_LETTER_SPACING = -1.5;

export function sanitizeLetterSpacing(spacing: number | null | undefined): number {
  if (spacing == null || !Number.isFinite(spacing)) return 0;
  return Math.max(MIN_LETTER_SPACING, spacing);
}
