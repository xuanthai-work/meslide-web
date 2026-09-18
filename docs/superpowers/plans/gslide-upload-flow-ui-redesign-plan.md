# GSlide Upload Flow UI Redesign Plan

- Date: 2026-09-16
- Status: Implemented
- Scope: Frontend UI and interaction tests only
- Target: `gslide-web` upload page

## Implementation record

Implemented on `feat/prompt-rewrite` on 2026-09-16.

- The composer now renders source prompt, attachments, Rewrite, optimized
  prompt, then the explicit Create action in matching visual and DOM order.
- Attachment helper copy follows the active document-aware rollout mode.
- The optimized prompt uses a compact empty state and expands for active or
  completed rewrites.
- The native file input is visually hidden with `sr-only`, remains keyboard
  focusable, and uses the existing `focus-within` ring on its visible label.
- Cypress asserts the real DOM order rather than query execution order and
  covers keyboard focus on the attachment picker.
- Vietnamese and English catalogs remain symmetric.

Verification completed with `npm run check` (186 Node tests), the prompt
rewrite Cypress component suite (23 tests), and `npm run build`.

## Goal

Redesign the upload composer so users can immediately understand the flow:

1. Enter an initial idea.
2. Optionally attach reference documents.
3. Ask AI to rewrite the prompt.
4. Review the optimized prompt.
5. Create the presentation.

The redesign must make prompt and documents feel like related inputs. It must
also make the final Create action explicit instead of representing it with an
icon-only button.

## Scope boundary

This plan changes UI composition and explanatory copy only. It does not change:

- FastAPI endpoints or request and response models.
- Prompt rewrite behavior.
- Document upload or decomposition behavior.
- Document profile generation or caching.
- Presentation creation or outline generation.
- Rewrite freshness and stale-result rules.
- The `GSLIDE_FEATURE_DOCUMENT_AWARE_REWRITE` rollout flag or its default.

The UI must describe the active behavior truthfully:

- When `documentAwareRewrite` is enabled, selected documents participate in
  prompt rewrite.
- When it is disabled, selected documents are used during presentation
  creation but not during prompt rewrite.

## Design direction

This is a targeted evolution of the existing GSlide design, not a new visual
system.

- Preserve the current GSlide typography, blue accent, soft surfaces, radius
  scale, hero, configuration controls, and page width.
- Prioritize flow clarity over decoration.
- Keep motion limited to existing loading and state transitions.
- Preserve all keyboard, focus, screen-reader, and error behavior.

Design dials:

- Design variance: 4/10
- Motion intensity: 2/10
- Visual density: 5/10

## Target layout

```text
Ý tưởng của bạn
[ Editable source prompt ]

Tài liệu tham chiếu                     Không bắt buộc
[ Attach documents ]
[ report.pdf x ] [ data.xlsx x ]
AI sẽ dùng 2 tài liệu để tối ưu prompt

                 [ Viết lại bằng AI ]

Prompt được AI tối ưu
Đã tối ưu từ ý tưởng và 2 tài liệu
[ Read-only rewritten prompt ]

                              [ Tạo bài thuyết trình -> ]
```

On small screens, the Create button becomes full width. On larger screens, it
is right-aligned and retains a visible text label.

## Task 1: Recompose the upload flow

Update:

- `app/(presentation-generator)/upload/components/UploadPage.tsx`

Render the composer in this order:

1. `PromptInput`
2. `SupportingDoc`
3. Rewrite action
4. `RewrittenPrompt`
5. Create action

Keep the current hero, configuration controls, community reference picker,
loading overlay, orchestration functions, validation, and request payloads.

The DOM order must match the visual order so keyboard navigation follows the
same mental model.

## Task 2: Make SupportingDoc attachment-only

Update:

- `app/(presentation-generator)/upload/components/SupportingDoc.tsx`

Changes:

- Remove `onSubmit` and `submitDisabled` from `SupportingDocProps`.
- Remove the icon-only Create button from this component.
- Add a visible section label for reference documents.
- Add a visible optional indicator.
- Preserve drag and drop, file selection, validation, file limit, file chips,
  remove controls, and notifications.
- Preserve the existing file input `data-testid` so orchestration tests remain
  stable.
- Accept a presentation-only helper string from the parent, or accept a small
  typed usage mode and resolve localized copy inside the component.

Copy behavior:

- Flag enabled with files: explain that AI will read the documents to optimize
  the prompt.
- Flag disabled with files: explain that the documents will be used when
  creating presentation content.
- No files: show concise supported-file guidance without suggesting that any
  document has already been processed.

## Task 3: Reduce the rewritten-prompt empty state

Update:

- `app/(presentation-generator)/upload/components/RewrittenPrompt.tsx`

Changes:

- Render a compact empty state before the first rewrite.
- Expand the output area when a result, loading state, stale result, or error
  needs more space.
- Keep the output read-only, selectable, and copyable.
- Preserve loading phases, retry action, stale badge, stale helper, and polite
  live-region announcements.
- When a fresh result was grounded in documents, show a concise helper such as
  `Đã tối ưu từ ý tưởng và 2 tài liệu`.
- Do not show a grounding claim for prompt-only rewrites or while the result is
  stale.

Add only the minimum new props required to present document grounding. Do not
move rewrite state ownership out of `UploadPage`.

## Task 4: Add an explicit Create action

Update:

- `app/(presentation-generator)/upload/components/UploadPage.tsx`

Changes:

- Render a `GSlideButton` after `RewrittenPrompt`.
- Use the visible label `Tạo bài thuyết trình`.
- An icon may support the label but must not replace it.
- Bind the button to the existing `handleGeneratePresentation` function.
- Bind disabled state to the existing `isCreateDisabled` value.
- Keep the current `generate-presentation-button` test ID.
- Use full width on mobile and right alignment on wider screens.
- Preserve the current keyboard submission behavior.

## Task 5: Add localized copy

Update:

- `i18n/locales/vi.ts`
- `i18n/locales/en.ts`

Add symmetric keys for:

- Reference documents label.
- Optional indicator.
- Empty attachment guidance.
- Document-aware rewrite helper.
- Presentation-only document helper.
- Grounded rewrite summary with document count.
- Visible Create action.

Use interpolation for document counts. Do not concatenate localized sentence
fragments inside React components.

## Task 6: Preserve state and feature-flag truthfulness

Do not modify the existing rewrite or generation state machine.

Required behavior:

- Prompt-only rewrite performs no document requests.
- With the flag enabled, Rewrite prepares selected documents and sends their
  decomposed paths.
- With the flag disabled, Rewrite stays prompt-only and Create prepares the
  selected documents later.
- A fresh document-aware rewrite enables Create only while its document set
  still matches the current selection.
- Changing prompt, language, slide count, or selected documents keeps the
  current stale-result behavior.
- Document-only creation continues to work without requiring rewrite.

The redesign must not change the default value of
`GSLIDE_FEATURE_DOCUMENT_AWARE_REWRITE`.

## Task 7: Accessibility and responsive behavior

- Keep a persistent visible label for the prompt input.
- Keep a visible label for the file input group.
- Preserve file-removal accessible names.
- Preserve `aria-busy` on the rewrite action.
- Preserve the polite rewrite status live region.
- Maintain visible keyboard focus for attachment, remove, rewrite, retry, and
  Create controls.
- Ensure disabled controls remain visually distinguishable.
- Prevent desktop CTA labels from wrapping.
- Allow file chips to wrap while truncating long file names.
- Keep touch targets at least as large as the current controls.

## Task 8: Automated tests

Update:

- `cypress/component/prompt-rewrite.cy.tsx`
- `tests/prompt-rewrite.test.mjs`
- Existing i18n parity tests where required

Add or update coverage for:

1. Attachment UI appears before the Rewrite action in DOM order.
2. Rewritten output appears after the Rewrite action.
3. Create uses a visible text label and remains after the output.
4. Flag-enabled document selection shows document-aware helper copy.
5. Flag-disabled document selection shows presentation-only helper copy.
6. Compact empty output expands after successful rewrite.
7. Prompt-only generation behavior remains unchanged.
8. Document-only creation remains available.
9. Prompt plus document remains blocked until the required rewrite is fresh.
10. Changing a rewrite input preserves stale-state behavior.
11. Create continues to send decomposed file paths.
12. Existing error, retry, cancellation, and late-response tests remain green.

Prefer stable roles, labels, and existing test IDs. Do not assert incidental
Tailwind class ordering unless it is the only practical way to protect the
compact empty-state contract.

## Verification

Run:

```powershell
npm test
npm run check:i18n-copy
npm run lint
npm run typecheck
npm run deadcode
.\node_modules\.bin\cypress.cmd run --component --spec cypress/component/prompt-rewrite.cy.tsx
npm run build
```

Manual checks:

- Desktop layout at common laptop and wide-screen widths.
- Mobile layout at 320px, 375px, and 430px.
- Prompt-only flow.
- Document-only flow.
- Prompt plus document with the flag enabled.
- Prompt plus document with the flag disabled.
- Long Vietnamese and English file names.
- Eight selected files.
- Loading, error, retry, stale, and successful states.
- Keyboard-only navigation and Ctrl or Cmd plus Enter submission.

## Acceptance criteria

- Users can identify prompt and documents as inputs before taking any action.
- Users can tell whether documents participate in rewrite or only generation.
- Attachment controls no longer appear to belong to the AI output.
- The empty rewrite panel no longer dominates the composer.
- Create is represented by a visible, unambiguous text action.
- All current rewrite, document preparation, generation, freshness, and feature
  flag behavior remains unchanged.
- Vietnamese and English catalogs remain symmetric.
- Automated verification and production build pass.

## Non-goals

- Enabling or removing the document-aware rollout flag.
- Backend prompt or profile changes.
- New upload formats.
- Making the rewritten prompt editable.
- Changing the page hero or configuration controls.
- Redesigning Smart mode or the community reference picker.
