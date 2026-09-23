# Generation Status Toast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inline generation status bar with one persistent top-center Sonner toast for outline generation, slide generation, and SearXNG search, while preserving Stop, Retry, and Keep waiting behavior.

**Architecture:** The existing stream hooks remain the source of truth for `lifecycle` and `statusMessage`. `GenerationStatusBar` becomes a renderless toast controller that publishes every non-terminal lifecycle through the app-wide Sonner toaster under one stable toast ID, so status changes update the existing toast rather than adding new ones. Stream hooks stop publishing duplicate lifecycle-failure toasts; they report failure through lifecycle state and message only.

**Tech Stack:** Next.js 16, React 19, TypeScript, Sonner 2, Tailwind CSS 3, Cypress component tests, Node test runner.

**Spec:** Approved bounded design in the 2026-09-23 conversation; no separate spec document was created.

## Global Constraints

- Keep the existing global `<Toaster position="top-center" />` in `app/ClientRoot.tsx`; do not add another app-level toaster.
- Use one stable ID, `generation-status`, for the operational toast across outline, slide, and SearXNG status updates.
- Operational toasts use `duration: Infinity`, `closeButton: false`, and `dismissible: false`; the user must not lose recovery controls by dismissing the toast.
- Preserve the existing Stop confirmation rules and the Stop, Retry, and Keep waiting callbacks.
- Dismiss the operational toast for `idle`, `complete`, and `cancelled`, and on component unmount.
- Preserve all unrelated warning/error notifications, including asset warnings and the “draft not saved” error.
- Do not add dependencies or change backend/SSE contracts.
- Reuse the existing Sonner card, icon, typography, light/dark styling, and button treatment. Only add layout rules needed for multiple operational actions.
- Statuses such as `outline.status.searchingProvider` remain ordinary `statusMessage` updates; no SearXNG-specific component or toast is introduced.

## Review Focus

- Rapid status changes, including a SearXNG search message, update one toast instead of stacking multiple toasts.
- Terminal lifecycle changes and unmounting always dismiss the persistent toast.
- One stream failure produces exactly one error toast, even though both the hook and controller previously had notification responsibilities.
- Rejecting a draft-loss confirmation does not call `onCancel`; accepting it calls `onCancel` once and leaves the existing stopped-success notification behavior intact.
- On narrow screens, two or three action buttons wrap within the toast without covering the message, and every action remains keyboard-accessible.

---

## File Map

- Modify `components/ui/sonner.tsx`: allow operational toast options and add responsive layout for grouped toast actions.
- Modify `app/(presentation-generator)/components/GenerationStatusBar.tsx`: replace inline JSX with a renderless Sonner toast controller while retaining the existing public props.
- Modify `app/(presentation-generator)/presentation/components/PresentationPage.tsx`: mount the controller once without an editor-positioned overlay wrapper.
- Modify `app/(presentation-generator)/presentation/hooks/useBackgroundOutlineStream.ts`: report lifecycle failures only through `lifecycle` and `statusMessage`.
- Modify `app/(presentation-generator)/presentation/hooks/usePresentationStreaming.ts`: store the failure detail in `statusMessage` and stop emitting the duplicate lifecycle-failure toast.
- Create `cypress/component/generation-status-toast.cy.tsx`: exercise the real controller, Toaster, callbacks, lifecycle changes, and stream-hook failure integration.
- Modify `tests/gslide-ui-kit.test.mjs`: remove the obsolete source-text assertion for inline status-bar classes; behavior moves to Cypress.

### Task 1: Move generation status into one persistent Sonner toast

**Files:**
- Create: `cypress/component/generation-status-toast.cy.tsx`
- Modify: `components/ui/sonner.tsx`
- Modify: `app/(presentation-generator)/components/GenerationStatusBar.tsx`
- Modify: `tests/gslide-ui-kit.test.mjs`

**Interfaces:**
- Consumes: existing `GenerationStatusBar` props and the global `notify` API from `components/ui/sonner.tsx`.
- Produces: a renderless `GenerationStatusBar` that owns toast ID `generation-status` and exposes the same prop contract to `PresentationPage`.

- [ ] **Step 1: Write the failing component tests**

Create `cypress/component/generation-status-toast.cy.tsx` with real `GenerationStatusBar`, `Toaster`, and `I18nProvider` instances. Do not mock Sonner.

```tsx
import React, { useState } from "react";

import GenerationStatusBar from "../../app/(presentation-generator)/components/GenerationStatusBar";
import { I18nProvider } from "../../i18n/provider";
import type { GenerationLifecycleState } from "../../lib/generation-lifecycle";
import { Toaster } from "../../components/ui/sonner";

type HarnessProps = {
  initialLifecycle?: GenerationLifecycleState;
  draftCount?: number;
  canKeepWaiting?: boolean;
  onCancel?: () => void;
  onRetry?: () => void;
  onKeepWaiting?: () => void;
};

function Harness({
  initialLifecycle = "generating",
  draftCount = 0,
  canKeepWaiting = false,
  onCancel = () => {},
  onRetry = () => {},
  onKeepWaiting = () => {},
}: HarnessProps) {
  const [lifecycle, setLifecycle] =
    useState<GenerationLifecycleState>(initialLifecycle);
  const [message, setMessage] = useState("Đang soạn dàn ý bài thuyết trình");

  return (
    <I18nProvider locale="vi-VN">
      <button
        data-testid="show-search-status"
        onClick={() => setMessage("Đang tìm kiếm bằng SearXNG: thị trường AI")}
      >
        Search status
      </button>
      <button data-testid="complete" onClick={() => setLifecycle("complete")}>
        Complete
      </button>
      <GenerationStatusBar
        surface="outline"
        lifecycle={lifecycle}
        statusMessage={message}
        draftCount={draftCount}
        totalCount={5}
        canKeepWaiting={canKeepWaiting}
        onCancel={onCancel}
        onRetry={onRetry}
        onKeepWaiting={onKeepWaiting}
      />
      <Toaster position="top-center" />
    </I18nProvider>
  );
}

describe("generation status toast", () => {
  it("updates one top-center toast when generation moves into SearXNG search", () => {
    const onCancel = cy.stub().as("cancel");
    cy.mount(<Harness onCancel={onCancel} />);

    cy.get('[data-sonner-toaster][data-x-position="center"][data-y-position="top"]')
      .should("exist");
    cy.get('[data-testid="generation-status-toast"]')
      .should("have.length", 1)
      .and("contain", "Đang soạn dàn ý bài thuyết trình");

    cy.get('[data-testid="show-search-status"]').click();
    cy.get('[data-testid="generation-status-toast"]')
      .should("have.length", 1)
      .and("contain", "Đang tìm kiếm bằng SearXNG: thị trường AI");

    cy.contains('[data-testid="generation-status-toast"] button', "Dừng").click();
    cy.get("@cancel").should("have.been.calledOnce");
  });

  it("shows recovery actions without a dismiss button", () => {
    const onCancel = cy.stub().as("cancel");
    const onRetry = cy.stub().as("retry");
    const onKeepWaiting = cy.stub().as("keepWaiting");

    cy.mount(
      <Harness
        initialLifecycle="stalled"
        canKeepWaiting
        onCancel={onCancel}
        onRetry={onRetry}
        onKeepWaiting={onKeepWaiting}
      />,
    );

    cy.get('[data-testid="generation-status-toast"] [data-close-button]')
      .should("not.exist");
    cy.contains("button", "Tiếp tục chờ").click();
    cy.contains("button", "Thử lại").click();
    cy.contains("button", "Dừng").click();
    cy.get("@keepWaiting").should("have.been.calledOnce");
    cy.get("@retry").should("have.been.calledOnce");
    cy.get("@cancel").should("have.been.calledOnce");
  });

  it("dismisses the operational toast when generation completes", () => {
    cy.mount(<Harness />);
    cy.get('[data-testid="generation-status-toast"]').should("exist");
    cy.get('[data-testid="complete"]').click();
    cy.get('[data-testid="generation-status-toast"]').should("not.exist");
  });

  it("keeps generation running when the draft-loss confirmation is rejected", () => {
    const onCancel = cy.stub().as("cancel");
    cy.on("window:confirm", () => false);
    cy.mount(<Harness draftCount={2} onCancel={onCancel} />);
    cy.contains('[data-testid="generation-status-toast"] button', "Dừng").click();
    cy.get("@cancel").should("not.have.been.called");
  });
});
```

The test catches these regressions: rendering outside Sonner, creating one toast per status update, losing recovery actions, exposing a misleading close button, failing to dismiss terminal state, and bypassing the draft confirmation.

- [ ] **Step 2: Run the Cypress spec and verify RED**

Run:

```bash
npx cypress run --component --browser electron --spec cypress/component/generation-status-toast.cy.tsx
```

Expected: FAIL because the current component renders an inline card and does not create `[data-testid="generation-status-toast"]` inside the top-center Sonner toaster. A compile error or missing provider is not the intended failure; fix test setup until the assertion fails for this behavioral reason.

- [ ] **Step 3: Expand the shared notify options for a persistent operational toast**

In `components/ui/sonner.tsx`, add the supported Sonner fields needed by the controller:

```tsx
type NotifyOptions = Pick<
  ExternalToast,
  | "duration"
  | "id"
  | "action"
  | "cancel"
  | "closeButton"
  | "dismissible"
  | "testId"
  | "onDismiss"
  | "onAutoClose"
  | "className"
>;
```

Add grouped-action CSS beside the existing `[data-button]` rules. Each nested button deliberately carries `data-button` so it reuses the same visual treatment as the “Got it!” button:

```css
[data-sonner-toast][data-styled="true"].generation-status-toast {
  cursor: default !important;
}

[data-sonner-toast][data-styled="true"] .generation-toast-actions {
  display: flex !important;
  flex: 0 0 auto !important;
  flex-wrap: wrap !important;
  align-items: center !important;
  justify-content: flex-end !important;
  gap: 6px !important;
  margin-left: auto !important;
}

[data-sonner-toast][data-styled="true"] .generation-toast-actions [data-button] {
  margin-left: 0 !important;
}

@media (max-width: 640px) {
  [data-sonner-toast][data-styled="true"].generation-status-toast {
    flex-wrap: wrap !important;
  }

  [data-sonner-toast][data-styled="true"] .generation-toast-actions {
    flex-basis: 100% !important;
    justify-content: flex-start !important;
    margin-left: 31px !important;
  }
}
```

- [ ] **Step 4: Replace the inline card with the toast controller**

Keep the existing props, confirmation copy, and stopped-success copy in `GenerationStatusBar.tsx`. Remove `Button`, `Loader2`, the `cn` import, inline card styles, and all returned status markup. Keep the optional `className` field in `Props` for compatibility during this task, but do not destructure or use it. Import `useEffect` and `notify`; use Sonner's existing default warning/error/loading icons.

Use a stable ID and one action group:

```tsx
const GENERATION_TOAST_ID = "generation-status";

type ActionKey = "keepWaiting" | "retry" | "stop";

function GenerationToastActions({
  actions,
  onKeepWaiting,
  onRetry,
  onStop,
}: {
  actions: ActionKey[];
  onKeepWaiting: () => void;
  onRetry: () => void;
  onStop: () => void;
}) {
  const t = useT();
  return (
    <div className="generation-toast-actions">
      {actions.includes("keepWaiting") && (
        <button type="button" data-button onClick={onKeepWaiting}>
          {t("common.generation.keepWaiting")}
        </button>
      )}
      {actions.includes("retry") && (
        <button type="button" data-button onClick={onRetry}>
          {t("common.generation.retry")}
        </button>
      )}
      {actions.includes("stop") && (
        <button type="button" data-button onClick={onStop}>
          {t("common.generation.stop")}
        </button>
      )}
    </div>
  );
}
```

Implement the effect with these exact lifecycle mappings:

| Lifecycle | Toast API | Title | Description | Actions |
| --- | --- | --- | --- | --- |
| `connecting`, `generating` | `notify.loading` | `statusMessage` | none | Stop |
| `stalled` | `notify.warning` | `common.generation.takingLonger` | `statusMessage` or `presentation.status.noContent` | Keep waiting when allowed, Retry, Stop |
| `cancelling` | `notify.loading` | `presentation.status.stopping` | none | none |
| `failed` | `notify.error` | outline: `outline.toast.streamingFailed.title`; presentation: `presentation.status.streamingFailed` | `statusMessage` | Retry, Stop |
| `idle`, `complete`, `cancelled` | `notify.dismiss` | none | none | none |

Every non-terminal call uses:

```tsx
const toastOptions = {
  id: GENERATION_TOAST_ID,
  duration: Infinity,
  closeButton: false,
  dismissible: false,
  testId: "generation-status-toast",
  className: "generation-status-toast",
  action: (
    <GenerationToastActions
      actions={actions}
      onKeepWaiting={() => void onKeepWaiting()}
      onRetry={() => void onRetry()}
      onStop={handleStop}
    />
  ),
} as const;
```

Do not pass an empty action group for `cancelling`; omit `action` in that state. `handleStop` must retain `needsCancelConfirm`, `window.confirm`, and the existing stopped-success notification, but use `notify.success` instead of importing raw `toast` from `sonner`.

Add an unmount-only cleanup effect so route changes cannot strand an infinite-duration toast:

```tsx
useEffect(
  () => () => {
    notify.dismiss(GENERATION_TOAST_ID);
  },
  [],
);
```

The component returns `null`.

- [ ] **Step 5: Remove the obsolete source-text test**

Delete only the `GenerationStatusBar uses stall copy and gslide tokens` test from `tests/gslide-ui-kit.test.mjs`. Its assertions describe the retired inline card (`w-fit`, `max-w-[min(100%,22rem)]`) and test source text rather than user-visible behavior. The Cypress spec now covers the real UI and callbacks.

- [ ] **Step 6: Run the focused tests and verify GREEN**

Run:

```bash
npx cypress run --component --browser electron --spec cypress/component/generation-status-toast.cy.tsx
node --test tests/gslide-ui-kit.test.mjs
npm run typecheck
```

Expected: all commands exit 0. Inspect the Cypress video/screenshot on failure; do not weaken selectors to accept an inline element outside `[data-sonner-toaster]`.

- [ ] **Step 7: Commit the toast controller**

```bash
git add components/ui/sonner.tsx 'app/(presentation-generator)/components/GenerationStatusBar.tsx' cypress/component/generation-status-toast.cy.tsx tests/gslide-ui-kit.test.mjs
git commit -m "feat: move generation status into toast"
```

### Task 2: Remove the editor overlay and centralize stream failure notifications

**Files:**
- Modify: `app/(presentation-generator)/presentation/components/PresentationPage.tsx`
- Modify: `app/(presentation-generator)/presentation/hooks/useBackgroundOutlineStream.ts`
- Modify: `app/(presentation-generator)/presentation/hooks/usePresentationStreaming.ts`
- Modify: `cypress/component/generation-status-toast.cy.tsx`

**Interfaces:**
- Consumes: the unchanged `GenerationStatusBar` prop contract from Task 1 and lifecycle/status values returned by both stream hooks.
- Produces: exactly one lifecycle toast for a stream failure and no editor-positioned generation overlay.

- [ ] **Step 1: Add failing integration coverage for duplicate failure toasts**

Extend `generation-status-toast.cy.tsx` with a `FakeEventSource` that records instances and can emit a JSON `response` event. Add two small harnesses: one calls `useBackgroundOutlineStream`, and one calls `usePresentationStreaming`; both pass the returned lifecycle, status, and controls into `GenerationStatusBar` and mount one real `Toaster`.

The presentation harness should call:

```tsx
const stream = usePresentationStreaming(
  "presentation-123",
  "true",
  () => {},
  () => {},
  () => {},
  { skipSlideFetch: true },
);
```

Wrap hook harnesses with the real Redux `Provider`, `store`, and `I18nProvider`, following `cypress/component/automatic-presentation-generation.cy.tsx`.

For each hook, emit a server failure and require exactly one operational error toast:

```tsx
FakeEventSource.instances[0].emitResponse({
  type: "error",
  detail: "Provider generation failed",
});

cy.get('[data-testid="generation-status-toast"]')
  .should("have.length", 1)
  .and("contain", "Provider generation failed");
cy.get('[data-sonner-toast]').should("have.length", 1);
```

Run the outline and presentation variants in separate tests with `FakeEventSource.instances = []` and `notify.dismiss()` cleanup in `beforeEach`/`afterEach`, so one test cannot leak an infinite toast into another.

This test catches the actual regression: a hook-owned error toast plus a controller-owned error toast appearing for the same failure.

- [ ] **Step 2: Run the duplicate-failure tests and verify RED**

Run:

```bash
npx cypress run --component --browser electron --spec cypress/component/generation-status-toast.cy.tsx
```

Expected: the new failure cases see two Sonner toasts, or otherwise fail because the hook and controller both publish the failure. Confirm the failure is not caused by a stale toast from another test.

- [ ] **Step 3: Make outline stream failures state-only**

In `useBackgroundOutlineStream.ts`:

- Remove the `notify` import if no non-lifecycle notification remains.
- Change `failStream(message, title?)` to `failStream(message)`.
- Keep `closeStreamResources()`, `setLifecycle("failed")`, and `setStatusMessage(message)`.
- Remove `notify.error(...)` from `failStream` and the SSE `case "error"` branch.
- Continue translating backend error details before assigning `statusMessage`.
- Update `failStream` callers to pass only the description.

The controller now supplies the localized title `outline.toast.streamingFailed.title`; the hook supplies the detailed description.

- [ ] **Step 4: Make presentation stream failures state-only and preserve the detail**

In `usePresentationStreaming.ts`, reduce `finalizeFailure` to a single `description: string` parameter. Preserve its cleanup, Redux, URL, and error-state behavior, then add the missing status assignment and remove only the lifecycle-failure notification:

```tsx
const finalizeFailure = (description: string) => {
  console.error("Presentation streaming failed", description);
  closeEventSource();
  clearRetryTimer();
  clearStallInterval();
  setLoading(false);
  dispatch(setStreaming(false));
  setError(true);
  setStatusMessage(description);
  setLifecycle("failed");
  removeStreamParamFromUrl();
};
```

Do not remove the `notify` import because this hook still uses it for asset warnings and the “draft not saved” error. Do not change those unrelated notifications.

- [ ] **Step 5: Remove the editor-positioned wrapper**

In `PresentationPage.tsx`:

- Rename the local variable from `generationStatusOverlay` to `generationStatusToast`.
- Remove `className="!mt-0"` from the component invocation because the toast controller ignores placement classes.
- Render `{generationStatusToast}` once inside the page's returned root.
- Delete this editor-canvas positioning wrapper completely:

```tsx
<div className="pointer-events-none absolute right-2 top-3 z-40">
  <div className="pointer-events-auto">{generationStatusOverlay}</div>
</div>
```

Do not move or duplicate `<Toaster>`; `app/ClientRoot.tsx` already owns the app-wide top-center instance.

- [ ] **Step 6: Run focused integration tests and verify GREEN**

Run:

```bash
npx cypress run --component --browser electron --spec cypress/component/generation-status-toast.cy.tsx,cypress/component/automatic-presentation-generation.cy.tsx
node --test tests/generation-lifecycle.test.mjs tests/automatic-presentation-generation.test.mjs
npm run typecheck
```

Expected: all commands exit 0; each simulated stream failure leaves exactly one generation error toast containing the backend detail.

- [ ] **Step 7: Commit the integration change**

```bash
git add 'app/(presentation-generator)/presentation/components/PresentationPage.tsx' 'app/(presentation-generator)/presentation/hooks/useBackgroundOutlineStream.ts' 'app/(presentation-generator)/presentation/hooks/usePresentationStreaming.ts' cypress/component/generation-status-toast.cy.tsx
git commit -m "fix: centralize generation lifecycle notifications"
```

### Task 3: Full verification and visual acceptance

**Files:**
- No production files should change unless verification finds a defect.

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces: evidence that the notification behavior and repository checks pass.

- [ ] **Step 1: Run the full repository verification**

Run:

```bash
npm run check
```

Expected: Node tests, i18n hardcoded-copy check, ESLint, TypeScript, and Knip all exit 0. If the repository has a pre-existing failure, record the exact failing command and test/lint rule; do not report a green check.

- [ ] **Step 2: Re-run all Cypress component tests**

Run:

```bash
npx cypress run --component --browser electron
```

Expected: all component specs pass, including the new generation toast spec and existing automatic-generation coverage.

- [ ] **Step 3: Perform a manual browser acceptance pass**

Run the app with `npm run dev` and verify these observable cases:

1. Outline generation shows one toast at the same top-center position as “Đã xóa bài thuyết trình”.
2. When the message changes to SearXNG search, the same toast updates in place and the toast count stays one.
3. Slide generation uses the same toast and preserves the Stop confirmation when slides already exist.
4. Stalled state shows Keep waiting only when `canKeepWaiting` is true, plus Retry and Stop.
5. Failed state shows Retry and Stop, no “Got it!”/close control, and only one error toast.
6. Complete, cancel, and route unmount remove the infinite operational toast.
7. At a viewport narrower than 640 px, all action buttons wrap inside the card and remain clickable.
8. Light and dark themes retain readable icon, text, border, and button contrast.

- [ ] **Step 4: Inspect the final diff**

Run:

```bash
git diff --check
git status --short
git log -2 --oneline
```

Expected: no whitespace errors; only the files listed in this plan are changed; the two task commits are present. Do not commit generated Cypress videos/screenshots unless the repository already tracks them.
