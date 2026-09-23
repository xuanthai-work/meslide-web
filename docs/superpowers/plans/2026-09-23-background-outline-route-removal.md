# Background Outline Generation and Route Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move template selection and hidden outline generation entirely into `/presentation`, then remove the `/outline` route and every manual outline-editor surface.

**Architecture:** `PresentationPage` owns a template-picker stage and the existing editor stage. A focused `useBackgroundOutlineStream` hook consumes SSE lifecycle events without parsing partial outline JSON; `useAutomaticPresentationGeneration` orchestrates persisted-outline hydration, final preparation, cancellation, and navigation. The backend outline APIs and persistence remain unchanged.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Redux Toolkit, browser `EventSource`, Node test runner, Cypress component tests, ESLint, Knip.

**Spec:** `docs/superpowers/specs/2026-09-23-background-outline-route-removal-design.md`

## Global Constraints

- Do not change the backend outline model, outline endpoints, or slide-generation stream.
- Do not create a replacement route for `/outline`; direct `/outline` visits must resolve to the normal Next.js 404.
- Never expose or persist partial outline chunks in the automatic flow.
- Treat `heartbeat` as transport liveness only; it must not reset the useful-progress clock.
- Only a non-empty outline received from `getOutlines` or the SSE `complete` event may reach `presentationPrepare`.
- Cancelling outline generation must clear temporary outline state and return to `/presentation?id=<id>&auto=1`.
- Keep English and Vietnamese locale object shapes identical.
- Preserve all existing slide-streaming and editor behavior after `presentationPrepare` succeeds.

## Review Focus

- Reloading `/presentation?id=<id>&auto=1&template=<id>` with a persisted outline must prepare exactly once without opening another outline stream; Task 3 adds this contract.
- A connected SSE stream that emits only heartbeats must still become stalled after the useful-progress deadline; Task 2 retains and tests this behavior.
- An empty or malformed `complete` payload must fail without calling `presentationPrepare`; Tasks 2 and 3 pin both halves of this rule.
- Cancelling after chunk activity must neither call `updateOutlines` nor reuse temporary outlines; Tasks 2 and 3 cover transport and navigation behavior.
- React effect re-runs or duplicate completion signals must not call `presentationPrepare` more than once; Task 3 keeps the in-flight/prepared guards under test.

---

### Task 1: Put template selection on `/presentation`

**Files:**

- Create: `app/(presentation-generator)/presentation/components/PresentationTemplatePicker.tsx`
- Create: `cypress/component/presentation-template-picker.cy.tsx`
- Modify: `app/(presentation-generator)/presentation/components/PresentationPage.tsx:101-157,732-796`
- Modify: `app/(presentation-generator)/presentation/hooks/useAutomaticPresentationGeneration.ts:59-70`
- Modify: `app/(presentation-generator)/upload/components/UploadPage.tsx:413-419`
- Modify: `app/(presentation-generator)/documents-preview/components/DocumentPreviewPage.tsx:162-168`
- Modify: `app/(presentation-generator)/components/TemplateListUi.tsx:321-364`
- Modify: `i18n/locales/en.ts:280-296,993-1024`
- Modify: `i18n/locales/vi.ts:277-293,1229-1260`
- Modify: `tests/automatic-presentation-generation.test.mjs`
- Modify: `cypress/component/prompt-rewrite.cy.tsx:221-224,528-531,716-719`

**Interfaces:**

- Consumes: `useTemplateSummaries()`, `TemplateListCard`, `TemplateListSection`, `TemplateListLoadingState`, `TemplateListEmptyState`, `GSlideHeader`, and `GSlideButton`.
- Produces: `PresentationTemplatePicker({ presentationId, suggestedTemplate? })`, which navigates to `/presentation?id=<id>&auto=1&template=<template-id>` after a user click.
- Produces: the route-stage invariant `auto=1 && !template => template picker`; Task 3 relies on this invariant when cancellation removes the template query.

- [ ] **Step 1: Replace the old route expectations with failing presentation-route tests**

Replace `tests/automatic-presentation-generation.test.mjs` with assertions that the two creation entry points target `/presentation`, the presentation page owns the picker, and no automatic-flow source navigates to `/outline`:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("new presentations enter the template stage on /presentation", async () => {
  const upload = await read("app/(presentation-generator)/upload/components/UploadPage.tsx");
  const documents = await read("app/(presentation-generator)/documents-preview/components/DocumentPreviewPage.tsx");

  assert.match(upload, /return `\/presentation\?\$\{params\.toString\(\)\}`/);
  assert.match(upload, /auto:\s*"1"/);
  assert.match(documents, /router\.replace\(`\/presentation\?/);
  assert.doesNotMatch(`${upload}\n${documents}`, /\/outline\?/);
});

test("presentation owns template selection before automatic generation", async () => {
  const page = await read("app/(presentation-generator)/presentation/components/PresentationPage.tsx");
  const picker = await read("app/(presentation-generator)/presentation/components/PresentationTemplatePicker.tsx");
  const bootstrap = await read("app/(presentation-generator)/presentation/hooks/useAutomaticPresentationGeneration.ts");

  assert.match(page, /autoGenerate\s*&&\s*!automaticTemplateId/);
  assert.match(page, /<PresentationTemplatePicker/);
  assert.match(picker, /template:\s*template\.id/);
  assert.match(picker, /router\.replace\(`\/presentation\?/);
  assert.doesNotMatch(
    `${picker}\n${bootstrap}`,
    /router\.(?:push|replace)\([^)]*["'`]\/outline/,
  );
});
```

Update all three route expectations in `cypress/component/prompt-rewrite.cy.tsx` from `/outline?id=presentation-123&auto=1` to `/presentation?id=presentation-123&auto=1`.

- [ ] **Step 2: Run the route tests and verify they fail**

Run:

```bash
node --test tests/automatic-presentation-generation.test.mjs
```

Expected: FAIL because upload and document flows still navigate to `/outline`, and `PresentationTemplatePicker.tsx` does not exist.

- [ ] **Step 3: Create the presentation-owned picker and route-neutral copy**

Move the template-list behavior from the old `TemplateSelection` component into `PresentationTemplatePicker.tsx`. Use this public shape and URL transition:

```tsx
type PresentationTemplatePickerProps = {
  presentationId: string;
  suggestedTemplate?: string | null;
};

const normalizeTemplateName = (name: string) =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

const matchesSuggestedTemplate = (
  template: TemplateListItem,
  suggestion: string | null,
) => Boolean(
  suggestion &&
    (template.id === suggestion ||
      normalizeTemplateName(template.name) === normalizeTemplateName(suggestion)),
);

export default function PresentationTemplatePicker({
  presentationId,
  suggestedTemplate = null,
}: PresentationTemplatePickerProps) {
  const router = useRouter();
  const t = useT();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const { defaultTemplates, customTemplates, loading, error } =
    useTemplateSummaries();

  const selectTemplate = (template: TemplateListItem) => {
    setSelectedTemplateId(template.id);
    const params = new URLSearchParams({
      id: presentationId,
      auto: "1",
      template: template.id,
    });
    router.replace(`/presentation?${params.toString()}`);
  };

  useEffect(() => {
    if (loading || !suggestedTemplate || selectedTemplateId) return;
    const match = [...defaultTemplates, ...customTemplates].find((template) =>
      matchesSuggestedTemplate(template, suggestedTemplate),
    );
    if (match) setSelectedTemplateId(match.id);
  }, [customTemplates, defaultTemplates, loading, selectedTemplateId, suggestedTemplate]);

  const renderTemplateCard = (template: TemplateListItem) => (
    <TemplateListCard
      key={template.id}
      template={template}
      isSelected={selectedTemplateId === template.id}
      isSuggested={matchesSuggestedTemplate(template, suggestedTemplate)}
      showArrow
      selectionPage
      onClick={() => selectTemplate(template)}
    />
  );

  const body = loading ? (
    <TemplateListLoadingState />
  ) : error ? (
    <TemplateListEmptyState
      message={t("templates.selection.error.loadFailed", { error })}
    />
  ) : (
    <div className="space-y-[30px]">
      {customTemplates.length > 0 && (
        <TemplateListSection
          label={t("templates.selection.section.custom")}
          selectionPage
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <CreateCustomTemplate selectionPage />
            {customTemplates.map(renderTemplateCard)}
          </div>
        </TemplateListSection>
      )}
      <TemplateListSection
        label={
          customTemplates.length > 0
            ? t("templates.selection.section.builtin")
            : t("templates.selection.section.templates")
        }
        selectionPage
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {customTemplates.length === 0 && <CreateCustomTemplate selectionPage />}
          {defaultTemplates.map(renderTemplateCard)}
        </div>
      </TemplateListSection>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-[var(--gslide-bg)]">
      <GSlideHeader
        title={t("templates.selection.title")}
        actions={
          <GSlideButton variant="secondary" onClick={() => router.push("/upload")}>
            {t("common.actions.back")}
          </GSlideButton>
        }
      />
      <main className="mx-auto w-full max-w-[1440px] px-5 pb-12 pt-10 sm:px-10 lg:px-20">
        {body}
      </main>
    </div>
  );
}
```

The effect highlights a matching suggested template without navigating; navigation occurs only from `onClick`.

Move these keys from `outline.template` to `templates.selection` in both locales:

```ts
selection: {
  title: "Select Template", // vi: "Chọn mẫu"
  error: { loadFailed: (p) => `Templates could not be loaded: ${p.error}` },
  suggestion: {
    selected: "Suggested template selected.",
    continueHint: "Click the highlighted template to continue.",
  },
  section: { templates: "Templates", custom: "Custom", builtin: "Built-In" },
  empty: { noBuiltin: "No built-in templates available." },
},
```

Use the existing Vietnamese values when moving the Vietnamese keys. Update `TemplateTabSwitcher` to read `templates.selection.section.custom` and `.builtin`.

- [ ] **Step 4: Render the picker and change creation destinations**

In `PresentationPage`, derive the picker stage alongside the existing query values:

```tsx
const autoGenerate = searchParams.get("auto") === "1";
const automaticTemplateId = searchParams.get("template")?.trim() || null;
const suggestedTemplate = searchParams.get("suggested_template")?.trim() || null;
const showTemplatePicker = autoGenerate && !automaticTemplateId;
```

After all hooks have been called but before the presentation/error/editor render branches, add:

```tsx
if (showTemplatePicker) {
  return (
    <PresentationTemplatePicker
      presentationId={presentation_id}
      suggestedTemplate={suggestedTemplate}
    />
  );
}
```

In `useAutomaticPresentationGeneration`, replace the missing-template redirect with an idle state:

```ts
if (!templateId) {
  setPhase("idle");
  setOutlineStreamEnabled(false);
  return;
}
```

Change `getGenerationDestination` in `UploadPage` and the document-preview `router.replace` target from `/outline` to `/presentation`, preserving `id` and `auto=1` exactly.

- [ ] **Step 5: Add Cypress coverage for picker loading, errors, template groups, suggestion, and navigation**

Create `cypress/component/presentation-template-picker.cy.tsx`. Mount with `AppRouterContext`, `I18nProvider`, and template API intercepts. Use this response helper and required cases:

```tsx
const response = (items: Array<Record<string, unknown>>) => ({
  items,
  total: items.length,
  page: 1,
  page_size: 100,
});

const builtIn = {
  id: "template-default",
  name: "Momentum",
  description: "Built-in template",
  is_default: true,
  layout_count: 3,
};

const custom = {
  id: "template-custom",
  name: "Sales Review",
  description: "Custom template",
  is_default: false,
  layout_count: 2,
};

const stubTemplateRequests = (
  defaults: Array<Record<string, unknown>>,
  customs: Array<Record<string, unknown>>,
  delay = 0,
) => {
  cy.intercept("GET", "**/api/v1/ppt/template/all?*", (request) => {
    const isDefault = new URL(request.url).searchParams.get("default") === "true";
    request.reply({
      delay,
      body: response(isDefault ? defaults : customs),
    });
  });
};

const mountPicker = ({ suggestedTemplate = null } = {}) => {
  const replace = cy.stub().as("routerReplace");
  const router = {
    back: cy.stub(),
    forward: cy.stub(),
    refresh: cy.stub(),
    push: cy.stub().as("routerPush"),
    replace,
    prefetch: cy.stub(),
  };
  cy.mount(
    <AppRouterContext.Provider value={router}>
      <I18nProvider locale="vi-VN">
        <PresentationTemplatePicker
          presentationId="presentation-123"
          suggestedTemplate={suggestedTemplate}
        />
      </I18nProvider>
    </AppRouterContext.Provider>,
  );
};

it("shows loading then built-in and custom templates", () => {
  cy.intercept("GET", "**/api/v1/ppt/template/all?*default=true*", {
    delay: 100,
    body: response([builtIn]),
  });
  cy.intercept("GET", "**/api/v1/ppt/template/all?*default=false*", {
    delay: 100,
    body: response([custom]),
  });
  mountPicker();
  cy.contains(/đang tải|loading/i).should("exist");
  cy.contains("Momentum").should("exist");
  cy.contains("Sales Review").should("exist");
});

it("shows the load error", () => {
  cy.intercept("GET", "**/api/v1/ppt/template/all?*", { statusCode: 500, body: {} });
  mountPicker();
  cy.contains(/không thể tải mẫu|could not be loaded/i).should("exist");
});

it("marks a suggested template and navigates only after click", () => {
  stubTemplateRequests([builtIn], []);
  mountPicker({ suggestedTemplate: "momentum" });
  cy.contains(/đề xuất|suggested/i).should("exist");
  cy.get('@routerReplace').should('not.have.been.called');
  cy.get('[role="button"][aria-label*="Momentum"]').click();
  cy.get('@routerReplace').should(
    "have.been.calledWith",
    "/presentation?id=presentation-123&auto=1&template=template-default",
  );
});
```

Import `AppRouterContext`, `I18nProvider`, and `PresentationTemplatePicker` at the top of the spec, matching the provider pattern used by `prompt-rewrite.cy.tsx`.

- [ ] **Step 6: Run focused tests**

Run:

```bash
node --test tests/automatic-presentation-generation.test.mjs
npx cypress run --component --spec cypress/component/presentation-template-picker.cy.tsx,cypress/component/prompt-rewrite.cy.tsx --browser electron
npm run typecheck
```

Expected: all commands PASS; clicking a template stays on `/presentation` and adds `template=<id>`.

- [ ] **Step 7: Commit the template-stage migration**

```bash
git add 'app/(presentation-generator)/presentation/components/PresentationTemplatePicker.tsx' 'app/(presentation-generator)/presentation/components/PresentationPage.tsx' 'app/(presentation-generator)/presentation/hooks/useAutomaticPresentationGeneration.ts' 'app/(presentation-generator)/upload/components/UploadPage.tsx' 'app/(presentation-generator)/documents-preview/components/DocumentPreviewPage.tsx' 'app/(presentation-generator)/components/TemplateListUi.tsx' i18n/locales/en.ts i18n/locales/vi.ts tests/automatic-presentation-generation.test.mjs cypress/component/presentation-template-picker.cy.tsx cypress/component/prompt-rewrite.cy.tsx
git commit -m "feat: move template selection into presentation"
```

### Task 2: Replace preview-oriented outline streaming with a background stream

**Files:**

- Create: `app/(presentation-generator)/presentation/hooks/useBackgroundOutlineStream.ts`
- Modify: `app/(presentation-generator)/presentation/hooks/index.ts`
- Modify: `app/(presentation-generator)/presentation/hooks/useAutomaticPresentationGeneration.ts:1-15,46-57,186-213`
- Modify: `tests/generation-lifecycle.test.mjs:49-124`
- Modify: `tests/automatic-presentation-generation.test.mjs`

**Interfaces:**

- Consumes: `presentationId: string | null`, `enabled: boolean`, lifecycle helpers, `PresentationGenerationApi`, Redux dispatch, and outline/status translations.
- Produces: `{ lifecycle, statusMessage, finalOutlineCount, canKeepWaiting, cancel, keepWaiting, retry }`.
- Guarantees: `chunk` updates useful-progress timing only; `complete` is the only stream event that dispatches `setOutlines`.

- [ ] **Step 1: Write failing source-contract tests for the background stream**

Retarget outline-hook tests in `tests/generation-lifecycle.test.mjs` and add event-block assertions:

```js
const backgroundOutlineSource = () => readFile(
  new URL(
    "../app/(presentation-generator)/presentation/hooks/useBackgroundOutlineStream.ts",
    import.meta.url,
  ),
  "utf8",
);

test("background outline chunks report progress without exposing partial outlines", async () => {
  const source = await backgroundOutlineSource();
  const chunkBlock = source.slice(
    source.indexOf('case "chunk"'),
    source.indexOf('case "heartbeat"'),
  );
  assert.match(chunkBlock, /lastUsefulEventAtRef\.current = Date\.now\(\)/);
  assert.match(chunkBlock, /setLifecycle\("generating"\)/);
  assert.doesNotMatch(chunkBlock, /jsonrepair|JSON\.parse|setOutlines/);
});

test("background outline completion is the only event that stores outlines", async () => {
  const source = await backgroundOutlineSource();
  const completeBlock = source.slice(
    source.indexOf('case "complete"'),
    source.indexOf('case "closing"'),
  );
  assert.match(completeBlock, /data\.presentation\.outlines\.slides/);
  assert.match(completeBlock, /limitOutlines/);
  assert.match(completeBlock, /dispatch\(setOutlines/);
  assert.match(completeBlock, /outlinesData\.length === 0/);
});

test("background outline cancellation discards partial state", async () => {
  const source = await backgroundOutlineSource();
  const cancelBlock = source.slice(source.indexOf("const cancel = useCallback"));
  assert.match(cancelBlock, /dispatch\(clearOutlines\(\)\)/);
  assert.doesNotMatch(cancelBlock, /updateOutlines/);
});
```

Keep the existing heartbeat/useful-event, silent-retry, stall, and Keep-waiting tests. Change their source path from the old outline hook to the new hook.

- [ ] **Step 2: Run lifecycle tests and verify they fail**

Run:

```bash
node --test tests/generation-lifecycle.test.mjs
```

Expected: FAIL with `ENOENT` for `useBackgroundOutlineStream.ts`.

- [ ] **Step 3: Create the focused background stream hook**

Start from the lifecycle/resource-management logic in `useOutlineStreaming.ts`, but expose this return contract:

```ts
export type BackgroundOutlineStream = {
  lifecycle: GenerationLifecycleState;
  statusMessage: string;
  finalOutlineCount: number;
  canKeepWaiting: boolean;
  cancel: () => Promise<void>;
  keepWaiting: () => void;
  retry: () => void;
};

export function useBackgroundOutlineStream(
  presentationId: string | null,
  enabled = true,
): BackgroundOutlineStream {
  // EventSource lifecycle and timers live here.
}
```

Handle stream data with these exact semantics:

```ts
case "status":
  if (data.status) setStatusMessage(translateBackendStatus(t, data));
  setLifecycle("generating");
  break;

case "chunk":
  lastUsefulEventAtRef.current = Date.now();
  setLifecycle("generating");
  break;

case "heartbeat":
  break;

case "complete": {
  const outlinesData = limitOutlines(
    data?.presentation?.outlines?.slides ?? [],
  );
  if (outlinesData.length === 0) {
    closeStreamResources();
    setLifecycle("failed");
    setStatusMessage(t("outline.toast.parseFailed.description"));
    break;
  }
  dispatch(setOutlines(outlinesData));
  setFinalOutlineCount(outlinesData.length);
  closeStreamResources();
  setLifecycle("complete");
  break;
}

case "closing":
  closeStreamResources();
  setLifecycle("failed");
  setStatusMessage(t("outline.toast.streamingFailed.title"));
  break;
```

Do not import `jsonrepair`, maintain accumulated JSON, calculate active outline indices, or dispatch outlines from `chunk`.

Cancellation must be:

```ts
const cancel = useCallback(async () => {
  setLifecycle("cancelling");
  closeStreamResources();
  dispatch(clearOutlines());
  setFinalOutlineCount(0);
  setLifecycle("cancelled");
}, [dispatch]);
```

Preserve the current silent-retry-before-useful-progress rule, socket-vs-silence stall cause, and Keep-waiting behavior. Export the hook from `presentation/hooks/index.ts`.

- [ ] **Step 4: Switch the orchestrator to the new hook**

In `useAutomaticPresentationGeneration.ts`, replace the outline-directory import and call:

```ts
import { useBackgroundOutlineStream } from "./useBackgroundOutlineStream";

const outlineStream = useBackgroundOutlineStream(
  presentationId,
  enabled && outlineStreamEnabled,
);
```

Return `draftCount: 0` during background outline generation. The completed outline count is internal readiness data, not user-facing draft progress.

Update `tests/automatic-presentation-generation.test.mjs` to assert `useBackgroundOutlineStream` and to reject imports containing `/outline/hooks/`.

- [ ] **Step 5: Run focused verification**

Run:

```bash
node --test tests/generation-lifecycle.test.mjs tests/automatic-presentation-generation.test.mjs
npm run typecheck
```

Expected: PASS; the background hook contains no `jsonrepair`, partial `setOutlines`, or `updateOutlines` call.

- [ ] **Step 6: Commit the background transport**

```bash
git add 'app/(presentation-generator)/presentation/hooks/useBackgroundOutlineStream.ts' 'app/(presentation-generator)/presentation/hooks/useAutomaticPresentationGeneration.ts' 'app/(presentation-generator)/presentation/hooks/index.ts' tests/generation-lifecycle.test.mjs tests/automatic-presentation-generation.test.mjs
git commit -m "refactor: stream outlines only in the background"
```

### Task 3: Harden automatic preparation, retry, and cancellation

**Files:**

- Create: `tests/background-outline-bootstrap.test.mjs`
- Modify: `app/(presentation-generator)/presentation/hooks/useAutomaticPresentationGeneration.ts`
- Modify: `app/(presentation-generator)/presentation/components/PresentationPage.tsx:233-279,780-794`
- Modify: `app/(presentation-generator)/components/GenerationStatusBar.tsx:15-59`

**Interfaces:**

- Consumes: the `useBackgroundOutlineStream` contract from Task 2 and the picker-stage URL from Task 1.
- Produces: an automatic-generation control object with `lifecycle`, coarse `statusMessage`, `draftCount: 0`, recovery callbacks, and exactly-once preparation.
- Guarantees: missing template means idle; cancel means picker; preparation never receives an empty outline.

- [ ] **Step 1: Add failing orchestration contracts**

Create `tests/background-outline-bootstrap.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("background bootstrap hydrates, streams, and prepares exactly once", async () => {
  const source = await read(
    "app/(presentation-generator)/presentation/hooks/useAutomaticPresentationGeneration.ts",
  );
  assert.match(source, /PresentationGenerationApi\.getOutlines/);
  assert.match(source, /useBackgroundOutlineStream/);
  assert.match(source, /outlines\.length === 0/);
  assert.match(source, /prepareInFlightRef\.current/);
  assert.match(source, /preparedRef\.current/);
  assert.match(source, /PresentationGenerationApi\.presentationPrepare/);
  assert.match(source, /layout:\s*templateId/);
});

test("cancel returns to the presentation picker and discards outlines", async () => {
  const source = await read(
    "app/(presentation-generator)/presentation/hooks/useAutomaticPresentationGeneration.ts",
  );
  const cancelBlock = source.slice(source.indexOf("const cancel = useCallback"));
  assert.match(cancelBlock, /await outlineStream\.cancel\(\)/);
  assert.match(cancelBlock, /clearOutlines/);
  assert.match(cancelBlock, /`\/presentation\?id=\$\{presentationId\}&auto=1`/);
  assert.doesNotMatch(cancelBlock, /\/outline/);
});

test("successful preparation starts slide streaming", async () => {
  const source = await read(
    "app/(presentation-generator)/presentation/hooks/useAutomaticPresentationGeneration.ts",
  );
  assert.match(source, /`\/presentation\?id=\$\{presentationId\}&stream=true`/);
});
```

- [ ] **Step 2: Run the orchestration test and verify the cancel contract fails**

Run:

```bash
node --test tests/background-outline-bootstrap.test.mjs
```

Expected: FAIL because cancellation still navigates to `/outline` and does not explicitly enforce the picker transition.

- [ ] **Step 3: Make hydration and preparation accept only complete outlines**

Keep the initial `getOutlines` request. Normalize its slides and only set `hasPersistedOutline` when the result is non-empty:

```ts
const persistedOutlines = limitOutlines(response?.slides ?? []);
if (persistedOutlines.length > 0) {
  dispatch(setOutlines(persistedOutlines));
  setHasPersistedOutline(true);
  setPhase("outlining");
  return;
}
setPhase("outlining");
setOutlineStreamEnabled(true);
```

Retain this preparation guard, including both refs:

```ts
if (
  !enabled ||
  !templateId ||
  phase !== "outlining" ||
  !outlineReady ||
  outlines.length === 0 ||
  prepareInFlightRef.current ||
  preparedRef.current
) {
  return;
}
```

Set `prepareInFlightRef.current = true` before the request and `preparedRef.current = true` before navigating to `stream=true`. Reset only the in-flight ref in `finally`; a successful attempt must remain prepared.

- [ ] **Step 4: Route every stop/failure recovery back to the picker**

Implement cancellation as:

```ts
const cancel = useCallback(async () => {
  cancelledByUserRef.current = true;
  await outlineStream.cancel();
  dispatch(clearOutlines());
  setHasPersistedOutline(false);
  setOutlineStreamEnabled(false);
  setPhase("idle");
  router.replace(`/presentation?id=${presentationId}&auto=1`);
}, [dispatch, outlineStream, presentationId, router]);
```

For a failed hydration, stream, or prepare attempt, `retry` must clear the failure and either rehydrate when no completed outline exists or return to `outlining` when Redux already contains a completed outline. It must never set `outlineReady` from a partial chunk.

In `PresentationPage`, keep `GenerationStatusBar` visible for connecting, generating, stalled, cancelling, and failed phases; pass `draftCount={0}` for automatic outline generation. In `GenerationStatusBar`, do not show the outline-draft count or outline-specific partial-draft confirmation when that count is zero.

- [ ] **Step 5: Run focused verification**

Run:

```bash
node --test tests/background-outline-bootstrap.test.mjs tests/automatic-presentation-generation.test.mjs tests/generation-lifecycle.test.mjs
npm run typecheck
```

Expected: PASS; no automatic-generation callback contains `/outline`, and preparation is guarded by a non-empty outline plus both exactly-once refs.

- [ ] **Step 6: Commit orchestration hardening**

```bash
git add 'app/(presentation-generator)/presentation/hooks/useAutomaticPresentationGeneration.ts' 'app/(presentation-generator)/presentation/components/PresentationPage.tsx' 'app/(presentation-generator)/components/GenerationStatusBar.tsx' tests/background-outline-bootstrap.test.mjs
git commit -m "fix: harden background outline bootstrap"
```

### Task 4: Remove the dead outline chat mode

**Files:**

- Modify: `app/(presentation-generator)/presentation/components/chat/chat-types.ts:90-105`
- Modify: `app/(presentation-generator)/presentation/components/Chat.tsx:370-385,1237-1245,1379-1461`
- Modify: `app/(presentation-generator)/presentation/components/chat/ChatEditorLayout.tsx`
- Modify: `app/(presentation-generator)/presentation/components/chat/ChatPresentationLayout.tsx`
- Modify: `i18n/locales/en.ts:646-657`
- Modify: `i18n/locales/vi.ts:658-733`
- Create: `tests/outline-ui-removal.test.mjs`

**Interfaces:**

- Consumes: the remaining chat variants `presentation` and `template-v2`.
- Produces: chat layout props without `isOutlineVariant`; presentation and Template V2 behavior remain unchanged.

- [ ] **Step 1: Add a failing contract that forbids the outline chat surface**

Create `tests/outline-ui-removal.test.mjs` initially with:

```js
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("chat exposes no manual outline mode", () => {
  for (const path of [
    "app/(presentation-generator)/presentation/components/chat/chat-types.ts",
    "app/(presentation-generator)/presentation/components/Chat.tsx",
    "app/(presentation-generator)/presentation/components/chat/ChatEditorLayout.tsx",
    "app/(presentation-generator)/presentation/components/chat/ChatPresentationLayout.tsx",
  ]) {
    assert.doesNotMatch(read(path), /isOutlineVariant|variant\s*[!=]==?\s*["']outline["']/);
  }
});
```

Task 5 will extend this file with route/file removal assertions.

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
node --test tests/outline-ui-removal.test.mjs
```

Expected: FAIL on the outline union member and outline-only layout branches.

- [ ] **Step 3: Narrow chat variants and remove outline prompt injection**

Change the chat prop type to:

```ts
variant?: "presentation" | "template-v2";
```

Delete the `variant === "outline"` block that injects add/update/delete-outline tool instructions and remove the now-unused outline-limit imports. Simplify slash handling to:

```ts
if (cleanText === "/") {
  setInput("");
  setIsQuickPromptsOpen(true);
  return;
}
```

Set layout flags without an outline branch:

```ts
const isTemplateV2Variant = variant === "template-v2";
const showEditorEmptyState = !isHistoryLoading && messages.length === 0;
```

Stop passing `isOutlineVariant` to either layout.

- [ ] **Step 4: Remove `isOutlineVariant` props and branches from both layouts**

Delete the prop from both prop types and destructuring lists. Resolve each former conditional to the non-outline branch. In particular:

- Keep the general “What can I do” heading, not `chat.improveOutline`.
- Keep the general placeholder, not `chat.placeholder.outline`.
- Keep normal history/empty-state behavior.
- Keep Template V2 attachment and target behavior unchanged.

After references are gone, remove only the dead locale keys `chat.improveOutline`, `chat.placeholder.outline`, and `chat.placeholder.regenerateOutline` from both locales. Do not remove general quick prompts such as `expandOutline`; those remain valid presentation-editing requests.

- [ ] **Step 5: Run focused verification**

Run:

```bash
node --test tests/outline-ui-removal.test.mjs
npm run check:i18n-copy
npm run typecheck
```

Expected: PASS; chat has only presentation and Template V2 modes.

- [ ] **Step 6: Commit the dead chat-mode removal**

```bash
git add 'app/(presentation-generator)/presentation/components/chat/chat-types.ts' 'app/(presentation-generator)/presentation/components/Chat.tsx' 'app/(presentation-generator)/presentation/components/chat/ChatEditorLayout.tsx' 'app/(presentation-generator)/presentation/components/chat/ChatPresentationLayout.tsx' i18n/locales/en.ts i18n/locales/vi.ts tests/outline-ui-removal.test.mjs
git commit -m "refactor: remove manual outline chat mode"
```

### Task 5: Delete `/outline`, remove editor-only code, and repair repository contracts

**Files:**

- Delete: `app/(presentation-generator)/outline/loading.tsx`
- Delete: `app/(presentation-generator)/outline/page.tsx`
- Delete: `app/(presentation-generator)/outline/components/EmptyStateView.tsx`
- Delete: `app/(presentation-generator)/outline/components/GenerateButton.tsx`
- Delete: `app/(presentation-generator)/outline/components/OutlineContent.tsx`
- Delete: `app/(presentation-generator)/outline/components/OutlineItem.tsx`
- Delete: `app/(presentation-generator)/outline/components/OutlinePage.tsx`
- Delete: `app/(presentation-generator)/outline/components/OutlinePromptBar.tsx`
- Delete: `app/(presentation-generator)/outline/components/OutlineStandardHeader.tsx`
- Delete: `app/(presentation-generator)/outline/components/TemplateSelection.tsx`
- Delete: `app/(presentation-generator)/outline/hooks/useOutlineManagement.ts`
- Delete: `app/(presentation-generator)/outline/hooks/useOutlineStreaming.ts`
- Delete: `app/(presentation-generator)/outline/hooks/usePresentationGeneration.ts`
- Delete: `app/(presentation-generator)/outline/types/index.ts`
- Delete: `app/(presentation-generator)/components/useStableOutlineIds.ts`
- Modify: `app/(presentation-generator)/(dashboard)/dashboard/components/Header.tsx:10-30`
- Modify: `i18n/locales/en.ts:199-348`
- Modify: `i18n/locales/vi.ts:196-345`
- Modify: `tests/outline-ui-removal.test.mjs`
- Modify: `tests/gslide-ui-kit.test.mjs:222-226,263-274,402-405`
- Modify: `tests/studio-chrome-kit.test.mjs:52-67`
- Modify: `tests/image-search-contract.test.mjs:41-64`
- Modify: `tests/web-search-upload-toggle.test.mjs:11-27`
- Modify: `tests/retired-smart-community.test.mjs:55-65`

**Interfaces:**

- Consumes: the presentation picker, background stream, and orchestrator delivered by Tasks 1-3.
- Produces: no `/outline` filesystem route, no editor-only source, and no test/navigation reference to the removed route.

- [ ] **Step 1: Extend the removal contract before deleting files**

Append to `tests/outline-ui-removal.test.mjs`:

```js
test("outline route and manual editor files are removed", () => {
  for (const path of [
    "app/(presentation-generator)/outline/page.tsx",
    "app/(presentation-generator)/outline/components/OutlinePage.tsx",
    "app/(presentation-generator)/outline/components/OutlineContent.tsx",
    "app/(presentation-generator)/outline/components/OutlinePromptBar.tsx",
    "app/(presentation-generator)/outline/hooks/useOutlineManagement.ts",
    "app/(presentation-generator)/outline/hooks/usePresentationGeneration.ts",
    "app/(presentation-generator)/components/useStableOutlineIds.ts",
  ]) {
    assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), false, path);
  }
});

test("web client contains no outline navigation", () => {
  for (const path of [
    "app/(presentation-generator)/upload/components/UploadPage.tsx",
    "app/(presentation-generator)/documents-preview/components/DocumentPreviewPage.tsx",
    "app/(presentation-generator)/presentation/hooks/useAutomaticPresentationGeneration.ts",
    "app/(presentation-generator)/(dashboard)/dashboard/components/Header.tsx",
  ]) {
    assert.doesNotMatch(read(path), /["'`]\/outline(?:[?/'`"]|$)/, path);
  }
});
```

- [ ] **Step 2: Run the removal test and verify it fails**

Run:

```bash
node --test tests/outline-ui-removal.test.mjs
```

Expected: FAIL because the route and editor files still exist.

- [ ] **Step 3: Delete the route and editor-only source**

Delete every file listed in this task's Delete section. Do not delete:

- `app/(presentation-generator)/presentation/hooks/useBackgroundOutlineStream.ts`
- `app/(presentation-generator)/presentation/components/PresentationTemplatePicker.tsx`
- `app/(presentation-generator)/services/api/presentation-generation.ts` outline API methods
- Redux `outlines` state used by automatic preparation
- Backend status translation mappings under `i18n/backend-messages.ts`

Remove `"/outline"` from `PATHS_WITH_HEADER_BACK` and remove the outline clause from `backToUpload` in the dashboard header.

- [ ] **Step 4: Remove only editor-exclusive locale keys**

Delete these branches from `outline` in both locale files:

- `metadata`
- `header`
- `empty`
- `promptBar`
- `item`
- `addSlide`
- `generateButton`
- `template` (already moved to `templates.selection` in Task 1)
- `toast.selectTemplateFirst`
- `toast.selectLanguage`
- `toast.selectLanguageBeforeRegenFromDocs`
- `toast.noPromptOrDocument`
- `toast.outlineError`
- `toast.slideLimitReached`
- `toast.outlinesNotReady`
- `toast.templateNotSelected`
- `toast.streamParseFailed`
- `toast.draftNotSaved`

Keep `outline.status`, `outline.loading.generatingPresentationData`, and the background flow's `generationError`, `parseFailed`, `streamingFailed`, `connectFailed`, and `connectionFailed` toast keys.

- [ ] **Step 5: Repair tests that intentionally read deleted files**

Apply these exact contract changes:

- `gslide-ui-kit.test.mjs`: remove the outline-header test, remove the outline header from `CHROME_FILES`, and replace the outline page branding read with an `assert.rejects` file-absence check.
- `studio-chrome-kit.test.mjs`: remove the two tests for `OutlineStandardHeader` and `GenerateButton`; template-picker chrome is covered by the new Cypress spec and shared GSlide primitives.
- `image-search-contract.test.mjs`: remove the outline-page read and its `draftConfig.webSearch` assertion; upload and document-preview payload assertions remain.
- `web-search-upload-toggle.test.mjs`: remove the outline-page read and default assertion; `UploadPage` remains the single creation-config default.
- `retired-smart-community.test.mjs`: remove the two deleted outline paths from the standard-navigation loop; retain the automatic hook and API checks.

Then run a repository search:

```bash
rg -n -F '/outline?' app tests cypress -g '!outline-ui-removal.test.mjs'
rg -n -F '"/outline"' app tests cypress -g '!outline-ui-removal.test.mjs'
rg -n -S 'outline/(components|hooks)|OutlinePage|OutlineStandardHeader|useOutlineManagement|usePresentationGeneration' app tests cypress -g '!outline-ui-removal.test.mjs'
```

Expected: all three searches return no matches. Internal API strings such as `/api/v1/ppt/outlines/stream/<id>`, `useBackgroundOutlineStream`, and localized background status keys are outside these route/import patterns and remain intact.

- [ ] **Step 6: Run focused removal and localization checks**

Run:

```bash
node --test tests/outline-ui-removal.test.mjs tests/automatic-presentation-generation.test.mjs tests/generation-lifecycle.test.mjs tests/gslide-ui-kit.test.mjs tests/studio-chrome-kit.test.mjs tests/image-search-contract.test.mjs tests/web-search-upload-toggle.test.mjs tests/retired-smart-community.test.mjs
npm run check:i18n-copy
npm run typecheck
npm run deadcode
```

Expected: PASS; Knip reports no files made dead by the route removal.

- [ ] **Step 7: Run the complete web verification suite**

Run:

```bash
npm test
npm run check:i18n-copy
npm run lint
npm run typecheck
npm run deadcode
npx cypress run --component --browser electron
npm run build
```

Expected: every command PASS. `npm run build` must list `/presentation` but no `/outline` application route.

- [ ] **Step 8: Commit the route and editor deletion**

```bash
git add -A app tests cypress i18n
git commit -m "refactor: remove manual outline route and editor"
```

### Task 6: Verify the shipped flow manually

**Files:**

- No source changes expected.

**Interfaces:**

- Consumes: the complete `/presentation` bootstrap flow from Tasks 1-5.
- Produces: recorded verification evidence for prompt, document, reload, failure, cancellation, and removed-route behavior.

- [ ] **Step 1: Start the existing development stack**

Run the project's normal local API and web commands in separate terminals. For the web client:

```bash
npm run dev
```

Expected: Next.js starts without route compilation errors.

- [ ] **Step 2: Verify prompt-only creation**

Create a presentation from a text prompt and record these observations:

```text
1. URL becomes /presentation?id=<id>&auto=1.
2. Template picker renders inside /presentation.
3. Clicking a template adds &template=<id>.
4. Only a compact generation status appears; no outline cards/content appear.
5. URL becomes /presentation?id=<id>&stream=true when slide streaming starts.
```

- [ ] **Step 3: Verify document creation and reload recovery**

Create from a document, then reload once during background outline generation and once after the outline has completed but before slide streaming finishes. Expected:

```text
- The flow remains on /presentation.
- A completed persisted outline is reused.
- No duplicate prepare request is visible in the browser network panel.
- Slide streaming resumes or starts once.
```

- [ ] **Step 4: Verify cancellation and failure recovery**

Stop background outline generation after activity begins. Expected:

```text
- URL returns to /presentation?id=<id>&auto=1.
- Template picker is visible.
- Selecting again starts a fresh outline attempt.
- No partial outline is sent to presentationPrepare.
```

Also interrupt the outline endpoint or use browser request blocking to force a stall/failure. Verify Retry and Stop remain usable and no action navigates to `/outline`.

- [ ] **Step 5: Verify removed-route behavior**

Open `/outline` directly.

Expected: the normal Next.js 404 page appears, with no redirect to upload or presentation.

- [ ] **Step 6: Record final repository state**

Run:

```bash
git status --short
git log -6 --oneline
```

Expected: no uncommitted implementation changes; the task commits appear in order after the design and plan commits.
