# Template V2 text fit — Design Spec

**Date:** 2026-09-18
**Status:** Approved for planning
**Repos:** `gslide-web` (render), `gslide-api` (generation)
**Approach:** Pipeline C — wrap → shrink-to-floor → ellipsis at render; one visual-capacity repair at generate

## Product goal

Template V2 decks (editor Konva, HTML preview, PDF export) must never cut a glyph mid-character and never paint slide text over a sibling layer. Vietnamese display type that is wider than the Latin `0.5em` budget still has to land inside the authored box.

Success looks like:

- A title longer than a one-line frame stays inside that frame (wraps only if the frame is tall enough; otherwise the font shrinks).
- Subtitle/body under that title is not covered.
- PDF and editor match: same fitted size, same line breaks, same ellipsis if any.
- New generation prefers a complete shorter phrase over a string that would need ellipsis.
- Existing saved decks are readable without regenerating (render-time fit only).

## Decisions locked

| Topic | Choice |
|---|---|
| Path | Template V2 only. Not Smart HTML, not `v1-standard`. |
| Geometry | Authored boxes do not move. No sibling reflow / title pushing body. |
| Stored JSON | Designed `font.size` stays. Fit is a render-time scale. Editing re-fits. |
| Pipeline | Wrap in width → shrink until height and width fit → at floor, ellipsis on the last visible line. |
| Shrink floor | `max(0.72 × designed size, 16px)` when designed size ≥ 24px (title/metric); `max(0.72 × designed size, 12px)` otherwise. |
| Generate repair | One existing LLM repair pass. Trigger on visual overflow, not only exact `maxLength` saturation. Do not add extra rounds. |
| Template schema | Do not rewrite stored `max_length` on templates. English still uses the current ceilings. |
| Scope of elements | `text` and `text-list`. Tables keep wrap + `overflow:hidden` as today; no shrink pass in this work. |

## Non-goals

- Smart / HTML-layout slides.
- Pushing siblings when a title wraps.
- Mutating saved font sizes or template `max_length`.
- Extra LLM retries beyond the current single quality-repair call.
- Image, chart, or placeholder layout.
- Compose / GitLab deploy changes.
- Pixel-perfect canvas measurement on the API (no browser there). API uses the shared unit heuristic only.

## Why the current V2 path clips

1. `maxLength` and fallback measure assume Latin `0.5em`. Bold Vietnamese is closer to `0.7–0.85em`, so copy that is schema-legal still overflows the box.
2. Konva segments use `wrap="none"` after custom wrap; auto width clips the last glyph.
3. HTML export uses `overflow:visible` on text, so extra lines paint over the next absolute layer; the slide canvas then `overflow:hidden` crops the rest.
4. `_content_fit_issues` only flags strings that **exactly equal** `maxLength`, so visual overflow never triggers repair.

## Architecture

Three layers, one rule: **text paint ⊆ authored box**.

```
generate_slide_content          template-v2-text.fitTextToBox
  visual units vs capacity  →   wrap → shrink → ellipsis
                                │
                    ┌───────────┴───────────┐
                    Konva nodes-text        json-to-html (preview + PDF)
```

Render is the source of truth for what the user sees. Generation only reduces how often render has to shrink or ellipsize.

### Shared measure

Add one unit table used by:

- Web fallback when `document` / canvas 2D is missing (Node tests, SSR).
- API visual-capacity check.

| Class | Unit (em of `font.size`) |
|---|---|
| Combining marks | 0 |
| CJK (Han / Hiragana / Katakana / Hangul) | 1.0 |
| Vietnamese letters (precomposed Latin with Vietnamese diacritics, plus `ăâêôơưđ` and uppercase) | 0.72; ×1.16 if the run/field is bold |
| Other scalar values | 0.5 |

Canvas `measureText` remains the browser source of truth. The table is only the no-canvas path and the API.

`capacity_units(maxLength) = maxLength × 0.5`. A string overflows generation capacity when `sum(units) > 0.95 × capacity_units`.

## Render (`gslide-web`)

### `fitTextToBox`

New exported function in `components/slide-editor/text/template-v2-text.ts`:

Inputs: render runs, authored box `{width, height}`, wrap `word`.

Outputs: `{ runs, fontScale, lines, ellipsis }`.

Algorithm:

1. Clone runs (do not mutate the element).
2. Layout with existing `layoutRenderTextRuns(..., "word")` (already splits oversized segments).
3. If every line width ≤ box width and total height ≤ box height, return `fontScale = 1`.
4. Binary-search `fontScale` in `[floorScale, 1]` (epsilon `0.001`). Each probe scales run `font.size` (and latex `renderHeight` proportionally) and re-layouts.
5. `floorScale = minFontPx / designedSize`, with `minFontPx` from the floor rule above. Designed size is the largest run size, or the element font size.
6. If the floor still overflows: keep that scale, drop lines whose `y + lineHeight` exceeds the box, and replace the last kept line’s tail with `…` so the line width including ellipsis ≤ box width. Never cut inside a cluster/glyph; trim on grapheme boundaries (`Intl.Segmenter` with a code-point fallback).
7. Return scaled runs + lines for the painter.

Call this from:

- `nodes-text.tsx` (Konva `text` and `text-list`) **before** drawing.
- `lib/template-v2-json-to-html.ts` `renderText` / `renderTextList` so preview and Chromium PDF emit the fitted `font-size`.

### Konva

- Keep custom wrap; keep `wrap="none"` on `Text`.
- Set each segment’s Konva `width` to the measured segment width (the current auto-width path clips the last glyph).
- Clip the text `Group` to the authored box as a safety net only. After a correct fit, clip is a no-op.

### HTML / PDF

Change `textOverflowStyle()` for `text` and `text-list` only:

- `overflow:hidden`
- `white-space:pre-wrap`
- `overflow-wrap:anywhere`
- `word-break:break-word`

Emit the fitted font size on the box (and runs). Do not change `overflow:visible` on vectors, math, or positioned flex children.

`PdfMakerPage` slide canvas stays `overflow:hidden` (page crop). Text must already fit before that crop.

### Editor

Changing text, font, or box size re-runs `fitTextToBox`. Undo still stores the unscaled JSON.

## Generation (`gslide-api`)

File: `servers/fastapi/utils/llm_calls/generate_slide_content.py`.

Keep the single repair pass. Change the trigger and the tightened ceiling.

`_content_fit_issues`:

- Still flag `len(value) >= maxLength` when `minLength < maxLength` (mechanical cut).
- Also flag when visual units exceed `0.95 × maxLength × 0.5`.
- Bold: treat a field as bold when the schema path looks like a title/label (`title`, `heading`, `name`, `metric`, `label`) or the property schema description says display/title. Body fields use 0.72 without the 1.16 multiplier.
- Ignore `__speaker_note__` and fields where `minLength == maxLength`.
- Issue text must say the string is visually too wide for the frame, and ask for a complete phrase at about `80%` of the **visual** budget (character target = `floor(visual_capacity / unit_per_char)` with `unit_per_char` from the same table on the current string, minimum `minLength`).

`_schema_with_fit_ceilings` already drops `maxLength` to 80% of the schema ceiling. Also drop it to the visual 80% target when that is tighter.

System prompt: `maxLength` is a Latin-width ceiling. Vietnamese and display fonts are wider per character; write complete phrases with headroom; never fill the character count and crop.

Language of the deck does not skip the unit table: a Vietnamese string in an “English” deck still uses Vietnamese units.

Do not persist new `max_length` onto `template_v2` rows.

## Error handling

- Canvas missing → unit table, never throw.
- `Intl.Segmenter` missing → code-point trim, still no mid-surrogate cut.
- Repair LLM still overflowing → log `quality_repair_incomplete` as today; render ellipsis handles the rest.
- Empty / whitespace-only runs → no shrink, no ellipsis.

## Testing

### Web (`gslide-web/tests/template-v2-text-fit.test.mjs`)

Inject a deterministic `measure` (no real canvas): e.g. every character width = `0.8 * font.size` except space = `0.3 * font.size`.

- Short Latin in a wide box → `fontScale === 1`, no ellipsis.
- One long unspaced token wider than the box → split or shrink; no segment width > box.
- Vietnamese-width string whose height exceeds a one-line box → `fontScale < 1` and ≥ floor; content height ≤ box height.
- String that still overflows at floor → ellipsis present, last line width ≤ box, no sibling overflow (fitted height ≤ box).
- `text-list` with too many items for the box → same floor + ellipsis on the last visible item.

Source contract tests (same style as `pdf-maker-export-layout.test.mjs`):

- `template-v2-json-to-html.ts`: `textOverflowStyle` is `overflow:hidden`, not `visible`.
- `nodes-text.tsx`: Konva text segments set `width={segment.width}` (or equivalent measured width).

### API (`servers/fastapi/tests/unit/test_generate_slide_content.py`)

- Nested exact-`maxLength` still flags; speaker notes still ignored.
- Vietnamese string **shorter than** `maxLength` but over visual capacity → issue list non-empty.
- Short English under visual capacity → no issue.
- Repair path uses a tighter `maxLength` on the second call when the first response is visually wide.

## Files

| File | Change |
|---|---|
| `gslide-web/components/slide-editor/text/template-v2-text.ts` | Unit table, `fitTextToBox`, ellipsis trim. |
| `gslide-web/components/slide-editor/surface/nodes-text.tsx` | Fit then paint; measured Konva width; clip group to box. |
| `gslide-web/lib/template-v2-json-to-html.ts` | Fit before emit; text overflow hidden. |
| `gslide-web/tests/template-v2-text-fit.test.mjs` | Measure/fit/ellipsis contracts. |
| `gslide-api/servers/fastapi/utils/llm_calls/generate_slide_content.py` | Visual issues + tighter repair ceiling + prompt line. |
| `gslide-api/servers/fastapi/tests/unit/test_generate_slide_content.py` | Visual overflow cases. |

If `template-v2-text.ts` grows past a comfortable size, extract `fitTextToBox` + unit table into `template-v2-text-fit.ts` next to it. Do not split unless the file becomes unwieldy during the change.

## Rollout

Implement on GitHub `gslide-web` / `gslide-api`. GitLab is a copy of that app plus compose; no GitLab-only behavior.

Verify by generating a Vietnamese V2 deck and exporting PDF: title/body of slides that previously clipped (`Phủ định của phủ định`, TOC items, two-line titles) stay inside their frames. Placeholder images are out of scope.
