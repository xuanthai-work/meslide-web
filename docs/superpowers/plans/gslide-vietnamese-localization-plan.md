# GSlide Vietnamese Localization Implementation Plan

- Related specification:
  `docs/superpowers/specs/gslide-vietnamese-localization-spec.md`
- Date: 2026-09-04
- Last consolidated: 2026-09-17
- Implementation status: Phases 0–7 implemented. Manual Standard/Smart
  prompt-to-export smoke testing remains. Requirements and durable contracts
  are consolidated in the related specification; execution evidence is in
  Section 12 of this plan.

## 1. Delivery strategy

Implement localization in vertical slices. Each slice must leave its user flow
usable and tested. Do not perform a repository-wide blind string replacement:
some English strings are identifiers, API values, keyboard keys, logs, or state
conditions rather than display copy.

Recommended delivery order:

1. Localization foundation.
2. Prompt-to-export golden path.
3. Editor and advanced tools.
4. Stable backend status/error codes.
5. Quality gate and cleanup.

## 2. Phase 0 — Inventory and terminology lock

### Tasks

- [x] Generate an inventory of user-facing literals under `gslide-web/app` and
  `gslide-web/components`.
- [x] Classify each literal as UI copy, accessibility copy, internal log,
  technical identifier, sample slide content, or test fixture.
- [ ] Confirm the terminology table in the specification with product/design.
- [x] Record intentional English exceptions such as model names and keyboard
  keys.
- [ ] Inventory backend SSE statuses and API errors that reach the browser.
- [x] Find every comparison or branch based on display prose, beginning with
  `OutlinePage.tsx` and chat/generation status sets.

### Exit criteria

- [x] Every main feature has an assigned translation namespace.
- [x] No known display string used as a machine-state identifier is left
  undocumented.

## 3. Phase 1 — Localization foundation

### Files to add

```text
gslide-web/i18n/config.ts
gslide-web/i18n/types.ts
gslide-web/i18n/provider.tsx
gslide-web/i18n/translate.ts
gslide-web/i18n/locales/vi.ts
gslide-web/i18n/locales/en.ts
gslide-web/i18n/__tests__/catalogs.test.ts
```

> Deviation: the catalog test lives at `tests/i18n-catalogs.test.mjs`
> (not `i18n/__tests__/catalogs.test.ts`) so it is picked up by the project's
> `node --test tests/*.test.mjs` runner. Node 22 loads the `.ts` catalogs
> directly via type stripping. `tsconfig.json` gained
> `allowImportingTsExtensions` so `translate.ts`'s value imports resolve under
> Node while staying type-checkable.

### Tasks

- [x] Define supported locales and set `vi-VN` as the default.
- [x] Implement typed nested message catalogs.
- [x] Implement named interpolation and count handling.
- [x] Provide a client hook for React components.
- [x] Provide a direct translator for server components, metadata, hooks, and
  non-React utilities.
- [x] Add development warnings for missing keys.
- [x] Add catalog key-parity and interpolation tests.
- [x] Mount the provider in the existing root/client-provider boundary without
  forcing the whole app into client rendering.
- [x] Change root language and metadata to Vietnamese.
- [x] Add a documented convention for translation key naming.

### Key files to modify

- `gslide-web/app/layout.tsx`
- `gslide-web/app/ClientRoot.tsx`
- `gslide-web/app/providers.tsx`
- `gslide-web/app/loading.tsx`
- `gslide-web/app/global-error.tsx`
- `gslide-web/app/not-found.tsx`
- `gslide-web/app/ConfigurationInitializer.tsx`

### Verification

- [x] Server-rendered HTML starts in Vietnamese without flashing English.
- [x] A deliberately missing key falls back predictably in development.
- [x] Production build and TypeScript checks pass.

## 4. Phase 2 — Golden-path web localization

Implement feature namespaces in this order so the application stays reviewable.

### 2.1 Dashboard

- [x] Navigation and page headers.
- [x] Presentation cards and legacy presentation table.
- [x] Empty states, create/duplicate/delete actions, and confirmation dialogs.
- [x] Loading, success, and error notifications.

Primary area:
`gslide-web/app/(presentation-generator)/(dashboard)/dashboard`

### 2.2 Prompt, upload, and configuration

- [x] Prompt-input modes and supporting-document controls.
- [x] File validation and upload errors.
- [x] Slide count, language, tone, verbosity, search, TOC, and generation-mode
  controls.
- [x] Community-reference picker and filters used from the creation screen.
- [x] Generation-mode explanation dialog.

Primary area:
`gslide-web/app/(presentation-generator)/upload`

### 2.3 Document preview and outline review

- [x] Document loading/preview messages.
- [x] Outline loading, ready, stalled, regenerate, reorder, add, and delete UI.
- [x] Template selection.
- [x] Replace display-string state comparisons with stable internal constants.
- [x] Keep user-authored outline content untouched.

Primary areas:

- `gslide-web/app/(presentation-generator)/documents-preview`
- `gslide-web/app/(presentation-generator)/outline`

### 2.4 Generation and presentation editor shell

- [x] Streaming status bar and stall/retry messages.
- [x] Presentation header, side panels, slide actions, new-slide flow, and
  presentation mode.
- [x] Chat input chrome, attachments, context controls, activity labels, and
  errors. Do not translate chat messages authored by the user or LLM.
- [x] Image generation/upload UI.
- [x] Keyboard-shortcut dialog.

Primary area:
`gslide-web/app/(presentation-generator)/presentation`

### 2.5 Export

- [x] Export actions and progress.
- [x] PDF/PPTX failure messages and missing-presentation states.
- [x] Browser-facing metadata and accessibility labels in export views.

Primary area:
`gslide-web/app/(export)`

### Phase exit criteria

- [ ] Prompt-to-export works in Vietnamese in Standard mode.
- [ ] Prompt-to-export works in Vietnamese in Smart mode.
- [ ] The selected slide-content language is unchanged by UI translation.

## 5. Phase 3 — Secondary pages and advanced editor tools

### 3.1 Dashboard secondary pages

- [x] Settings and text/image/search provider configuration.
- [x] Themes, fonts, theme creation, and deletion.
- [x] Community browsing, filtering, and preview.
- [x] Template list, template management, and deletion.

Primary area:
`gslide-web/app/(presentation-generator)/(dashboard)`

### 3.2 Template Studio

- [x] Upload and generation steps.
- [x] Font resolution and warnings.
- [x] Layout preview/editor panels.
- [x] Save/create/delete dialogs and notifications.
- [x] Blank-layout and element insertion controls.

Primary areas:

- `gslide-web/app/(presentation-generator)/custom-template`
- `gslide-web/app/(presentation-generator)/template-preview`

### 3.3 Slide editor

- [x] Text and typography toolbars.
- [x] Image and icon pickers/toolbars.
- [x] Table editing commands.
- [x] Chart settings and data-editor commands.
- [x] Selection, component actions, grouping, layering, and layout controls.
- [x] Inserted-element placeholder content intended to be visible to users.
- [x] Accessibility labels for icon-only actions.

Primary area:
`gslide-web/components/slide-editor`

### Phase exit criteria

- [x] No unintended English remains in the audited Phase 3 product screens.
- [x] Sample/template content is translated only when it is product-owned
  placeholder content, not user or imported content.

## 6. Phase 4 — Presentation-language model cleanup

### Tasks

- [x] Replace display-string enum coupling with stable language values and
  localized labels.
- [x] Add backward-compatible parsing for existing saved values such as
  `"Vietnamese (Tiếng Việt)"` and `"Auto (English)"`.
- [x] Default new sessions to Vietnamese content generation.
- [x] Preserve a user's stored selection when reopening or editing a
  presentation.
- [x] Verify uploaded-document validation still handles Auto mode correctly.
- [x] Test the exact language value sent by both outline and direct-generation
  APIs.

Primary files:

- `gslide-web/app/(presentation-generator)/upload/type.ts`
- `gslide-web/app/(presentation-generator)/upload/components/ConfigurationSelects.tsx`
- `gslide-web/app/(presentation-generator)/upload/components/UploadPage.tsx`
- `gslide-web/app/(presentation-generator)/outline/components/OutlinePage.tsx`
- `gslide-web/app/(presentation-generator)/services/api/presentation-generation.ts`

## 7. Phase 5 — Backend progress and error codes

### Contract design

- Add `status_code` and `status_params` to SSE status responses.
- Add `error_code` and `error_params` to user-facing API/SSE errors where the
  frontend needs localized handling.
- Retain existing English `status` and `detail` fields during migration.
- Centralize frontend mapping from backend code to translation key.

### Migration order

1. Define shared frontend code mappings and fallback behavior.
2. Add codes to outline-generation events.
3. Add codes to Standard and Smart presentation-generation events.
4. Add codes to chat/edit activity events.
5. Add codes to image, template, theme, and export errors.
6. Replace all frontend state comparisons against English messages.

### Primary backend areas

- `gslide-api/servers/fastapi/api/v1/ppt/endpoints/outlines.py`
- `gslide-api/servers/fastapi/api/v1/ppt/endpoints/presentation.py`
- `gslide-api/servers/fastapi/api/v1/ppt/endpoints/chat.py`
- `gslide-api/servers/fastapi/api/v1/ppt/endpoints/images.py`
- `gslide-api/servers/fastapi/services/export_task_service.py`
- SSE response models under `gslide-api/servers/fastapi/models`

### Verification

- [x] New web client works against a backend that only sends legacy messages.
- [x] New web client uses codes when both code and English fallback are present.
- [x] Existing API clients continue to receive the original fields.
- [x] Logs retain diagnostic details even when UI copy is sanitized/localized.

## 8. Phase 6 — Typography and responsive QA

### Tasks

- [x] Verify Vietnamese glyph coverage for Inter, Syne, Manrope, and Unbounded.
- [x] Add the appropriate font subset or fallback where glyphs are missing.
- [x] Test long labels at desktop, tablet, and narrow mobile widths.
- [x] Check dialogs, tabs, segmented controls, sidebar items, toolbars, toasts,
  and empty states for clipping.
- [x] Verify Unicode normalization does not affect search/filter behavior.
- [x] Verify Vietnamese filenames and presentation titles through save/export.

### Visual review pages

- Dashboard with empty and populated states.
- Upload advanced settings.
- Outline list with long content.
- Presentation editor with every side panel and toolbar.
- Provider settings.
- Theme and template editors.
- Community filters/dialogs.

## 9. Phase 7 — Tests and CI guardrails

### Automated tests

- [x] Catalog `vi`/`en` key parity.
- [x] Missing-key and fallback behavior.
- [x] Parameter interpolation and slide-count messages.
- [x] Locale-aware date and number formatting.
- [x] Stable state transitions independent of display text.
- [x] Presentation-language serialization and legacy-value compatibility.
- [x] SSE status/error code mapping and legacy fallback.
- [x] Golden-path component/E2E tests in Vietnamese.

### Test maintenance

- [x] Replace selectors based on English visible text with roles, stable test
  IDs, or localized expected messages as appropriate.
- [x] Update snapshots intentionally; reject changes to user data or generated
  slide content caused only by locale work.
- [x] Add a CI scan for new likely user-facing hard-coded strings, with a small
  reviewed allowlist for logs, identifiers, and fixtures.

### Required checks

- [x] TypeScript/typecheck.
- [x] ESLint.
- [x] Unit/component tests.
- [x] Relevant Cypress/E2E tests.
- [x] Production Next.js build.
- [x] FastAPI unit tests for changed response contracts.

## 10. Suggested pull-request breakdown

1. `feat(i18n): add Vietnamese locale foundation`
2. `feat(i18n): localize dashboard and creation flow`
3. `feat(i18n): localize outline and generation flow`
4. `feat(i18n): localize presentation editor and export`
5. `feat(i18n): localize settings themes community and templates`
6. `feat(i18n): localize slide editor and template studio`
7. `feat(api): add stable progress and error codes`
8. `test(i18n): add Vietnamese golden-path coverage and CI guardrails`

Each PR should keep the application buildable and should update both `vi` and
`en` catalogs for every new key.

## 11. Definition of done

- [ ] All acceptance criteria in the related specification are satisfied.
- [ ] Golden paths have been manually verified in Standard and Smart modes.
- [x] All automated checks pass.
- [x] No UI behavior depends on translated prose.
- [x] The legacy backend-message compatibility window is documented.
- [x] A final hard-coded-copy audit has no unexplained user-facing English
  strings.

## 12. Consolidated implementation record

This section replaces the former per-phase briefs, ledgers, inventories, and
reports. It keeps the decisions and verification evidence needed to maintain
the feature without treating temporary implementation handoffs as permanent
top-level documents.

### 12.1 Phase 0–3: inventory, foundation and UI coverage

- The initial audit assigned namespaces to every major feature and identified
  prose-based machine state in outline readiness, chat status/trace handling,
  template task status, and provider error classification.
- The locale provider, direct translator, typed catalogs, interpolation,
  fallback behavior, Vietnamese document metadata, and catalog parity test
  were implemented before feature migration.
- The golden path, dashboard secondary pages, settings, themes, community,
  template management, Template Studio, and slide editor were migrated to
  semantic catalog keys. Product/user data and technical identifiers remained
  untouched.
- Phase 3 verification: TypeScript passed; catalog parity passed; ESLint had no
  errors; all 99 then-current web tests passed; production build succeeded.

### 12.2 Phase 4: presentation-language model

Key decisions and results:

- `LanguageType` became an erasable const object plus type alias in
  `upload/language.ts`, re-exported from `upload/type.ts`. This preserves the
  public import/member API while allowing Node 22's strip-only test runner to
  import the module.
- Internal values are stable codes; `LEGACY_LANGUAGE_VALUE` and
  `toLegacyLanguageValue` preserve the existing backend wire format.
- `parseLanguageValue` accepts both new codes and all historical values.
- Display labels moved to the catalogs under `upload.language.*`; typed records
  enforce complete coverage.
- Both outline and direct-generation API paths serialize exact legacy values.
  New sessions default to Vietnamese, Auto remains available, and stored
  selections continue to override defaults.
- The backend OCR dictionary was cross-checked: 89/89 keys matched byte-for-byte;
  Auto is the expected frontend-only 90th value.
- Verification: TypeScript passed; 106/106 tests passed, including seven new
  language-contract tests; scoped ESLint had no errors; production build
  succeeded.

### 12.3 Phase 5: stable progress and error codes

Implementation order was backend SSE/chat codes, backend HTTP codes, then
frontend mapping. The related specification now contains the authoritative
wire contract and registries.

- Backend SSE status/error models gained optional code and param fields while
  preserving byte-identical legacy frames when those fields are absent.
- `CodedHTTPException` and its FastAPI handler preserve HTTP status, headers,
  and legacy detail while adding stable error metadata.
- Outline, Smart generation, chat status/trace, provider, image, file,
  template, theme, slide and export paths emit stable codes.
- Backend HTTP rollout covered 53 presentation/generation sites, 9 image
  sites, 4 file/validator sites, 30 template sites, 4 theme sites, 5 slide
  sites, and 25 export-service sites.
- `i18n/backend-messages.ts` added 49 status/trace mappings and 78 error
  mappings. Code-based localization takes precedence; legacy prose heuristics
  remain the compatibility fallback.
- Verification: web TypeScript passed; 110/110 web tests passed; ESLint had no
  errors; production build succeeded. Focused backend checks passed 12/12 and
  the full backend run reached 840 passed, 2 skipped, with 9 pre-existing
  Windows/POSIX/export-runtime failures identical to baseline.

### 12.4 Phase 6: typography, responsive behavior and Unicode

- Inter's bundled font was verified against the Vietnamese precomposed glyph
  repertoire. Manrope and Unbounded load their Vietnamese subsets; Syne uses
  `latin-ext` and falls through to Vietnamese-capable fonts where needed.
- Long-copy and narrow-layout fixes covered the editor header/title, dialogs,
  language picker, Template Studio actions and toast wrapping.
- Search inputs normalize both query and data to NFC before locale-aware case
  folding. Export filenames retain Unicode, strip unsafe filesystem
  punctuation, and keep an ASCII fallback plus RFC 5987 UTF-8 name.
- Verification: TypeScript passed; 115/115 tests passed; ESLint had no errors;
  production build succeeded.

### 12.5 Phase 7: tests and CI guardrails

- Added locale-aware number/date/file-size tests and formatting utilities.
- Added Cypress component coverage for Vietnamese generation-mode and settings
  flows at narrow/tablet viewports using roles and stable values.
- Added `scripts/check-i18n-hardcoded-copy.mjs`, `npm run check:i18n-copy`, and
  CI TypeScript/copy checks. The reviewed literal allowlist contains only two
  technical URL placeholders and the `Aa` font specimen.
- Final recorded verification: TypeScript passed; 119/119 Node tests passed;
  4/4 Cypress component tests passed across three specs; ESLint had no errors;
  production build generated all 24 static pages; 58/58 FastAPI contract tests
  passed; hard-coded-copy scan passed.

### 12.6 Remaining release action

Run one live Standard generation and one live Smart generation from prompt
through export with configured providers. Record failures against the relevant
acceptance criterion before marking the two remaining definition-of-done items
complete.
