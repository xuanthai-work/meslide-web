# Background Outline Generation and Route Removal Design

## Context

The new-presentation flow already bypasses outline review after template selection, but `/outline` still exists as both the automatic flow's template-picker route and a manually accessible outline editor. The presentation editor then runs the former outline checkpoint in the background.

This split leaves two creation paths, preserves a manual editor that is no longer part of the intended product flow, and forces automatic-generation fallbacks to navigate back to `/outline`.

## Intent

Make `/presentation` the only post-create surface. Users select a template there, see a compact generation status, and enter the editor as soon as slide streaming begins. Outline generation remains an internal, persisted prerequisite for slide generation, but users can no longer review or edit the outline directly.

Success means:

- New prompt and document flows never navigate to `/outline`.
- `/outline` no longer exists and returns the framework's normal 404 response.
- Template selection appears inside `/presentation` before automatic generation starts.
- Outline generation continues in the background and its completed result remains the source of truth for `presentationPrepare`.
- Users see lifecycle feedback and recovery actions, but never partial outline content.
- Cancelling background outline generation returns to the template picker without reusing an incomplete outline.

## Non-goals

- Removing the backend outline model, outline persistence, outline APIs, or the outline-to-slide generation step.
- Replacing SSE with polling or a new background-job system.
- Redesigning template cards or the presentation editor.
- Changing slide-generation streaming.
- Optimizing backend network traffic by suppressing outline token chunks. The client will stop parsing and rendering them; changing the server wire volume can be evaluated separately.

## Chosen Architecture

`/presentation` owns two pre-editor stages in addition to its existing editor:

1. **Template selection:** `auto=1` is present and `template` is absent.
2. **Background outline bootstrap:** both `auto=1` and `template=<id>` are present.

After `presentationPrepare` succeeds, the URL becomes `/presentation?id=<id>&stream=true`, preserving the existing slide-streaming behavior.

The implementation keeps transport and orchestration separate:

- `PresentationTemplatePicker` owns the full-page template-selection surface.
- `useBackgroundOutlineStream` owns the SSE connection and generation lifecycle.
- `useAutomaticPresentationGeneration` owns hydration, template-aware orchestration, `presentationPrepare`, navigation, retry, and cancellation transitions.
- `PresentationPage` selects the picker or editor surface and displays the existing generation status UI.

This structure is preferred over putting all logic in `PresentationPage`, which would further enlarge an already broad component, and over adding a replacement template route, which would keep the extra wizard route the change is intended to remove.

## User Flow

### Prompt-only creation

1. `/upload` creates the presentation record.
2. The client navigates to `/presentation?id=<id>&auto=1`.
3. `PresentationTemplatePicker` loads default and custom template summaries.
4. Selecting a template replaces the URL with `/presentation?id=<id>&auto=1&template=<template-id>`.
5. The automatic-generation orchestrator checks for an already completed persisted outline.
6. If no completed outline exists, it starts the background outline SSE stream.
7. The final outline from the `complete` event is stored in Redux and passed to `presentationPrepare` with the selected template.
8. The client replaces the URL with `/presentation?id=<id>&stream=true` and the existing slide stream begins.

### Document creation

Document upload, decomposition, and presentation creation remain unchanged. The document-preview and upload entry points both navigate to `/presentation?id=<id>&auto=1`, after which the same template and background-generation flow applies.

### Reload and resume

On `/presentation?id=<id>&auto=1&template=<template-id>`, the orchestrator first calls `getOutlines`.

- A persisted non-empty outline is considered complete because the outline endpoint persists the model only after generation validation succeeds.
- If no outline is persisted, the client starts a new outline stream.
- Once a complete outline is available, preparation runs exactly once for that bootstrap attempt.

### Cancellation

Stopping during background outline generation:

1. Closes the EventSource and related retry/stall timers.
2. Does not persist partial chunks.
3. Clears temporary outline data from Redux.
4. Replaces the URL with `/presentation?id=<id>&auto=1`.
5. Shows the template picker again for the same presentation record.

The cancelled partial outline must not be reused for `presentationPrepare`.

## Background Outline SSE Contract

The existing SSE endpoint remains the transport. The browser consumes events as follows:

- `status`: update the compact, localized generation message and count as useful progress.
- `chunk`: count as useful progress for stall detection, but do not parse JSON, update Redux, expose a draft count, or render outline content.
- `heartbeat`: prove transport liveness only. It does not reset the useful-progress clock because a connected task can still be stalled.
- `complete`: read the final persisted outline from `presentation.outlines.slides`, normalize it, store it in Redux, and mark outline generation complete.
- `error`: close the stream and expose retry and return-to-picker recovery actions.
- `closing`: retain compatibility with the existing lifecycle, but preparation may proceed only when a non-empty final outline is available.

The status bar shows coarse progress only. It does not show partial outline sections or a draft count during this phase.

## Components and Ownership

### Presentation template picker

Move the reusable template-list behavior out of the outline route and into the presentation feature. The new picker uses the shared template-list primitives and shared GSlide header/chrome. It preserves:

- Built-in and custom template lists.
- Suggested-template resolution by ID or normalized name.
- Existing loading, empty, and error states.
- The create-custom-template entry.

It no longer accepts outline-specific state or renders outline copy.

### Background stream hook

Move the retained SSE lifecycle behavior into the presentation hooks directory and rename it for its actual responsibility. Remove UI-preview state and parsing:

- Active outline index.
- Highest active index.
- Partial JSON accumulation and `jsonrepair` use.
- Partial Redux outline updates.
- Partial-draft persistence on cancel.

Keep:

- EventSource ownership and cleanup.
- Silent reconnect before useful progress.
- Stall detection.
- Keep-waiting and retry controls.
- Backend status/error localization.
- Final outline normalization and dispatch on `complete`.

### Automatic-generation orchestrator

The orchestrator no longer redirects to `/outline` when the template is absent or generation is cancelled. It stays idle while the picker is visible, starts only when a template ID is present, and exposes a return-to-picker action for cancellation or terminal failure recovery.

It must guard `presentationPrepare` so React effects, URL changes, reconnects, and repeated completion signals cannot submit the same bootstrap attempt more than once.

### Removed outline editor

Delete the outline route, loading boundary, editor components, editor-only hooks, and editor-only types. This includes manual outline add/edit/delete/reorder, outline chat, regenerate controls, and the manual Generate button.

Delete `useStableOutlineIds` once its final outline-editor consumer is removed. Keep drag-and-drop dependencies because the presentation slide side panel still uses them.

## Routing

Update every automatic-creation entry point to target `/presentation?id=<id>&auto=1`.

Remove `/outline` from dashboard/header path handling. No redirect or compatibility page replaces the deleted route; direct visits receive the normal Next.js 404.

No source, Cypress expectation, or test fixture may retain navigation to `/outline`.

## Error Handling

- **Missing presentation ID:** retain the presentation page's existing missing-ID recovery.
- **Template list failure:** keep the user on the picker and show its localized load error.
- **Outline hydration failure:** show the background-generation failed state with Retry and return-to-picker actions.
- **Outline stream stall:** retain Keep waiting, Retry, and Stop behavior. Heartbeats alone do not suppress a stall.
- **Invalid or empty complete payload:** treat it as a generation failure and never call `presentationPrepare`.
- **Preparation failure:** show Retry and return-to-picker actions without navigating to slide streaming.
- **Cancellation:** discard all client-side partial outline state before returning to the picker.
- **Unmount or URL change:** close EventSource and clear timers so stale callbacks cannot prepare or navigate.

## Localization and Copy

Keep outline-related backend status/error keys that describe the internal generation phase. Remove keys used only by the deleted outline editor, including manual editing, reorder, regenerate, outline chat, and manual Generate controls.

Move template-picker copy to a route-neutral namespace so shared template-list UI no longer depends on `outline.template.*`. User-facing progress copy should describe presentation preparation rather than invite outline review.

English and Vietnamese locale shapes must remain identical and pass the existing localization checks.

## Testing Strategy

### Source-contract tests

Update the automatic-generation test to assert:

- Upload and document-preview flows target `/presentation?...&auto=1`.
- `PresentationPage` renders the template picker when automatic generation lacks a template.
- Template selection adds `template=<id>` without leaving `/presentation`.
- The orchestrator never contains `/outline` navigation.
- The route and editor files no longer exist.

### Background stream lifecycle tests

Retarget lifecycle tests to `useBackgroundOutlineStream` and assert:

- `chunk` refreshes useful-progress timing but does not parse partial JSON or dispatch `setOutlines`.
- `heartbeat` does not count as useful generation progress.
- `complete` normalizes and dispatches the final outline.
- Empty or malformed completion fails safely.
- Cancel closes resources, clears temporary outlines, and does not call `updateOutlines`.
- Retry and keep-waiting retain their current lifecycle guarantees.

### Picker and orchestration tests

Cover:

- Picker loading, error, built-in, custom, and suggested-template states.
- Reload with a completed persisted outline skips outline streaming and prepares once.
- Reload without an outline starts streaming.
- Preparation begins only after a valid final outline and selected template exist.
- Repeated effects or completion events cannot prepare twice.
- Cancel and return-to-picker preserve the presentation ID and remove the template query.

### Cleanup contracts

Update or remove tests that intentionally read deleted outline UI files. Preserve unrelated contracts by relocating assertions to the template picker, background stream hook, or presentation page where appropriate.

Run the complete web verification suite:

```bash
npm test
npm run check:i18n-copy
npm run lint
npm run typecheck
npm run deadcode
```

## Acceptance Criteria

- Creating from prompt or documents reaches the template picker at `/presentation`, never `/outline`.
- Selecting a template starts background outline generation without exposing outline content.
- Only the final `complete` outline is stored and used for preparation.
- The user can recover from loading, streaming, stall, completion-payload, and preparation failures without visiting another route.
- Cancelling returns to the presentation template picker and cannot generate slides from a partial outline.
- `/outline` and all manual outline editor UI are absent from the build.
- Direct `/outline` navigation returns 404.
- Existing slide streaming and editor behavior remain unchanged after preparation.
- The full web verification suite passes with no new dead files or dependencies.
