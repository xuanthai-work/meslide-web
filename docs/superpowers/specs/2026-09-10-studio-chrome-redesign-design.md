# Studio chrome redesign — Design Spec

**Date:** 2026-09-10
**Status:** Approved for planning
**Repo:** `gslide-web`
**Approach:** Studio chrome kit (option 2), preserve GSlide brand

## Product goal

Bring the visual language of `/custom-template` (white studio, Unbounded display, pill CTA, gray hairlines) to the rest of the GSlide **app chrome**, without changing generation, editing, export, or copy.

Success looks like:

- Dashboard, upload, outline, templates, theme, settings, and community read as the same product as the template studio.
- Accent stays GSlide blue `#1D6FE8`. Wordmark stays.
- Slide canvas (Konva / Template V2 HTML / pdf-maker) is visually unchanged.
- Vietnamese UI copy still renders (Manrope body, not Syne).
- No new routes, nav labels, form field names, or i18n keys unless a visible string must change for layout (then reuse existing keys).

## Design read

Reading this as: redesign-preserve of GSlide product chrome for self-hosted Vietnamese users, with a template-studio language, leaning on the existing `components/gslide` kit rather than a new design system.

Dials:

| Dial | Value | Why |
|---|---:|---|
| DESIGN_VARIANCE | 5 | Studio offset (centered wizards, fade header) without artsy dashboard layouts |
| MOTION_INTENSITY | 4 | Hover / active press and fade header only |
| VISUAL_DENSITY | 5 on list screens, 3 on wizards | Dashboard stays a working list; upload/outline stay airy |

This is **not** a marketing landing page. Taste landing-page rules (hero, bento, marquees, GSAP) do not apply. Empty states, headers, and wizard steps may borrow studio composition. Data lists stay lists.

## Decisions locked

| Topic | Choice |
|---|---|
| Mode | Redesign, preserve brand. Extract studio patterns; do not invent a second palette. |
| Signature | White canvas + Unbounded display + one pill primary CTA. One memorable move. Everything else quiet. |
| Accent | Keep `#1D6FE8` / `#1558C0`. Do not introduce a second accent. |
| Body type | Manrope (`--gslide-font-ui`) for all chrome body, labels, inputs. Syne is **not** the product body font (missing Vietnamese glyphs). |
| Display type | Unbounded for page titles and wizard headlines only. If a title is Vietnamese and Unbounded clips glyphs, fall back to Manrope at the same size/weight. Do not mix a serif. |
| Canvas | White `#FFFFFF`. Ice wash `#EFF6FF` is retired as page background. |
| Editor canvas | Out of scope. Konva stage, slide HTML, chart colors, pdf-maker layout stay. |
| Copy | No voice rewrite. Reuse i18n keys. |
| IA | No new pages, no nav rename, no slug changes. |
| Dark mode | Product is light-only today. Do not add a theme toggle in this work. |

## Non-goals

- Restyling slide contents, Template V2 nodes, chart palettes, or export output.
- New animation library (Motion / GSAP). CSS transitions already on buttons are enough.
- Replacing Lucide (already in the tree) with Phosphor.
- A public marketing site or onboarding landing.
- Changing Smart / Community feature flags or generation flow.
- Backend / ops changes.

## Brand tokens (after)

Update both `app/globals.css` `:root` and `components/gslide/tokens.ts`. Tests in `tests/gslide-ui-kit.test.mjs` that snapshot hex values must move with them.

| Token | From | To | Role |
|---|---|---|---|
| `--gslide-bg` | `#EFF6FF` | `#FFFFFF` | Page / sidebar canvas |
| `--gslide-card` | `#FFFFFF` | `#FFFFFF` | Surfaces |
| `--gslide-border` | `#BFDBFE` | `#EDEEF4` | Hairlines |
| `--gslide-ink` | `#1E3A5F` | `#101323` | Titles and primary text |
| `--gslide-muted` | `#4B7AB5` | `#6B6D78` | Secondary text (WCAG AA on white) |
| `--gslide-accent` | `#1D6FE8` | `#1D6FE8` | Unchanged |
| `--gslide-accent-hover` | `#1558C0` | `#1558C0` | Unchanged |
| `--gslide-accent-soft` | `#DBEAFE` | `#EFF4FF` | Soft fill behind selected nav / chips |
| `--gslide-input-border` | `#93C5FD` | `#DADDE6` | Inputs |
| `--gslide-input-focus` | `#1D6FE8` | `#1D6FE8` | Unchanged |

Idle step / placeholder ink used on the studio page (`#9B9CA3`) is allowed as a local class, not a required token.

Radius scale (one system):

- Pill: `999px` / `rounded-full` for primary CTA, step dots, small chips.
- Panel: `28px` for wizard drop-cards and large empty wells.
- Card: `12px` for dashboard / template grid cards (today's 10.8px rounds up).
- Control: `8px` for inputs and compact icon buttons.

Tinted shadows only, no pure black: `0 0 16px rgba(80, 71, 230, 0.08)` on elevated wizard panels. List cards use hairline only unless hover, then `0 10px 28px rgba(16, 24, 40, 0.06)`.

## Studio chrome kit

Extract patterns that already exist in `CustomTemplatePage.tsx` into `components/gslide/`, then consume them from other screens. Do not duplicate one-off hex in page files.

| Primitive | Job | Source of truth today |
|---|---|---|
| `GSlidePage` | White canvas + ink | Exists; follows `--gslide-bg` after token change |
| `GSlideHeader` | Sticky title row | Exists; drop ice bar, use fade-to-transparent or white + hairline, height cap 72-80px (today 105px is too tall) |
| `GSlideButton` | Pill CTA | Exists; keep `rounded-full` + `active:scale-[0.98]` |
| `GSlideCard` | List / settings panel | Exists; hairline, no heavy shadow |
| `GSlideSidebar` | App nav | Exists; white canvas, accent only on active item |
| `GSlideStudioTitle` | Centered Unbounded H1 + Manrope subtext | New, from `TemplateStudioTitle` |
| `GSlideStepRail` | Numbered progress | New, from `StudioTopBar` nav (black filled = current) |
| `GSlideDropCard` | File well with tab chip | New, from upload panel on `/custom-template` |
| `GSlideFadeHeader` | Fixed top fade used by wizards without sidebar | New, from `StudioTopBar` wrapper |

`CustomTemplatePage` must switch to these primitives so the studio page and the rest cannot drift.

## Screen map

### 1. Upload (`/upload`)

Closest to the studio wizard. Centered `GSlideStudioTitle` using existing upload copy keys. Prompt + docs sit in a `GSlideDropCard`-like well, not a dense form stack. Primary action is one pill (`GSlideButton` primary). Configuration chips stay, restyled to hairline + accent-soft when selected. Community picker (flag on) stays; it is not a second primary CTA.

Do not add a fake step rail if upload is a single page.

### 2. Outline (`/outline`)

When the page is a template picker / auto-generate pause, use studio title scale only if the page is still a full-bleed wizard. If the current layout is split (templates + generate), keep the split; restyle header and Generate to pill + Unbounded section title. Do not turn a working two-column picker into a centered marketing hero.

### 3. Dashboard (`/dashboard`)

White canvas. `GSlideHeader` shortened. Action cards keep their illustrations and behavior; restyle border to hairline, radius 12px. "Create" remains the one primary pill if there is a dedicated create control; the existing three action cards stay as entry points (they are not a marketing feature row to delete). Presentation grid cards: white, hairline, no ice tint on the page. Empty state: short Unbounded line + one pill, using existing empty-state copy.

### 4. Templates (`/templates`) and custom-template

`/custom-template` becomes the consumer of the shared kit (behavior unchanged). Templates list page matches dashboard chrome (header, cards, create entry). Create-custom-template tile uses the same drop-card language as studio upload, then still routes to `/custom-template`.

### 5. Theme (`/theme`)

Unbounded section titles already present. Align sheet/page background to white, pill generate/save, hairline cards. Color picker behavior and theme data format stay.

### 6. Settings (`/settings`)

Same canvas and header as dashboard. Sidebar of settings sections: accent on active, muted on idle. Provider forms stay label-above-input. Save is one primary pill.

### 7. Community (`/community`) when the flag is on

Same header + search + pill pattern already partly there. Swap remaining ice/Syne body to tokens + Manrope.

### 8. Presentation chrome (`/presentation`)

`PresentationHeader`: white bar, Unbounded title (already close). Toolbar / chat chrome: hairline, pill send, Manrope. **Do not** restyle `TemplateV2KonvaSlide`, `nodes*.tsx`, overlays that sit on the stage, or slide HTML export.

## Motion

Allowed: `transition` on color/shadow, `active:scale-[0.98]` on buttons, CSS fade on the studio top bar (already there).

Forbidden: scroll hijack, marquees, mesh backgrounds, infinite loops, custom cursors.

Honor `prefers-reduced-motion`: drop scale on active if reduced motion is set.

## Accessibility

- Body and muted text on white must pass WCAG AA (4.5:1). `#6B6D78` on `#FFFFFF` is the muted floor; do not use `#9B9CA3` for body copy.
- Primary pill: white label on `#1D6FE8` (already AA).
- Focus rings stay 2px accent. Do not remove them.
- Header height shrink must not clip the wordmark or skip links.
- Do not use `h-screen` for new wizard heroes; `min-h-[100dvh]` if a full-bleed studio step is needed.

## Tests

Update, do not weaken:

- `tests/gslide-ui-kit.test.mjs` token hex map and dashboard/sidebar background assertions.
- Any chrome test that locks `#EFF6FF`, `#BFDBFE`, or `font-syne` on app chrome (keep Syne assertions only where slide-export or known exceptions remain).
- Konva/node tests that forbid `--gslide-bg` on the stage stay.

Add a small source test that `CustomTemplatePage` imports the shared studio primitives (title / step rail / drop card) instead of inlined duplicates.

Manual: dashboard, upload -> outline -> editor, templates -> custom-template, settings, theme. Desktop and a ~375px viewport. No generation/export visual change.

## Rollout

One PR per slice so review stays visual:

1. Tokens + kit primitives + `CustomTemplatePage` wired to the kit.
2. Upload + outline.
3. Dashboard + templates + community.
4. Settings + theme.
5. Presentation header / chat chrome only.

Each PR: no UX copy rewrite, no route change, lint/typecheck/tests for touched chrome.

## Out of scope reminders

- `components/slide-editor/**` visual of the stage.
- `lib/template-v2-html-*.ts` slide HTML.
- `app/(export)/pdf-maker/**` export layout.
- i18n catalog rewrites.
- `gslide-api` / `gslide-ops`.
