# GSlide Prompt Rewrite Implementation Plan

- Date: 2026-09-11
- Status: Implemented; automated verification complete
- Scope: `gslide-web` and `gslide-api`
- Primary surface: `/upload`

Automated verification completed on 2026-09-11:

- Frontend `npm run check`: 177 tests passed; i18n, lint, typecheck, and
  dead-code checks passed (19 pre-existing lint warnings, matching the
  repository ceiling).
- Frontend production build: passed.
- Cypress prompt-rewrite component suite: 5 tests passed.
- Backend prompt-rewrite suite: 69 tests passed.
- Backend dispatcher/small-surface regression suite: 63 tests passed.
- Ruff checks for the new backend surface: passed.

The real-provider manual smoke matrix remains an environment/deployment check;
it requires a configured LLM provider and is intentionally not recorded as
complete by this implementation run.

## 1. Goal

Add an explicit AI rewrite step to the presentation creation flow. The user
keeps editing their original prompt in the first input. GSlide writes the AI
rewrite into a separate read-only field below it. Presentation generation uses
only the latest rewrite that was produced from the current source prompt.

The target flow is:

```text
editable source prompt
  -> explicit "Rewrite with AI" action
  -> read-only rewritten prompt
  -> user edits source again if needed
  -> explicit rewrite refresh
  -> create presentation from the fresh rewritten prompt
```

## 2. Locked product decisions

- The page has two separate prompt fields.
- The upper field is the user's editable source prompt.
- The lower field is the AI-generated rewrite and is read-only.
- Rewriting happens only after an explicit button click. It is not debounced
  and does not run automatically while the user types.
- Rewriting never replaces or clears the source prompt.
- Editing the source after a successful rewrite makes the lower result stale.
- A stale result remains visible but is labeled as needing an update.
- A presentation cannot be created from a stale rewrite.
- The create action uses the rewritten prompt, not the source prompt.
- Document-only and community-reference-only creation remain supported when
  the source prompt is empty.
- No prompt or rewrite history is persisted to the database in the first
  release.

## 3. Non-goals

- Do not rewrite uploaded document contents.
- Do not inspect or summarize attachments during the rewrite request.
- Do not turn the rewrite endpoint into outline generation.
- Do not stream partial rewritten text in the first release.
- Do not add prompt history, version browsing, or a chat conversation.
- Do not add automatic web search or image generation to rewriting.
- Do not change presentation routes, generation modes, or template selection.

## 4. Current-state findings

The current source prompt is stored in `PresentationConfig.prompt` inside:

```text
app/(presentation-generator)/upload/components/UploadPage.tsx
```

`PromptInput.tsx` renders one textarea and delegates creation to
`handleGeneratePresentation`. Both direct generation and document-backed
generation send `config.prompt` as `content` through
`PresentationGenerationApi.createPresentation()`.

There is no prompt rewrite API in `gslide-api`. The backend already provides
the shared provider-independent LLM path needed for the feature:

- `get_llm_client()`
- `get_model()`
- `get_generate_kwargs()`
- `stream_generate_events()`
- `handle_llm_client_exceptions()`

The rewrite feature should reuse these helpers so OpenAI, Google, and custom
OpenAI-compatible providers behave like the rest of presentation generation.

## 5. UX specification

### 5.1 Composition

Inside the existing `GSlideDropCard`, render this order:

```text
Source prompt field
Rewrite action
Rewritten prompt field
Attachment controls and Create action
```

Recommended visible labels:

| Purpose | Vietnamese | English |
| --- | --- | --- |
| Source label | Ý tưởng của bạn | Your idea |
| First rewrite | Viết lại bằng AI | Rewrite with AI |
| Rewrite loading | Đang viết lại... | Rewriting... |
| Rewrite output | Prompt được AI tối ưu | AI-optimized prompt |
| Stale output | Cần cập nhật | Needs update |
| Refresh rewrite | Cập nhật bản viết lại | Update rewrite |
| Retry | Thử lại | Try again |
| Empty output | Bản viết lại sẽ xuất hiện ở đây | Your rewritten prompt will appear here |
| Create | Existing localized create action | Existing localized create action |

### 5.2 State machine

| State | Source field | Rewrite field | Rewrite action | Create action |
| --- | --- | --- | --- | --- |
| `empty` | Empty/editable | Empty placeholder | Disabled | Existing attachment/reference rules |
| `ready` | Non-empty/editable | Empty placeholder | Enabled | Disabled |
| `rewriting` | Editable | Skeleton/loading | Disabled | Disabled |
| `fresh` | Editable | Latest result | Rewrite again | Enabled |
| `stale` | Edited after rewrite | Previous result plus stale label | Update rewrite | Disabled |
| `error-empty` | Editable | Inline retry state | Try again | Disabled |
| `error-with-result` | Editable | Previous result retained | Try again | Enabled only if the retained result is fresh |

### 5.3 Accessibility

- Keep an explicit label associated with each textarea.
- Mark the lower textarea `readOnly`, not `disabled`, so it remains selectable
  and copyable.
- Use `aria-live="polite"` for rewrite loading, success, stale, and error
  status text.
- Expose the rewrite button's loading state with `aria-busy`.
- Preserve keyboard entry and the existing `Ctrl/Cmd + Enter` create shortcut.
- The keyboard shortcut must run the same freshness validation as clicking
  Create.
- Maintain visible focus rings and existing GSlide contrast tokens.

## 6. API contract

Add:

```http
POST /api/v1/ppt/prompt/rewrite
Content-Type: application/json
```

Request:

```json
{
  "prompt": "AI trong giáo dục",
  "language": "Vietnamese (Tiếng Việt)",
  "n_slides": 10
}
```

Response:

```json
{
  "rewritten_prompt": "Tạo một bài thuyết trình về cách AI đang được ứng dụng trong giáo dục..."
}
```

Validation:

- `prompt`: trim before use, 3 to 8,000 characters.
- `language`: optional string using the existing API wire value.
- `n_slides`: optional integer from 1 through the existing presentation slide
  limit.
- `rewritten_prompt`: non-empty and no more than 3,000 characters.

The frontend should send `toLegacyLanguageValue(config.language)` and
`parseLimitedSlideCount(config.slides)` so the new endpoint follows the same
boundary rules as presentation generation.

## 7. Backend implementation

### Task 1: Lock request and response models

**Files:**

- Create: `gslide-api/servers/fastapi/models/prompt_rewrite.py`
- Create: `gslide-api/servers/fastapi/tests/unit/test_prompt_rewrite.py`

**Steps:**

- [x] Add `PromptRewriteRequest` with `prompt`, `language`, and `n_slides`.
- [x] Add `PromptRewriteResponse` with `rewritten_prompt`.
- [x] Reuse `MAX_NUMBER_OF_SLIDES` for the upper slide-count bound.
- [x] Normalize outer whitespace without changing intentional internal line
  breaks.
- [x] Add validation tests for empty, short, oversized, and invalid slide-count
  payloads.

### Task 2: Implement the provider-independent rewrite call

**Files:**

- Create: `gslide-api/servers/fastapi/utils/llm_calls/rewrite_presentation_prompt.py`
- Modify: `gslide-api/servers/fastapi/tests/unit/test_prompt_rewrite.py`

**System prompt requirements:**

- Rewrite the request as a clear presentation-generation brief.
- Preserve the user's intent, named entities, dates, numbers, factual claims,
  and explicit constraints.
- Do not answer the topic and do not generate the presentation outline.
- Do not invent facts, sources, metrics, audience details, or business context.
- Clarify the objective, audience, important coverage, and desired outcome only
  when supported by the source prompt.
- If the source is already specific, improve wording lightly instead of
  expanding it mechanically.
- Use the selected language. When the language value is Auto, preserve the
  source prompt's language.
- Return only the rewritten prompt as plain text. Do not add a preamble,
  markdown fence, or explanation.

**Implementation steps:**

- [x] Build `SystemMessage` and `UserMessage` values in a pure helper that is
  directly unit-testable.
- [x] Treat the source prompt as quoted user data, not as instructions that can
  redefine the rewrite task.
- [x] Resolve the configured provider and model with `get_llm_client()` and
  `get_model()`.
- [x] Call `get_generate_kwargs(..., max_tokens=512, stream=False)`.
- [x] Consume the completion through `stream_generate_events()` and
  `extract_text()`.
- [x] Trim the result and defensively remove an accidental outer markdown
  fence or a single generic prefix such as `Rewritten prompt:`.
- [x] Reject an empty or oversized completion instead of falling back to the
  source silently.
- [x] Normalize provider failures through `handle_llm_client_exceptions()`.
- [x] Do not enable tools, reasoning, web search, memory, or image generation.

**Tests:**

- [x] Prompt builder includes the exact source content and optional context.
- [x] Auto language instructs the model to preserve the source language.
- [x] Explicit Vietnamese and English values request the correct language.
- [x] Completion extraction works for OpenAI, Google, and custom-provider
  response shapes through the shared event abstraction.
- [x] Empty completion produces a coded client-safe error.
- [x] Provider exceptions retain the existing normalized error behavior.
- [x] Accidental markdown fences/prefixes are removed without modifying the
  prompt body.

### Task 3: Expose the HTTP endpoint

**Files:**

- Create: `gslide-api/servers/fastapi/api/v1/ppt/endpoints/prompt.py`
- Modify: `gslide-api/servers/fastapi/api/v1/ppt/router.py`
- Modify: `gslide-api/servers/fastapi/tests/unit/test_prompt_rewrite.py`

**Steps:**

- [x] Create `PROMPT_ROUTER = APIRouter(prefix="/prompt", tags=["Prompt"])`.
- [x] Add `POST /rewrite` with the response model.
- [x] Pass `Request.is_disconnected` to the LLM layer where supported.
- [x] Register the router exactly once in the PPT router.
- [x] Return validation errors as normal FastAPI `422` responses.
- [x] Return LLM/provider failures using existing coded error semantics.
- [x] Do not write to presentation, async-task, or memory tables.

**Endpoint tests:**

- [x] Valid request returns `{ "rewritten_prompt": "..." }`.
- [x] Invalid request never invokes the LLM helper.
- [x] Provider error status and safe detail are preserved.
- [x] Route registration exposes `/api/v1/ppt/prompt/rewrite`.
- [x] The endpoint performs no database writes.

## 8. Frontend implementation

### Task 4: Add the frontend API boundary

**Files:**

- Modify: `gslide-web/app/(presentation-generator)/services/api/presentation-generation.ts`
- Create or modify: `gslide-web/tests/prompt-rewrite.test.mjs`

**Interface:**

```ts
type RewritePromptRequest = {
  prompt: string;
  language?: LanguageType | null;
  nSlides?: number | null;
  signal?: AbortSignal;
};

type RewritePromptResponse = {
  rewritten_prompt: string;
};
```

**Steps:**

- [x] Add `PresentationGenerationApi.rewritePrompt()`.
- [x] Convert the stable frontend language code to its legacy wire value.
- [x] Send `POST /api/v1/ppt/prompt/rewrite` through `getApiUrl()`.
- [x] Use `getHeader()` and `ApiResponseHandler.handleResponse()`.
- [x] Forward an optional `AbortSignal` to `fetch`.
- [x] Validate that the returned `rewritten_prompt` is a non-empty string.
- [x] Do not mutate upload state inside the API client.

### Task 5: Split source and generated prompt UI

**Files:**

- Modify: `gslide-web/app/(presentation-generator)/upload/components/PromptInput.tsx`
- Create: `gslide-web/app/(presentation-generator)/upload/components/RewrittenPrompt.tsx`
- Modify: `gslide-web/app/(presentation-generator)/upload/components/SupportingDoc.tsx`
- Modify: `gslide-web/app/(presentation-generator)/upload/components/UploadPage.tsx`

**Component responsibilities:**

- `PromptInput` owns only the editable source textarea presentation.
- `RewrittenPrompt` presents empty, loading, fresh, stale, and error states.
- `UploadPage` owns rewrite orchestration and generation eligibility.
- `SupportingDoc` receives the final disabled state for the Create button.

**Steps:**

- [x] Remove the `footer` slot from `PromptInput`; it has only one caller and
  currently couples the source field to attachment/create controls.
- [x] Keep references above the source input exactly as today.
- [x] Add the rewrite action between the source and result fields.
- [x] Render the lower field at all times so the workflow is understandable
  before the first rewrite.
- [x] Make the lower result read-only, selectable, scrollable, and visually
  distinct from the editable source.
- [x] Preserve `GSlideDropCard`, existing radii, tokens, and responsive width.
- [x] Do not add a modal or navigate away from `/upload`.
- [x] Preserve attachment upload and the round Create button placement.

### Task 6: Implement rewrite orchestration and freshness

**File:**

- Modify: `gslide-web/app/(presentation-generator)/upload/components/UploadPage.tsx`

**State:**

```ts
const [rewrittenPrompt, setRewrittenPrompt] = useState("");
const [rewrittenFromPrompt, setRewrittenFromPrompt] = useState("");
const [isRewriting, setIsRewriting] = useState(false);
const [rewriteError, setRewriteError] = useState<string | null>(null);
```

Derived values:

```ts
const sourcePrompt = config.prompt.trim();
const isRewriteFresh =
  rewrittenPrompt.trim().length > 0 &&
  rewrittenFromPrompt === sourcePrompt;
const promptRequiresRewrite = sourcePrompt.length > 0;
```

**Steps:**

- [x] Keep `config.prompt` as the editable source to minimize changes to the
  existing configuration form.
- [x] Capture the normalized source string at the beginning of each request.
- [x] Store that exact source in `rewrittenFromPrompt` only after success.
- [x] Mark the result stale through derived state when the source changes.
- [x] Clear the lower result when the source becomes empty.
- [x] Maintain one `AbortController` and a monotonically increasing request ID.
- [x] Abort the in-flight rewrite when a newer rewrite starts or the component
  unmounts.
- [x] If the source changes during a request, discard the old response even if
  abort arrives too late.
- [x] Keep the previous result visible if a refresh fails.
- [x] Never overwrite the upper source prompt with the response.
- [x] Disable duplicate rewrite submissions while the same request is active.

### Task 7: Generate from the correct prompt

**File:**

- Modify: `gslide-web/app/(presentation-generator)/upload/components/UploadPage.tsx`

Generation rules:

```ts
if (sourcePrompt) {
  require(isRewriteFresh);
  finalPrompt = rewrittenPrompt.trim();
} else {
  finalPrompt = "";
  require(files.length > 0 || validCommunityReference);
}
```

**Steps:**

- [x] Add freshness validation to `validateConfiguration()`.
- [x] Show a localized message when source content exists but has not been
  rewritten or the rewrite is stale.
- [x] Apply the same validation to clicks and `Ctrl/Cmd + Enter`.
- [x] Build a `generationConfig` with `prompt: finalPrompt` immediately before
  generation.
- [x] Use `finalPrompt` as `content` in both document-backed and direct
  `createPresentation()` calls.
- [x] Dispatch `generationConfig`, not the source config, through
  `setPptGenUploadState()` so later lifecycle steps retain the actual prompt
  used for generation.
- [x] Disable Create while rewriting or while a non-empty source has no fresh
  result.
- [x] Preserve document-only and community-reference-only validation.
- [x] Preserve Standard/Smart routing and every existing generation payload
  field besides `content`.

## 9. Localization

**Files:**

- Modify: `gslide-web/i18n/locales/vi.ts`
- Modify: `gslide-web/i18n/locales/en.ts`
- Modify tests only if the catalog parity contract requires it.

Add keys under `upload.prompt` for:

- source label and placeholder
- rewrite action
- rewriting state
- rewritten result label
- empty result hint
- stale badge and helper text
- update action
- retry action
- rewrite failure title and fallback description
- rewrite-required validation title and description
- accessibility labels/statuses

All new visible copy must come from the catalogs. Do not hard-code Vietnamese
or English strings in components.

## 10. Frontend tests

### Node contract tests

**Suggested file:** `gslide-web/tests/prompt-rewrite.test.mjs`

- [x] API client targets `/api/v1/ppt/prompt/rewrite`.
- [x] API client uses the shared URL, header, and response helpers.
- [x] Upload orchestration keeps source and rewritten values separate.
- [x] Generation payload uses the fresh rewritten value.
- [x] Document-only creation remains allowed.
- [x] Existing upload shell renders the hero only once.
- [x] Vietnamese and English catalogs expose matching rewrite keys.

### Cypress component tests

**Suggested file:** `gslide-web/cypress/component/prompt-rewrite.cy.tsx`

- [x] Empty source disables Rewrite.
- [x] Entering source enables Rewrite and keeps Create disabled.
- [x] Loading state appears after Rewrite is clicked.
- [x] Successful response appears only in the lower field.
- [x] Upper field remains unchanged after success.
- [x] Editing the upper field marks the result stale and disables Create.
- [x] Refreshing produces a fresh result and re-enables Create.
- [x] A late response from an older request is ignored.
- [x] Failed refresh retains the previous lower result.
- [x] Lower prompt is read-only but selectable.
- [x] Keyboard Create follows the same freshness rules.
- [x] Document-only and community-reference-only flows still work.

## 11. Observability and privacy

- Log operation name, provider, model, duration, success/failure, input length,
  and output length.
- Do not log raw source or rewritten prompt text.
- Do not store either value outside the existing eventual presentation create
  request.
- Cap output tokens at 512 to bound latency and cost.
- Manual triggering and disabled duplicate submission are the first-release
  cost controls.
- Track client aborts separately from provider failures where practical.

## 12. Implementation order

1. Add failing backend model and prompt-builder tests.
2. Implement request/response models and the LLM rewrite helper.
3. Add endpoint tests, endpoint implementation, and router registration.
4. Add the typed frontend API method and contract test.
5. Add localization keys.
6. Split the source and rewritten prompt UI.
7. Implement request cancellation, stale-result protection, and state machine.
8. Switch both generation branches and Redux persistence to the fresh rewrite.
9. Add Cypress interaction coverage.
10. Run automated checks and complete the manual smoke matrix.

Do not start the UI against a fake local rewrite implementation. Complete the
backend contract first so the frontend integrates against the real response and
error semantics.

## 13. Verification commands

Backend, from `gslide-api/servers/fastapi`:

```powershell
uv run pytest tests/unit/test_prompt_rewrite.py -q
uv run pytest tests/unit/test_llm_dispatcher.py tests/unit/test_small_surfaces_coverage.py -q
uv run ruff check api/v1/ppt/endpoints/prompt.py models/prompt_rewrite.py utils/llm_calls/rewrite_presentation_prompt.py tests/unit/test_prompt_rewrite.py
```

Frontend, from `gslide-web`:

```powershell
node tests/prompt-rewrite.test.mjs
npm run check:i18n-copy
npm run typecheck
npm run lint -- --quiet
npx cypress run --component --spec cypress/component/prompt-rewrite.cy.tsx
npm run build
```

## 14. Manual smoke matrix

| Scenario | Expected result |
| --- | --- |
| Vietnamese source, Vietnamese selected | Lower result is Vietnamese |
| English source, Auto selected | Lower result remains English |
| Rewrite succeeds | Source unchanged, lower result populated, Create enabled |
| Source changes after success | Lower result labeled stale, Create disabled |
| Rewrite refresh succeeds | Lower result replaced, stale state cleared |
| Rewrite refresh fails | Previous result remains visible, Create stays disabled if stale |
| Two requests overlap | Only the latest matching response is applied |
| Prompt plus attachments | Only prompt text is rewritten; attachments remain selected |
| Attachments without prompt | Existing document-only creation still works |
| Community reference without prompt | Existing community-only creation still works |
| Standard mode | Existing destination and payload behavior remain unchanged |
| Smart mode | Existing streaming destination and design reference remain unchanged |
| Provider missing or invalid | Safe localized error; source and previous result preserved |
| Mobile viewport | Both fields, rewrite action, attachments, and Create remain usable |

## 15. Definition of done

- [x] `/upload` visibly presents separate source and rewritten prompt fields.
- [x] The source field remains editable after every rewrite.
- [x] AI output never overwrites the source field.
- [x] Editing source makes the existing AI result stale.
- [x] Stale AI output cannot be submitted for generation.
- [x] Generation uses the latest fresh rewritten prompt in both backend calls
  and persisted frontend generation state.
- [x] Document-only and community-reference-only flows do not regress.
- [x] All visible states are localized in Vietnamese and English.
- [x] Provider errors are safe and the user's content is preserved.
- [x] No prompt text is added to application logs or a new database table.
- [x] Backend unit/endpoint tests, frontend Node/Cypress tests, typecheck, lint,
  i18n checks, and production build pass.
- [ ] Manual smoke scenarios pass on desktop and mobile widths.
