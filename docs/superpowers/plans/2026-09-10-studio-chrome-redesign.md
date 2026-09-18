# Studio Chrome Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle GSlide app chrome to match `/custom-template` (white studio, Unbounded titles, pill CTAs, gray hairlines) without changing generation, editing, export, or copy.

**Architecture:** First lock new CSS tokens and extract studio primitives into `components/gslide`. Then restyle screens in five visual PRs. Slide canvas files stay untouched.

**Tech Stack:** Next.js App Router, Tailwind v3, existing `components/gslide` kit, Node `node --test` chrome tests in `tests/gslide-ui-kit.test.mjs`.

**Spec:** `docs/superpowers/specs/2026-09-10-studio-chrome-redesign-design.md`

## Global Constraints

- Accent stays `#1D6FE8` / hover `#1558C0`. No second accent.
- Body chrome uses Manrope via `--gslide-font-ui`. Do not set `font-syne` on new or restyled chrome (Syne lacks Vietnamese glyphs). Unbounded is display-only (`font-unbounded` on titles).
- Do not rewrite i18n catalogs. Reuse existing keys (`upload.hero.title`, `upload.hero.subtitle`, `templateStudio.*`, `nav.dashboard`, etc.).
- Do not change routes, nav labels, form field names, or feature-flag behavior.
- Do not modify `components/slide-editor/**` stage visuals, `lib/template-v2-html-*.ts`, or `app/(export)/pdf-maker/**`.
- No Motion/GSAP. Allowed motion: CSS `transition`, `active:scale-[0.98]`, `motion-reduce:active:scale-100`.
- No dark-mode toggle.
- Repo is `gslide-web`. Do not touch `gslide-api` or `gslide-ops`.
- Working directory for all commands: `gslide-web` repo root.
- Verify after each task: `npm test` (at least the chrome tests named in the task) and `npx eslint` on files you edited.

## File map

| File | Responsibility |
|---|---|
| `app/globals.css` | `:root` GSlide hex tokens |
| `components/gslide/tokens.ts` | JS mirror of those hex values |
| `components/gslide/GSlidePage.tsx` | Page canvas (`--gslide-bg`) |
| `components/gslide/GSlideHeader.tsx` | Sticky page header, max 80px |
| `components/gslide/GSlideButton.tsx` | Pill CTA + reduced-motion |
| `components/gslide/GSlideCard.tsx` | Hairline list/settings panel |
| `components/gslide/GSlideSidebar.tsx` | App nav canvas |
| `components/gslide/GSlideInput.tsx` | Inputs; placeholder not body muted |
| `components/gslide/GSlideStudioTitle.tsx` | Centered Unbounded H1 + Manrope subtext |
| `components/gslide/GSlideStepRail.tsx` | Numbered wizard steps |
| `components/gslide/GSlideFadeHeader.tsx` | Fixed white-to-transparent wizard header |
| `components/gslide/GSlideDropCard.tsx` | File/prompt well with optional tab chip |
| `components/gslide/index.ts` | Barrel exports |
| `app/(presentation-generator)/custom-template/CustomTemplatePage.tsx` | Must consume the new primitives |
| `tests/gslide-ui-kit.test.mjs` | Token + primitive + chrome contracts |
| `tests/studio-chrome-kit.test.mjs` | CustomTemplatePage imports the kit |

Later tasks only restyle the screen files listed in that task.

---

### Task 1: Tokens, kit primitives, and custom-template wiring

**Files:**
- Modify: `tests/gslide-ui-kit.test.mjs` (token map + header height)
- Modify: `app/globals.css` (`:root` `--gslide-*`)
- Modify: `components/gslide/tokens.ts`
- Modify: `components/gslide/GSlideHeader.tsx`
- Modify: `components/gslide/GSlideButton.tsx`
- Modify: `components/gslide/GSlideCard.tsx`
- Modify: `components/gslide/GSlideSidebar.tsx`
- Modify: `components/gslide/index.ts`
- Create: `components/gslide/GSlideStudioTitle.tsx`
- Create: `components/gslide/GSlideStepRail.tsx`
- Create: `components/gslide/GSlideFadeHeader.tsx`
- Create: `components/gslide/GSlideDropCard.tsx`
- Create: `tests/studio-chrome-kit.test.mjs`
- Modify: `app/(presentation-generator)/custom-template/CustomTemplatePage.tsx`

**Interfaces:**
- Consumes: existing `GSlidePage`, `GSlideButton`, `GSlideWordmark`, `useT`.
- Produces:
  - CSS/JS tokens as in the spec table (`--gslide-bg: #FFFFFF`, `--gslide-border: #EDEEF4`, `--gslide-ink: #101323`, `--gslide-muted: #6B6D78`, `--gslide-accent-soft: #EFF4FF`, `--gslide-input-border: #DADDE6`; accent unchanged).
  - `GSlideStudioTitle({ title: string; description?: string; compact?: boolean })`
  - `GSlideStudioStep = { id: number; label: string }`
  - `GSlideStepRail({ steps: GSlideStudioStep[]; activeId: number; "aria-label": string })`
  - `GSlideFadeHeader({ left: ReactNode; center?: ReactNode })`
  - `GSlideDropCard({ tab?: ReactNode; children: ReactNode; className?: string })`
  - `GSlideButton` also accepts `fullWidth?: boolean` and `muted?: boolean`. `muted` true + `disabled` true uses `#ECECF1` / `#5C5E68` and `disabled:opacity-100` (same as current `GradientPillButton`).

- [ ] **Step 1: Point the token snapshot test at the new hex values**

In `tests/gslide-ui-kit.test.mjs` replace the `TOKENS` object with:

```js
const TOKENS = {
  "--gslide-bg": "#FFFFFF",
  "--gslide-card": "#FFFFFF",
  "--gslide-border": "#EDEEF4",
  "--gslide-ink": "#101323",
  "--gslide-muted": "#6B6D78",
  "--gslide-accent": "#1D6FE8",
  "--gslide-accent-hover": "#1558C0",
  "--gslide-accent-soft": "#EFF4FF",
  "--gslide-input-border": "#DADDE6",
  "--gslide-input-focus": "#1D6FE8",
};
```

In the header test (`GSlide sidebar and header use tokens...`), add:

```js
assert.match(header, /h-\[72px\]|h-\[80px\]|max-h-\[80px\]/);
assert.doesNotMatch(header, /h-\[105px\]/);
```

- [ ] **Step 2: Run the token tests and confirm they fail**

Run: `node --test tests/gslide-ui-kit.test.mjs`

Expected: FAIL on `globals.css defines GSlide tokens` and/or `tokens.ts matches CSS hex values` (still `#EFF6FF` / `#BFDBFE`).

- [ ] **Step 3: Update CSS and JS tokens**

In `app/globals.css` `:root`, set:

```css
--gslide-bg: #FFFFFF;
--gslide-card: #FFFFFF;
--gslide-border: #EDEEF4;
--gslide-ink: #101323;
--gslide-muted: #6B6D78;
--gslide-accent: #1D6FE8;
--gslide-accent-hover: #1558C0;
--gslide-accent-soft: #EFF4FF;
--gslide-input-border: #DADDE6;
--gslide-input-focus: #1D6FE8;
```

In `components/gslide/tokens.ts`:

```ts
export const GSLIDE_TOKENS = {
  bg: "#FFFFFF",
  card: "#FFFFFF",
  border: "#EDEEF4",
  ink: "#101323",
  muted: "#6B6D78",
  accent: "#1D6FE8",
  accentHover: "#1558C0",
  accentSoft: "#EFF4FF",
  inputBorder: "#DADDE6",
  inputFocus: "#1D6FE8",
} as const;
```

- [ ] **Step 4: Shrink `GSlideHeader` and quiet `GSlideCard`**

Replace `GSlideHeader` root classes with:

```tsx
"sticky top-0 right-0 z-50 -mr-4 flex h-[72px] w-[calc(100%+1rem)] items-center justify-between border-b border-[var(--gslide-border)] bg-[var(--gslide-bg)] px-6 sm:h-[80px] sm:px-8"
```

Keep Unbounded title. Drop `backdrop-blur` if the bar is opaque white (optional; if you keep it, the header test still matches `backdrop-blur` today — either keep the class or change the test in Step 1 to not require it). Prefer keep `backdrop-blur` so the existing assertion still passes.

`GSlideCard`: `rounded-xl border border-[var(--gslide-border)] bg-[var(--gslide-card)] p-7 shadow-none sm:p-9` (`rounded-xl` = 12px).

`GSlideButton`: add `fullWidth` and `muted` props. Add `motion-reduce:active:scale-100` next to existing `active:scale-[0.98]`.

```tsx
type GSlideButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
  fullWidth?: boolean;
  muted?: boolean;
};
```

Muted disabled primary:

```tsx
muted && disabled
  ? "bg-[#ECECF1] text-[#5C5E68] disabled:opacity-100"
  : variant === "primary"
    ? "bg-[var(--gslide-accent)] text-white hover:bg-[var(--gslide-accent-hover)]"
    : "border border-[var(--gslide-border)] bg-[var(--gslide-card)] text-[var(--gslide-ink)]"
```

`GSlideSidebar`: keep `--gslide-bg`. Change `font-syne` on `<nav>` to nothing (inherit Manrope from `body`).

- [ ] **Step 5: Add primitive source tests (they fail until files exist)**

Create `tests/studio-chrome-kit.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("gslide barrel exports studio primitives", async () => {
  const barrel = await read("components/gslide/index.ts");
  for (const name of [
    "GSlideStudioTitle",
    "GSlideStepRail",
    "GSlideFadeHeader",
    "GSlideDropCard",
  ]) {
    assert.match(barrel, new RegExp(name));
  }
});

test("CustomTemplatePage uses shared studio primitives", async () => {
  const source = await read(
    "app/(presentation-generator)/custom-template/CustomTemplatePage.tsx",
  );
  assert.match(source, /GSlideStudioTitle/);
  assert.match(source, /GSlideStepRail/);
  assert.match(source, /GSlideFadeHeader/);
  assert.match(source, /GSlideDropCard/);
  assert.match(source, /GSlideButton/);
  assert.doesNotMatch(source, /function TemplateStudioTitle/);
  assert.doesNotMatch(source, /function StudioTopBar/);
  assert.doesNotMatch(source, /function GradientPillButton/);
});

test("studio title uses Unbounded display and Manrope body, not Syne", async () => {
  const source = await read("components/gslide/GSlideStudioTitle.tsx");
  assert.match(source, /font-unbounded/);
  assert.doesNotMatch(source, /font-syne/);
});
```

Run: `node --test tests/studio-chrome-kit.test.mjs`

Expected: FAIL (missing exports / still has local `TemplateStudioTitle`).

- [ ] **Step 6: Implement the four primitives**

`GSlideStudioTitle.tsx` (`"use client"` not required unless it calls hooks; it does not):

```tsx
import { cn } from "@/lib/utils";

export function GSlideStudioTitle({
  title,
  description,
  compact = false,
}: {
  title: string;
  description?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "px-4 text-center",
        compact
          ? "pt-[88px] sm:pt-[96px] 2xl:pt-[112px]"
          : "pt-[96px] sm:pt-[108px] 2xl:pt-[128px]",
      )}
    >
      <h1 className="font-unbounded text-[36px] font-normal leading-[1.1] tracking-[-1.2px] text-[var(--gslide-ink)] sm:text-[48px] sm:tracking-[-1.4px] md:text-[56px] 2xl:text-[68px] 2xl:tracking-[-1.8px]">
        {title}
      </h1>
      {description ? (
        <p className="mx-auto mt-3 max-w-[480px] text-center text-[15px] font-normal leading-[1.4] text-[var(--gslide-ink)]/80 sm:mt-4 sm:max-w-[520px] sm:text-[16px] 2xl:mt-5 2xl:max-w-[600px] 2xl:text-[18px]">
          {description}
        </p>
      ) : null}
    </div>
  );
}
```

`GSlideStepRail.tsx`:

```tsx
import { cn } from "@/lib/utils";

export type GSlideStudioStep = { id: number; label: string };

export function GSlideStepRail({
  steps,
  activeId,
  "aria-label": ariaLabel,
}: {
  steps: GSlideStudioStep[];
  activeId: number;
  "aria-label": string;
}) {
  return (
    <nav className="pointer-events-auto flex items-center" aria-label={ariaLabel}>
      {steps.map((step, index) => {
        const isActive = step.id === activeId;
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex items-center gap-1 sm:gap-1.5 2xl:gap-2">
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full border text-[10px] leading-none sm:h-6 sm:w-6 sm:text-[11px] 2xl:h-7 2xl:w-7 2xl:text-xs",
                  isActive
                    ? "border-[var(--gslide-ink)] bg-[var(--gslide-ink)] text-white"
                    : "border-[#E4E5EB] bg-white text-[#9B9CA3]",
                )}
              >
                {step.id}
              </span>
              <span
                className={cn(
                  "hidden text-[10px] font-medium sm:inline sm:text-[11px] 2xl:text-xs",
                  isActive ? "text-[var(--gslide-ink)]" : "text-[#9B9CA3]",
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 ? (
              <span className="mx-1.5 h-px w-3 bg-[#E9EAF0] sm:mx-2 sm:w-[18px] 2xl:mx-2.5 2xl:w-[22px]" />
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
```

`GSlideFadeHeader.tsx`:

```tsx
import type { ReactNode } from "react";

export function GSlideFadeHeader({
  left,
  center,
}: {
  left: ReactNode;
  center?: ReactNode;
}) {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[72px] bg-gradient-to-b from-white via-white to-white/0 sm:h-[80px] 2xl:h-[96px]">
      <div className="relative mx-auto flex h-full max-w-[1280px] items-center justify-between px-5 sm:px-8 2xl:max-w-[1536px] 2xl:px-[90px]">
        <div className="pointer-events-auto">{left}</div>
        {center}
      </div>
    </header>
  );
}
```

`GSlideDropCard.tsx`:

```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GSlideDropCard({
  tab,
  children,
  className,
}: {
  tab?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("group relative", className)}>
      {tab ? (
        <div className="relative z-10 ml-8 w-max rounded-t-[28px] border border-b-0 border-[var(--gslide-border)] bg-white px-3 pb-2.5 pt-2 2xl:ml-10 2xl:rounded-t-[32px] 2xl:px-4 2xl:pb-3 2xl:pt-2.5">
          {tab}
        </div>
      ) : null}
      <div className="relative -mt-px rounded-[28px] border border-[var(--gslide-border)] bg-white p-2.5 shadow-[0_0_16px_rgba(80,71,230,0.08)] 2xl:rounded-[32px] 2xl:p-3">
        {children}
      </div>
    </div>
  );
}
```

Export all four from `components/gslide/index.ts`.

- [ ] **Step 7: Wire `CustomTemplatePage` to the kit**

Delete local `StudioTopBar`, `TemplateStudioTitle`, `GradientPillButton`.

Header:

```tsx
<GSlideFadeHeader
  left={
    <a href="/dashboard" aria-label={t("templateStudio.topbar.dashboard")}>
      <GSlideWordmark className="text-sm sm:text-base 2xl:text-lg" />
    </a>
  }
  center={
    <GSlideStepRail
      aria-label={t("templateStudio.topbar.progressAria")}
      activeId={activeStep}
      steps={[
        { id: 1, label: t("templateStudio.steps.upload") },
        { id: 2, label: t("templateStudio.steps.analyze") },
        { id: 3, label: t("templateStudio.steps.preview") },
        { id: 4, label: t("templateStudio.steps.review") },
      ]}
    />
  }
/>
```

Title: `<GSlideStudioTitle title={t("templateStudio.topbar.title")} description={t("templateStudio.topbar.description")} />`

Upload well: wrap existing drop UI in `<GSlideDropCard tab={...upload pptx chip...}>`.

Replace `GradientPillButton` with `<GSlideButton fullWidth muted={...}>`.

On mains that currently use `font-syne`, remove `font-syne` so body inherits Manrope. Keep layout classes (`bg-white`, padding). Prefer `min-h-[100dvh]` instead of `min-h-screen` on the upload main.

Do not change font-check / preview / save behavior.

- [ ] **Step 8: Run chrome tests**

Run:

```
node --test tests/gslide-ui-kit.test.mjs tests/studio-chrome-kit.test.mjs
```

Expected: PASS.

If `gslide-ui-kit.test.mjs` still asserts dashboard `#EFF6FF` (`assert.match(dash, /--gslide-bg|#EFF6FF/)`), keep `--gslide-bg` (token now white). Do not require `#EFF6FF`. Change that assertion to `--gslide-bg` only if it currently ORs ice hex.

Fix any other chrome test that still requires `#EFF6FF` or `#BFDBFE` on kit files. Do **not** change Konva tests that forbid `--gslide-bg` on the stage.

- [ ] **Step 9: Lint touched files and commit**

Run: `npx eslint components/gslide app/(presentation-generator)/custom-template/CustomTemplatePage.tsx tests/studio-chrome-kit.test.mjs tests/gslide-ui-kit.test.mjs`

Expected: 0 errors.

```bash
git add app/globals.css components/gslide tests/gslide-ui-kit.test.mjs tests/studio-chrome-kit.test.mjs "app/(presentation-generator)/custom-template/CustomTemplatePage.tsx"
git commit -m "refactor: extract studio chrome kit and lock white GSlide tokens"
```

---

### Task 2: Upload and outline chrome

**Files:**
- Modify: `app/(presentation-generator)/upload/components/UploadPage.tsx`
- Modify: `app/(presentation-generator)/upload/components/PromptInput.tsx`
- Modify: `app/(presentation-generator)/upload/components/ConfigurationSelects.tsx`
- Modify: `app/(presentation-generator)/upload/components/SupportingDoc.tsx` (classes only)
- Modify: `app/(presentation-generator)/outline/components/OutlineStandardHeader.tsx`
- Modify: `app/(presentation-generator)/outline/components/GenerateButton.tsx`
- Modify: `app/(presentation-generator)/outline/components/OutlinePage.tsx` (classes only if it sets ice/Syne)
- Modify: `tests/studio-chrome-kit.test.mjs` (append upload/outline assertions)

**Interfaces:**
- Consumes: `GSlideStudioTitle`, `GSlideDropCard`, `GSlideButton`, `GSlideWordmark` from Task 1.
- Produces: upload page with centered hero copy from `upload.hero.title` / `upload.hero.subtitle`; outline header white hairline + Unbounded title; generate button is `GSlideButton` pill. No new routes. No fake step rail on upload.

- [ ] **Step 1: Add failing chrome assertions**

Append to `tests/studio-chrome-kit.test.mjs`:

```js
test("upload page uses studio title keys and drop card", async () => {
  const source = await read(
    "app/(presentation-generator)/upload/components/UploadPage.tsx",
  );
  assert.match(source, /GSlideStudioTitle/);
  assert.match(source, /upload\.hero\.title/);
  assert.match(source, /GSlideDropCard/);
  assert.doesNotMatch(source, /font-syne/);
});

test("outline header is white hairline chrome without Syne", async () => {
  const header = await read(
    "app/(presentation-generator)/outline/components/OutlineStandardHeader.tsx",
  );
  assert.match(header, /font-unbounded/);
  assert.doesNotMatch(header, /font-syne/);
  assert.match(header, /--gslide-border/);
});

test("outline generate uses GSlideButton pill", async () => {
  const source = await read(
    "app/(presentation-generator)/outline/components/GenerateButton.tsx",
  );
  assert.match(source, /GSlideButton/);
  assert.doesNotMatch(source, /from "@\/components\/ui\/button"/);
});
```

Run: `node --test tests/studio-chrome-kit.test.mjs`

Expected: FAIL on the new tests.

- [ ] **Step 2: Restyle `UploadPage`**

Keep `Wrapper`, loaders, `handleGeneratePresentation`, community picker, and config handlers.

Replace the inner column with:

```tsx
<div className="mx-auto flex min-h-[100dvh] max-w-[760px] flex-col px-4 pb-10 lg:max-w-[780px] xl:max-w-[900px]">
  <GSlideStudioTitle
    title={t("upload.hero.title")}
    description={t("upload.hero.subtitle")}
    compact
  />
  <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
    <CurrentConfig webSearchEnabled={config.webSearch} />
    <ConfigurationSelects
      compact
      mode={generationMode}
      onModeChange={handleGenerationModeChange}
      config={config}
      onConfigChange={handleConfigChange}
    />
  </div>
  <GSlideDropCard className="mt-8">
    <PromptInput
      /* existing props unchanged */
    />
  </GSlideDropCard>
  {smartModeEnabled && communityEnabled && generationMode === "smart" ? (
    <div className="mt-8">
      <CommunityReferencePicker
        selectedId={communityReference?.id ?? null}
        onSelect={setCommunityReference}
      />
    </div>
  ) : null}
</div>
```

Do not add `GSlideStepRail`.

- [ ] **Step 3: Restyle prompt/config/docs classes only**

`ConfigurationSelects.tsx`: remove `font-syne`. Selected chip: `bg-[var(--gslide-accent-soft)] border border-[var(--gslide-border)]`. Idle: white + hairline `--gslide-border`. Keep popover behavior.

`PromptInput.tsx`: remove ice/Syne classes. Textarea: `text-[var(--gslide-ink)]`. Generate control inside prompt (if present) should be `GSlideButton` or an accent pill already using `--gslide-accent`.

`SupportingDoc.tsx`: drop-zone radius `rounded-[18px]`, border `--gslide-border`, no `#EFF6FF` fill.

- [ ] **Step 4: Restyle outline header and generate**

`OutlineStandardHeader.tsx`:

```tsx
<header className="sticky top-0 z-[60] h-[72px] w-full border-b border-[var(--gslide-border)] bg-[var(--gslide-bg)] sm:h-[80px]">
  <div className="flex h-full items-center justify-between px-6">
    <div className="flex min-w-0 items-center gap-3">
      <Link href="/dashboard" aria-label={t("outline.header.aria.goToDashboard")} className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gslide-accent)]">
        <GSlideWordmark className="text-base" />
      </Link>
      <h1 className="truncate font-unbounded text-base font-normal tracking-[-0.03em] text-[var(--gslide-ink)]">
        {title}
      </h1>
    </div>
    <button type="button" onClick={onBack} className="flex shrink-0 items-center gap-2 text-xs font-semibold text-[var(--gslide-ink)] hover:text-[var(--gslide-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gslide-accent)]">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {t("common.actions.back")}
    </button>
  </div>
</header>
```

Remove `uppercase tracking-[0.96px]` on Back (spec: no extra eyebrows). Keep the same `t("common.actions.back")` string.

`GenerateButton.tsx` replace `Button` with:

```tsx
import { GSlideButton } from "@/components/gslide";

<GSlideButton disabled={isDisabled} onClick={onSubmit} className="h-[46px] px-6 text-lg">
  {getButtonText()}
  <ChevronRight aria-hidden="true" strokeWidth={1.7} className="h-[18px] w-[18px]" />
</GSlideButton>
```

Keep disable rules and `translate("outline.generateButton.*")` text.

If `OutlinePage.tsx` or `TemplateSelection.tsx` sets `font-syne` or ice page fill, switch to tokens / inherit Manrope. Do **not** convert the two-column template picker into a centered hero.

- [ ] **Step 5: Run tests and lint**

Run:

```
node --test tests/studio-chrome-kit.test.mjs tests/gslide-ui-kit.test.mjs tests/presentation-mode-flow.test.mjs
npx eslint "app/(presentation-generator)/upload" "app/(presentation-generator)/outline/components/OutlineStandardHeader.tsx" "app/(presentation-generator)/outline/components/GenerateButton.tsx"
```

Expected: tests PASS, eslint 0 errors.

- [ ] **Step 6: Manual check then commit**

Open `/upload` then generate into `/outline` (or open an existing outline). Confirm title/drop-card/pill; template grid still two-column; generate still requires a template.

```bash
git add "app/(presentation-generator)/upload" "app/(presentation-generator)/outline" tests/studio-chrome-kit.test.mjs
git commit -m "style: restyle upload and outline chrome to the studio kit"
```

---

### Task 3: Dashboard, templates list, and community

**Files:**
- Modify: `app/(presentation-generator)/(dashboard)/dashboard/components/DashboardPage.tsx`
- Modify: `app/(presentation-generator)/(dashboard)/dashboard/components/PresentationGrid.tsx` (card radius/border only)
- Modify: `app/(presentation-generator)/(dashboard)/dashboard/components/PresentationCard.tsx` (chrome classes only)
- Modify: `app/(presentation-generator)/(dashboard)/templates/components/TemplatePanel.tsx`
- Modify: `app/(presentation-generator)/(dashboard)/templates/components/CreateCustomTemplate.tsx`
- Modify: `app/(presentation-generator)/(dashboard)/community/components/CommunityPage.tsx`
- Modify: `app/(presentation-generator)/(dashboard)/Components/DashboardSidebar.tsx` (`font-syne` off)
- Modify: `tests/studio-chrome-kit.test.mjs`
- Modify: `tests/gslide-ui-kit.test.mjs` if it still requires ice hex on dashboard source

**Interfaces:**
- Consumes: `GSlideHeader`, `GSlideButton`, tokens from Task 1.
- Produces: dashboard/templates/community on white canvas, 12px cards, hairline borders, Unbounded page titles, one pill create on templates. Action cards on dashboard stay (create new + blank). No new empty-state copy.

- [ ] **Step 1: Add failing assertions**

```js
test("dashboard action cards use 12px radius and token hairline", async () => {
  const source = await read(
    "app/(presentation-generator)/(dashboard)/dashboard/components/DashboardPage.tsx",
  );
  assert.match(source, /rounded-\[12px\]|rounded-xl/);
  assert.doesNotMatch(source, /font-syne/);
  assert.match(source, /GSlideHeader/);
});

test("templates page header uses GSlideHeader or Unbounded plus pill create", async () => {
  const source = await read(
    "app/(presentation-generator)/(dashboard)/templates/components/TemplatePanel.tsx",
  );
  assert.match(source, /font-unbounded/);
  assert.match(source, /rounded-full/);
  assert.doesNotMatch(source, /font-syne/);
});

test("community page does not use ice header height 105px or Syne", async () => {
  const source = await read(
    "app/(presentation-generator)/(dashboard)/community/components/CommunityPage.tsx",
  );
  assert.doesNotMatch(source, /min-h-\[105px\]/);
  assert.doesNotMatch(source, /font-syne/);
});
```

Run: `node --test tests/studio-chrome-kit.test.mjs`

Expected: FAIL.

- [ ] **Step 2: Dashboard chrome**

`DashboardActionCard` className: `rounded-[12px] border border-[var(--gslide-border)] bg-white ... hover:shadow-[0_10px_28px_rgba(16,24,40,0.06)]`. Inner overlay radius `rounded-[12px]`. Title span: drop `font-syne`, use `text-[var(--gslide-ink)]`.

Section headings (`dashboard.section.actions`, `dashboard.section.decks`): `font-unbounded text-base font-normal tracking-[-0.03em] text-[var(--gslide-ink)]` instead of Syne 16px medium.

Page root already uses `--gslide-bg` (now white). Keep `GSlideHeader`.

Deck view toggle: selected `bg-[var(--gslide-accent-soft)]`, border `--gslide-border`.

`PresentationCard` / grid: `rounded-xl border-[var(--gslide-border)]`, no ice page tint. Do not restyle slide thumbnails as product chrome (images stay).

- [ ] **Step 3: Templates list + create tile**

`TemplatePanel.tsx`: replace the custom sticky ice header with:

```tsx
<GSlideHeader
  title={t("templates.page.title")}
  actions={
    <Link href="/custom-template" aria-label={t("templates.actions.createNewAria")}>
      <GSlideButton className="h-10 px-4 text-sm">
        <span className="hidden md:inline">{t("templates.actions.newTemplate")}</span>
        <span className="md:hidden">{t("templates.actions.newTemplateShort")}</span>
      </GSlideButton>
    </Link>
  }
/>
```

`GSlideButton` is a `<button>`. Wrapping in `<Link>` is invalid HTML. Use:

```tsx
<Link href="/custom-template" aria-label={t("templates.actions.createNewAria")} className="inline-flex">
  <span className="inline-flex h-10 items-center rounded-full bg-[var(--gslide-accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--gslide-accent-hover)] motion-reduce:active:scale-100 active:scale-[0.98]">
    ...
  </span>
</Link>
```

or `GSlideButton` with `onClick={() => router.push("/custom-template")}` matching current `CreateCustomTemplate` routing.

Remove `font-syne` from the page root.

`CreateCustomTemplate.tsx`: border `--gslide-border`, radius `12px` on selection page and `28px` on the templates grid tile (`rounded-[28px]`), background white not `#F8FBFB`. Remove `font-syne`. Keep `router.push("/custom-template")`.

- [ ] **Step 4: Community + sidebar Syne**

`CommunityPage.tsx`: replace the 105px ice header with `GSlideHeader` and the existing create `Link` styled as the templates pill. Search input: Manrope, `text-[var(--gslide-ink)]`, placeholder `text-[var(--gslide-muted)]`. Remove `font-syne`.

`DashboardSidebar.tsx`: remove `font-syne`. Active/idle classes already use tokens.

- [ ] **Step 5: Tests, lint, commit**

Run:

```
node --test tests/studio-chrome-kit.test.mjs tests/gslide-ui-kit.test.mjs tests/dashboard-presentation-card.test.mjs
npx eslint "app/(presentation-generator)/(dashboard)/dashboard" "app/(presentation-generator)/(dashboard)/templates" "app/(presentation-generator)/(dashboard)/community/components/CommunityPage.tsx" "app/(presentation-generator)/(dashboard)/Components/DashboardSidebar.tsx"
```

Expected: PASS / 0 errors.

Manual: `/dashboard`, `/templates`, `/community` (if flag on).

```bash
git add "app/(presentation-generator)/(dashboard)" tests/studio-chrome-kit.test.mjs tests/gslide-ui-kit.test.mjs
git commit -m "style: restyle dashboard, templates, and community chrome"
```

---

### Task 4: Settings and theme chrome

**Files:**
- Modify: `app/(presentation-generator)/(dashboard)/settings/SettingPage.tsx`
- Modify: `app/(presentation-generator)/(dashboard)/settings/SettingSideBar.tsx`
- Modify: `app/(presentation-generator)/(dashboard)/theme/components/ThemePanel/index.tsx`
- Modify: `app/(presentation-generator)/(dashboard)/theme/components/ThemePanel/ThemeCard.tsx` (label font only)
- Modify: `tests/studio-chrome-kit.test.mjs`

**Interfaces:**
- Consumes: `GSlideHeader`, `GSlideButton`, tokens.
- Produces: settings save still `GSlideButton`; section tabs accent/muted; theme page white canvas, Unbounded titles, pill generate/save. Color fields and API payloads unchanged.

- [ ] **Step 1: Failing tests**

```js
test("settings tabs use token accent without Syne", async () => {
  const source = await read(
    "app/(presentation-generator)/(dashboard)/settings/SettingSideBar.tsx",
  );
  assert.match(source, /--gslide-accent/);
  assert.doesNotMatch(source, /font-syne/);
});

test("theme panel generate control is a pill and body is not Syne", async () => {
  const source = await read(
    "app/(presentation-generator)/(dashboard)/theme/components/ThemePanel/index.tsx",
  );
  assert.match(source, /rounded-full/);
  assert.doesNotMatch(source, /font-syne/);
  assert.doesNotMatch(source, /#BFDBFE/);
});
```

Run: `node --test tests/studio-chrome-kit.test.mjs`

Expected: FAIL (`#BFDBFE` still in theme icon wells).

- [ ] **Step 2: Settings**

`SettingPage` already uses `GSlideHeader` + `GSlideButton`. Ensure the page wrapper is `bg-[var(--gslide-bg)]`. Save button stays the single primary pill.

`SettingSideBar`: tab radius `rounded-t-lg` (8px controls). Active: `text-[var(--gslide-accent)]`. Idle: `text-[var(--gslide-muted)]`. Hover: `bg-[var(--gslide-accent-soft)]`. Keep `role="tablist"` and labels from `settings.sections.*`.

Provider forms (`TextProvider`, `ImageProvider`, `WebSearchProvider`): do not reorder fields. If they use ice borders, switch to `--gslide-input-border`.

- [ ] **Step 3: Theme panel**

Remove `font-syne` from ThemePanel root and `SheetContent`.

Replace hardcoded `#BFDBFE` icon wells with `bg-[var(--gslide-accent-soft)]`.

Generate / save / new-theme buttons already `rounded-full` + accent: keep, drop extra `shadow-md` if it fights hairline language.

Unbounded `text-[28px]` titles: change `#101828` to `text-[var(--gslide-ink)]`.

`ThemeCard.tsx`: replace `font-syne` on overlay pills with default UI font. Do not change theme color swatches (those are theme data, not chrome).

Do not change `Theme` JSON, `ThemeApi`, or color picker math.

- [ ] **Step 4: Tests, lint, commit**

Run:

```
node --test tests/studio-chrome-kit.test.mjs tests/gslide-ui-kit.test.mjs
npx eslint "app/(presentation-generator)/(dashboard)/settings" "app/(presentation-generator)/(dashboard)/theme/components/ThemePanel"
```

Expected: PASS / 0 errors.

Manual: `/settings` save still works; `/theme` pick/generate still writes the same theme.

```bash
git add "app/(presentation-generator)/(dashboard)/settings" "app/(presentation-generator)/(dashboard)/theme" tests/studio-chrome-kit.test.mjs
git commit -m "style: restyle settings and theme chrome to studio tokens"
```

---

### Task 5: Presentation header and chat chrome only

**Files:**
- Modify: `app/(presentation-generator)/presentation/components/PresentationHeader.tsx`
- Modify: `app/(presentation-generator)/presentation/components/chat/ChatEditorLayout.tsx`
- Modify: `app/(presentation-generator)/presentation/components/chat/ChatPresentationLayout.tsx`
- Modify: `app/(presentation-generator)/presentation/page.tsx` (loading shell classes only)
- Modify: `tests/studio-chrome-kit.test.mjs`
- Do **not** modify: `components/slide-editor/**`, `lib/template-v2-html-*.ts`, `app/(export)/pdf-maker/**`

**Interfaces:**
- Consumes: tokens, `GSlideButton` optional for send (editor send is a round icon; keep round, retokenize colors).
- Produces: presentation top bar white + hairline (no gray `shadow-sm` ice), Manrope on chrome, Unbounded title kept. Chat chips use `--gslide-accent-soft` / `--gslide-border` instead of `#EFF6FF` / `#BFDBFE`. Stage overlays untouched.

- [ ] **Step 1: Failing tests**

```js
test("presentation header chrome is white hairline without Syne", async () => {
  const source = await read(
    "app/(presentation-generator)/presentation/components/PresentationHeader.tsx",
  );
  assert.doesNotMatch(source, /font-syne/);
  assert.match(source, /border-\[var\(--gslide-border\)\]|border-b/);
});

test("chat editor chrome does not use ice fills or Syne", async () => {
  const source = await read(
    "app/(presentation-generator)/presentation/components/chat/ChatEditorLayout.tsx",
  );
  assert.doesNotMatch(source, /font-syne/);
  assert.doesNotMatch(source, /#EFF6FF/);
  assert.doesNotMatch(source, /#BFDBFE/);
});

test("slide editor surface files are unchanged by studio chrome", async () => {
  const nodes = await read("components/slide-editor/surface/nodes.tsx");
  assert.doesNotMatch(nodes, /--gslide-bg/);
});
```

The last test already exists in `gslide-ui-kit.test.mjs` (`Konva surface nodes are not restyled as product chrome`). Do not weaken it. Run it at the end of this task.

Run: `node --test tests/studio-chrome-kit.test.mjs`

Expected: FAIL on header/chat Syne/ice.

- [ ] **Step 2: `PresentationHeader`**

Root bar:

```tsx
<div className="sticky top-0 z-50 flex h-[72px] items-center justify-between gap-2 border-b border-[var(--gslide-border)] bg-[var(--gslide-bg)] px-3 sm:h-[80px] sm:gap-4 sm:px-4">
```

Remove `font-syne` and `shadow-sm`. Keep Unbounded title, dashboard wordmark, export/actions behavior. Title hover wash: `hover:bg-[var(--gslide-accent-soft)]` instead of `hover:bg-[var(--gslide-bg)]` (bg is now white).

- [ ] **Step 3: Chat layouts**

`ChatEditorLayout.tsx` root: `bg-white` (or `bg-[var(--gslide-bg)]`), remove `font-syne`.

Composer textarea: inherit UI font, `text-[var(--gslide-ink)]`, placeholder `text-[var(--gslide-muted)]`.

Attachment chips currently `border-[#DBEAFE] bg-[#EFF6FF] text-[#1D4ED8]`: change to `border-[var(--gslide-border)] bg-[var(--gslide-accent-soft)] text-[var(--gslide-accent)]`.

Quick prompts: `border-[var(--gslide-border)] bg-white text-[var(--gslide-muted)] hover:bg-[var(--gslide-accent-soft)]`. Remove `#BFDBFE` / `#EFF6FF`.

Send button: keep rounded-full; active fill `--gslide-accent`.

Repeat the same chip/prompt token swaps in `ChatPresentationLayout.tsx`.

`presentation/page.tsx` loading shell: remove `font-syne`; do not change data loading.

- [ ] **Step 4: Guard the canvas**

Run:

```
node --test tests/gslide-ui-kit.test.mjs tests/studio-chrome-kit.test.mjs tests/frontend-decomposition-pr5.test.mjs
git diff --stat -- components/slide-editor lib/template-v2-html-chart.ts lib/template-v2-html-shared.ts lib/template-v2-json-to-html.ts "app/(export)/pdf-maker"
```

Expected: tests PASS. Diff stat empty for those paths.

- [ ] **Step 5: Lint, manual editor pass, commit**

```
npx eslint "app/(presentation-generator)/presentation/components/PresentationHeader.tsx" "app/(presentation-generator)/presentation/components/chat/ChatEditorLayout.tsx" "app/(presentation-generator)/presentation/components/chat/ChatPresentationLayout.tsx" "app/(presentation-generator)/presentation/page.tsx"
```

Manual: open a deck, rename title, send a chat message, confirm Konva/slide look unchanged.

```bash
git add "app/(presentation-generator)/presentation" tests/studio-chrome-kit.test.mjs
git commit -m "style: restyle presentation header and chat chrome only"
```

---

## Spec coverage

| Spec section | Task |
|---|---|
| Brand tokens | Task 1 |
| Studio kit primitives + CustomTemplatePage | Task 1 |
| Reduced motion on CTA | Task 1 (`motion-reduce:active:scale-100`) |
| Upload wizard | Task 2 |
| Outline (keep split picker) | Task 2 |
| Dashboard / templates / community | Task 3 |
| Settings / theme | Task 4 |
| Presentation chrome, not canvas | Task 5 |
| Manrope body, Unbounded display | All tasks (strip `font-syne` on chrome) |
| No i18n rewrite / no route change | All tasks |
| `gslide-ui-kit` token tests | Task 1 (and keep green later) |
| Konva `--gslide-bg` ban | Task 5 guard |

Out of spec on purpose: `/template-preview` inner canvas (`TemplatePreviewClient`) and pdf-maker `font-syne` (export/slide preview, not app chrome).
