# Retry Stopped Presentation Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep a visible **Thử lại** action after the user deliberately stops slide generation, then resume generation from the first slide that the backend has not persisted.

**Architecture:** Reuse the existing `cancelled` lifecycle state instead of treating a user stop as an error. `GenerationStatusBar` will render a persistent, presentation-only stopped toast with a retry action, while `usePresentationStreaming` will preserve `cancelled` when the `stream` query parameter is removed and permit that state to reopen its existing SSE controller. The backend remains unchanged because `stream_presentation` already reloads the contiguous saved-slide prefix and only calls the LLM for missing slides.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Redux Toolkit, browser `EventSource`, Sonner 2, Cypress component tests.

**Spec:** Approved bounded design in the 2026-09-23 conversation; no standalone spec document.

## Global Constraints

- Do not modify the backend; `gslide-api/servers/fastapi/api/v1/ppt/endpoints/presentation.py` already resumes from `_load_saved_slide_prefix`.
- Preserve the current best-effort draft persistence in `cancel()` and never clear `presentationData` when stopping or retrying.
- Remove the `stream` query parameter when the user stops so a browser refresh does not restart generation automatically.
- A retry in the same mounted page must work even after the `stream` prop changes to `null`.
- Keep existing `stalled` and `failed` retry behavior unchanged.
- Keep outline-generation cancellation behavior unchanged; this feature applies only to `surface="presentation"`.
- Reuse `presentation.status.stopped` and `presentation.status.stoppedWithDraft`; add no translation keys.
- Preserve unrelated working-tree changes and stage only the paths named by each task.

## Review Focus

- A stop before the first slide exists must still show **Thử lại** and reopen exactly one stream; Task 1 covers the zero-draft copy and Task 2 covers the new stream.
- Removing `stream` from the URL must not collapse `cancelled` to `idle`; Task 2 explicitly changes the hook prop to `null` before retrying.
- One stop/retry action must create one replacement `EventSource`, not parallel streams; Task 2 checks the old source is closed and the instance count grows from one to two.
- Existing retry behavior after an SSE `error` must remain visible and operational; Task 2 reruns the existing stream-failure integration cases.
- Outline cancellation must retain its existing dismissal behavior; Task 1 adds an explicit outline regression case.

---

### Task 1: Render a recoverable stopped-presentation toast

**Files:**
- Modify: `app/(presentation-generator)/components/GenerationStatusBar.tsx:69-204`
- Test: `cypress/component/generation-status-toast.cy.tsx:86-135,298-410`

**Interfaces:**
- Consumes: `GenerationLifecycleState` with the existing `"cancelled"` member; `surface: "outline" | "presentation"`; `draftCount: number`; `onRetry: () => void`.
- Produces: for `surface="presentation"` and `lifecycle="cancelled"`, one persistent Sonner toast whose only action is `onRetry`; outline cancellation continues to dismiss the operational toast.

- [ ] **Step 1: Extend the Cypress harness to accept a generation surface**

Add a `surface` prop with an outline default so existing tests retain their behavior:

```tsx
type HarnessProps = {
  surface?: "outline" | "presentation";
  initialLifecycle?: GenerationLifecycleState;
  draftCount?: number;
  canKeepWaiting?: boolean;
  onCancel?: () => void;
  onRetry?: () => void;
  onKeepWaiting?: () => void;
};
```

Add `surface` to the current function parameter list:

```tsx
function Harness({
  surface = "outline",
  initialLifecycle = "generating",
  draftCount = 0,
  canKeepWaiting = false,
  onCancel = () => {},
  onRetry = () => {},
  onKeepWaiting = () => {},
}: HarnessProps) {
```

Replace the hard-coded `surface="outline"` passed to `GenerationStatusBar` with:

```tsx
surface={surface}
```

- [ ] **Step 2: Write failing stopped-presentation toast tests**

Add these cases to the `generation status toast` describe block:

```tsx
it("keeps a retry action visible after presentation generation is stopped", () => {
  const onRetry = cy.stub().as("retry");
  cy.mount(
    <Harness
      surface="presentation"
      initialLifecycle="cancelled"
      draftCount={3}
      onRetry={onRetry}
    />,
  );

  cy.get('[data-testid="generation-status-toast"]')
    .should("have.length", 1)
    .and("contain", "Đã dừng tạo. Bản nháp hiện tại đã được giữ lại.");
  cy.contains('[data-testid="generation-status-toast"] button', "Thử lại")
    .click();
  cy.contains('[data-testid="generation-status-toast"] button', "Dừng")
    .should("not.exist");
  cy.get("@retry").should("have.been.calledOnce");
});

it("allows retry when presentation generation stopped before the first slide", () => {
  cy.mount(
    <Harness
      surface="presentation"
      initialLifecycle="cancelled"
      draftCount={0}
    />,
  );

  cy.get('[data-testid="generation-status-toast"]')
    .should("contain", "Đã dừng tạo.");
  cy.contains('[data-testid="generation-status-toast"] button', "Thử lại")
    .should("exist");
});

it("continues to dismiss a cancelled outline toast", () => {
  cy.mount(<Harness surface="outline" initialLifecycle="cancelled" />);
  cy.get('[data-testid="generation-status-toast"]').should("not.exist");
});
```

- [ ] **Step 3: Run the Cypress spec and verify the intended failures**

Run:

```powershell
npx cypress run --component --browser electron --spec cypress/component/generation-status-toast.cy.tsx
```

Expected: the new presentation-cancelled cases fail because the current early-dismiss condition includes `cancelled`; existing tests remain green. Fix test setup if the failure is a missing provider, translation, or toaster rather than the cancelled behavior.

- [ ] **Step 4: Implement the presentation-only cancelled toast**

In `GenerationStatusBar.tsx`:

1. Change the early dismissal condition so `cancelled` dismisses only for outline generation:

```tsx
if (
  lifecycle === "idle" ||
  lifecycle === "complete" ||
  (lifecycle === "cancelled" && surface !== "presentation")
) {
  notify.dismiss(GENERATION_TOAST_ID);
  return;
}
```

2. Prevent the click handler from creating a second success toast for presentation generation. Preserve the existing one-time notification for outline generation:

```tsx
void onCancel();
if (surface === "outline") {
  notify.success(
    draftCount > 0
      ? t("presentation.status.stoppedWithDraft")
      : t("presentation.status.stopped"),
  );
}
```

3. Add a `cancelled` switch case that uses the existing copy and offers only retry:

```tsx
case "cancelled":
  if (surface === "presentation") {
    notify.success(
      draftCount > 0
        ? t("presentation.status.stoppedWithDraft")
        : t("presentation.status.stopped"),
      undefined,
      publishOptions({
        description: undefined,
        action: toastActions(["retry"]),
      }),
    );
  }
  break;
```

Keep `id: GENERATION_TOAST_ID`, `duration: Infinity`, and the non-dismissible options from `baseOptions`; they ensure the cancelled state updates the same operational toast instead of adding a duplicate.

- [ ] **Step 5: Run the focused Cypress spec**

Run:

```powershell
npx cypress run --component --browser electron --spec cypress/component/generation-status-toast.cy.tsx
```

Expected: all cases pass, including the three new cancelled-state cases and the existing failed/stalled cases.

- [ ] **Step 6: Commit Task 1**

```powershell
git add 'app/(presentation-generator)/components/GenerationStatusBar.tsx' cypress/component/generation-status-toast.cy.tsx
git commit -m "feat: keep retry visible after stopping generation"
```

### Task 2: Reopen the presentation stream from `cancelled`

**Files:**
- Modify: `app/(presentation-generator)/presentation/hooks/usePresentationStreaming.ts:197-213,718-802`
- Test: `cypress/component/generation-status-toast.cy.tsx:12-47,137-285`

**Interfaces:**
- Consumes: `usePresentationStreaming(...).cancel()` and `.retry()`, the existing `openStreamRef: MutableRefObject<() => void>`, and `stream: string | null` from the page query.
- Produces: `cancel()` synchronously establishes a durable `cancelled` lifecycle before removing the query parameter; `retry()` accepts `cancelled` and opens one new `EventSource` without clearing the draft.

- [ ] **Step 1: Make the EventSource test double observable**

Add this field immediately after `static instances` in `FakeEventSource`:

```tsx
closed = false;
```

Replace the empty `close() {}` method with:

```tsx
close() {
  this.closed = true;
}
```

- [ ] **Step 2: Add a stateful stop/retry harness**

Place this harness near `PresentationStreamHarness`. The `sync-stream-param` button simulates Next updating `useSearchParams` after `cancel()` removes `stream` from browser history:

```tsx
function StoppedPresentationStreamHarness() {
  const [streamParam, setStreamParam] = useState<string | null>("true");
  const stream = usePresentationStreaming(
    "presentation-123",
    streamParam,
    () => {},
    () => {},
    () => {},
    { skipSlideFetch: true },
  );

  return (
    <>
      <button
        type="button"
        data-testid="sync-stream-param"
        onClick={() => setStreamParam(null)}
      >
        Sync stream URL
      </button>
      <GenerationStatusBar
        surface="presentation"
        lifecycle={stream.lifecycle}
        statusMessage={stream.statusMessage}
        draftCount={stream.draftCount}
        totalCount={8}
        canKeepWaiting={stream.canKeepWaiting}
        onCancel={() => void stream.cancel()}
        onKeepWaiting={stream.keepWaiting}
        onRetry={stream.retry}
      />
      <Toaster position="top-center" />
    </>
  );
}
```

- [ ] **Step 3: Write the failing stop-to-retry integration test**

```tsx
it("reopens exactly one presentation stream after a user stop", () => {
  resetStreamFailureHarness();
  cy.window().then((win) => {
    win.history.replaceState({}, "", "/presentation?stream=true");
    win.EventSource = FakeEventSource as unknown as typeof EventSource;
  });
  mountStreamHarness(<StoppedPresentationStreamHarness />);

  cy.wrap(null).should(() => {
    expect(FakeEventSource.instances).to.have.length(1);
  });

  cy.contains('[data-testid="generation-status-toast"] button', "Dừng")
    .click();
  cy.wrap(null).should(() => {
    expect(FakeEventSource.instances[0].closed).to.equal(true);
  });
  cy.location("search").should("not.contain", "stream");

  cy.get('[data-testid="sync-stream-param"]').click();
  cy.get('[data-testid="generation-status-toast"]')
    .should("contain", "Đã dừng tạo.");

  cy.contains('[data-testid="generation-status-toast"] button', "Thử lại")
    .click();
  cy.wrap(null).should(() => {
    expect(FakeEventSource.instances).to.have.length(2);
    expect(FakeEventSource.instances[1].closed).to.equal(false);
  });
  cy.location("search").should("not.contain", "stream");
});
```

- [ ] **Step 4: Run the test and verify the intended failure**

Run:

```powershell
npx cypress run --component --browser electron --spec cypress/component/generation-status-toast.cy.tsx
```

Expected: the new test fails after synchronizing `streamParam` because the hook resets to `idle`, or retry creates no second `FakeEventSource` because `retry()` rejects `cancelled`. The test must reach one of these behavioral failures; setup/runtime errors do not count as RED.

- [ ] **Step 5: Preserve `cancelled` after the query parameter disappears**

Replace the current `if (!stream)` block at the top of the stream effect with:

```tsx
if (!stream) {
  if (lifecycleRef.current !== "cancelled") {
    setLifecycle("idle");
    if (!skipSlideFetch) {
      fetchUserSlides();
    }
  }
  return;
}
```

This keeps the stopped toast mounted after Next reflects the URL change. A full browser refresh still initializes a fresh hook with lifecycle `idle`, so generation does not restart.

- [ ] **Step 6: Establish `cancelled` before changing browser history**

In `cancel()`, move the cancelled transition before URL mutation and update the ref synchronously:

```tsx
dispatch(setStreaming(false));
setLoading(false);
lifecycleRef.current = "cancelled";
setLifecycle("cancelled");

if (typeof window !== "undefined") {
  const newUrl = new URL(window.location.href);
  newUrl.searchParams.delete("stream");
  window.history.replaceState({}, "", newUrl.toString());
}
```

Delete the old later `setLifecycle("cancelled")`. Update the nearby comment: cancelled is set before URL synchronization so the stopped state and retry action survive, while draft persistence remains best-effort and unchanged.

- [ ] **Step 7: Allow retry from `cancelled`**

Change the retry guard and synchronously advance the lifecycle ref before opening the retained stream controller:

```tsx
const retry = useCallback(() => {
  const fromState = lifecycleRef.current;
  if (
    fromState !== "stalled" &&
    fromState !== "failed" &&
    fromState !== "cancelled"
  ) {
    return;
  }

  hasUsefulEventRef.current = false;
  retryCountRef.current = 0;
  isClosedRef.current = false;
  accumulatedChunksRef.current = "";
  previousSlidesLength.current = 0;
  lastUsefulEventAtRef.current = null;
  streamStartedAtRef.current = null;
  stallCauseRef.current = null;
  setStallCause(null);
  dispatch(setStreaming(true));
  setError(false);
  lifecycleRef.current = "connecting";
  setLifecycle("connecting");
  setStatusMessage(defaultStatusMessage);
  openStreamRef.current();
}, [defaultStatusMessage, dispatch, setError]);
```

Do not call `clearPresentationData()`. The current draft must remain visible until the backend re-emits the saved prefix and proceeds with missing slides.

- [ ] **Step 8: Run focused and regression tests**

Run:

```powershell
npx cypress run --component --browser electron --spec cypress/component/generation-status-toast.cy.tsx
npm test
npm run typecheck
npm run lint
```

Expected:

- The stop/retry test observes one closed source followed by exactly one new source.
- The existing SSE-error tests still show one retryable error toast.
- All Node tests and type checks pass.
- ESLint exits successfully within the repository's configured warning limit.

- [ ] **Step 9: Commit Task 2**

```powershell
git add 'app/(presentation-generator)/presentation/hooks/usePresentationStreaming.ts' cypress/component/generation-status-toast.cy.tsx
git commit -m "feat: resume presentation generation after stop"
```

### Task 3: Verify the complete frontend behavior

**Files:**
- Verify only; do not create or modify files unless a failure identifies a defect in Task 1 or Task 2.

**Interfaces:**
- Consumes: the completed stopped-toast and cancelled-stream behavior from Tasks 1 and 2.
- Produces: fresh evidence that the full component suite and repository checks pass.

- [ ] **Step 1: Run all Cypress component tests**

```powershell
npx cypress run --component --browser electron
```

Expected: all component specs pass with no duplicate generation toast failures.

- [ ] **Step 2: Run the repository check suite**

```powershell
npm run check
```

Expected: Node tests, i18n copy checks, ESLint, TypeScript, and dead-code checks all pass.

- [ ] **Step 3: Review the final diff**

```powershell
git diff --check
git status --short
git diff -- 'app/(presentation-generator)/components/GenerationStatusBar.tsx' 'app/(presentation-generator)/presentation/hooks/usePresentationStreaming.ts' cypress/component/generation-status-toast.cy.tsx
```

Expected: no whitespace errors; only the planned frontend files plus pre-existing user-owned changes are present. Confirm no backend files, translation files, or lifecycle type definitions changed.
