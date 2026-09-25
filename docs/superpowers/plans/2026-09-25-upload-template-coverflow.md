# Upload Template Cover Flow Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users choose a presentation template on the upload screen through an accessible 3D Cover Flow, then start generation without the separate template selection checkpoint.

**Architecture:** A focused upload component loads all template-summary pages, selects the first available built-in template by default, and exposes a compact selected-template control plus a dialog. The dialog renders a three-card perspective carousel and a direct-access template rail. Upload passes the selected ID through the existing `template` URL parameter. If the list fails or is empty, Create stays blocked with a retry control on upload. The presentation picker remains for older links without a template ID.

**Tech Stack:** Next.js 16, React 19, Tailwind, Radix Dialog, Cypress component tests, Node tests.

**Spec:** Approved in-chat design in this conversation (2026-09-25): compact picker on upload; 3D Cover Flow with prominent center and angled neighbors, touch/keyboard support, reduced-motion fallback.

## Global Constraints

- Keep the existing presentation creation and automatic generation API sequence.
- Reuse the existing template summary hook and thumbnails.
- Keep Vietnamese and English copy in sync.
- Preserve keyboard access, focus visibility, touch navigation, and reduced-motion behavior.

## Review Focus

- Templates are still loading: Create must not silently launch without a chosen template.
- Template list fails or is empty: Create stays blocked and a retry control remains on upload.
- Selected template changes: the submitted URL must contain the selected ID, for document and direct creation.
- Large custom-template lists: fetch every API page, and let users reach any item without stepping through the entire carousel.
- Old `/presentation?auto=1` links must still show the existing picker.

---

### Task 1: Selection and generation routing

**Files:** `app/(presentation-generator)/upload/components/UploadPage.tsx`, `app/(presentation-generator)/upload/components/UploadTemplatePicker.tsx`, `app/(presentation-generator)/hooks/useTemplateSummaries.ts`, `app/(presentation-generator)/services/api/template-list.ts`, `app/(presentation-generator)/services/api/template.ts`, `cypress/component/upload-template-picker.cy.tsx`, `cypress/component/prompt-rewrite.cy.tsx`, `tests/template-list.test.mjs`.

**Interfaces:** `UploadTemplatePicker` receives `selectedTemplateId: string | null`, `onSelectionChange(id: string | null): void`, and `onLoadingChange(loading: boolean): void`. Upload's `getGenerationDestination` reads the selected ID; the existing `/presentation` route consumes `template`.

- [x] Add Cypress cases for initial default, changing a template, keyboard selection, empty/error recovery, and the URL after Create. The initial four cases failed on the missing upload trigger.
- [x] Implement summary loading, default selection, upload control, and URL handoff. Run those cases to green.
- [x] Update the document-create component expectation for the selected-template URL. Re-run affected tests.
- [x] Add pagination and retry support to template-summary loading. Cover page 2 and recovery in Node and Cypress tests.

### Task 2: Cover Flow presentation and accessibility

**Files:** `app/(presentation-generator)/upload/components/UploadTemplatePicker.tsx`, `i18n/locales/en.ts`, `i18n/locales/vi.ts`, `cypress/component/upload-template-picker.cy.tsx`.

**Interfaces:** The dialog uses `onSelectionChange` from Task 1. It previews one center card and immediate neighbors, while a scrollable rail exposes all templates.

- [x] Add Cypress assertions for navigation, selecting a side card, selecting a distant rail item, dialog close, and active state. Run them against the implementation.
- [x] Add responsive 3D transforms, shadows, dialog controls, swipe support, visible focus, and `motion-reduce` behavior. Add matching EN/VI labels. Run tests green.
- [x] Check interaction at narrow and wide viewport sizes with Cypress component tests.
- [x] Announce active template changes and keep focus in the carousel during arrow-key navigation.

### Task 3: Verification and cleanup

**Files:** Only files changed by Tasks 1–2.

- [x] Run `npm run typecheck`, `npm run check:i18n-copy`, and targeted Cypress component suites. Fix concrete failures.
- [x] Run the Node suite, lint, deadcode, production build, and review `git diff --check` plus the final diff for accidental changes.
- [x] Report behavior, tests, and any remaining limits.

## Verification record

- `npm run check`: 286 Node tests passed; i18n copy, lint, typecheck, and deadcode exited successfully. Lint reported 15 preexisting warnings in unrelated files.
- Affected Cypress component suites: 42 tests passed across upload template selection, prompt rewrite, web search, and the legacy presentation picker.
- `npm run build`: production build completed successfully.
- `git diff --check`: no whitespace errors.
