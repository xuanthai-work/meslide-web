# GSlide Document-Aware Prompt Rewrite Plan

- Date: 2026-09-16
- Status: Implemented behind rollout flag; rollout evaluation pending
- Scope: `gslide-web` upload orchestration and `gslide-api` document-aware
  prompt rewrite
- Implementation status: Feature complete in `gslide-api`, `gslide-web`, and
  `gslide-ops`; production rollout and representative document evaluation
  remain opt-in follow-up work

## Implementation record

Completed on `feat/prompt-rewrite` on 2026-09-16.

- `gslide-api` validates owner-scoped decomposed paths, builds and caches
  bounded document profiles, grounds initial and repair rewrites, and emits
  metadata-only observability.
- `gslide-web` prepares documents once per file set and language, reuses the
  decomposed paths for Create, invalidates stale rewrites from the complete
  context, and preserves prompt-only and document-only flows.
- `gslide-ops` exposes `GSLIDE_FEATURE_DOCUMENT_AWARE_REWRITE`, defaulting to
  `false`, to support a controlled rollout.
- The upload composer explains whether documents affect Rewrite or only
  Create, while keeping the source prompt editable and the optimized prompt
  reviewable.
- Backend unit coverage, the full web quality gate, the prompt rewrite Cypress
  suite, and production build pass. Removing the rollout flag remains a
  post-rollout decision based on production metrics.

## Goal

When a user supplies both a prompt and supporting documents, rewrite the prompt
with a compact, grounded profile of those documents before outline generation.
The user should be able to review a document-aware brief, while the outline
generator still receives the full extracted document text.

The system must parse/OCR each selected file only once for a given file set and
language. Rewriting the prompt repeatedly must reuse the prepared documents and
the cached document profile.

## Current flow and constraints

The current upload flow is:

1. The browser keeps selected files as `File[]`.
2. Prompt rewrite sends only `prompt`, `language`, and `n_slides`.
3. Files are uploaded only after the user presses Create.
4. `/files/decompose` parses/OCRs the uploaded files into temporary text files.
5. Presentation creation stores those decomposed text paths.
6. Outline generation reads the decomposed text files and sends the complete
   extracted content as additional context.

Consequences:

- A rewrite cannot currently use document context because no server-side file
  exists at rewrite time.
- The existing decomposition output is already the correct reusable full-text
  artifact. The new flow should move preparation earlier, not add a second
  parser.
- Temporary paths are owner-scoped by `TempFileService`; all new path handling
  must continue through its validation methods.
- The rewrite response can remain `{ rewritten_prompt }`.

## Locked architecture

### Processing pipeline

```text
Select files
    |
    | first Rewrite or Create that needs the files
    v
Upload originals -> Decompose once to text files
                         |
                         +-> Build/cache compact DocumentProfile
                         |       |
Prompt + settings -------+-------+-> Rewrite prompt
                         |
                         +----------> Create presentation
                                         |
                                         v
                              Outline reads full text files
```

### Preparation and cache ownership

- The frontend owns a session cache of uploaded original paths and decomposed
  text paths.
- Original upload cache key: ordered file fingerprint
  `name + size + lastModified + type`.
- Decomposition cache key: file fingerprint plus normalized presentation
  language, because language can affect OCR.
- The backend owns the `DocumentProfile` cache.
- Backend profile cache key: hash of resolved decomposed file contents,
  normalized language, and `DOCUMENT_PROFILE_VERSION`.
- Profiles are stored only in the current owner's temporary directory and are
  written atomically. They are not persisted in the presentation database.
- A cache hit must not make another profile-generation LLM call.

### Source priority

The rewrite prompt must apply inputs in this order:

1. Explicit user prompt
2. Explicit settings such as language and slide count
3. Claims and structure found in uploaded documents
4. Safe presentation defaults

Documents are quoted, untrusted data. Instructions embedded in a document must
never override the rewrite system prompt.

### Full text versus profile

- Prompt rewrite receives only the compact structured `DocumentProfile`.
- Outline generation continues to receive the complete decomposed text.
- The profile describes document-stated claims; it must not relabel them as
  independently verified facts.
- Multiple-document conflicts remain explicit instead of being silently
  resolved.

## Product behavior matrix

| Input | Rewrite behavior | Create behavior |
| --- | --- | --- |
| Prompt only | Current prompt-only rewrite | Uses fresh rewritten prompt |
| Prompt + documents | Prepare documents, build/reuse profile, then rewrite | Reuses decomposed paths and fresh document-aware rewrite |
| Documents only | Rewrite remains unavailable | Prepares documents, then outline uses full text |
| Prompt edited | Keep old rewrite visible and mark stale | Disabled until rewritten again |
| Files added, removed, or replaced | Abort active work, keep old rewrite visible and mark stale | Disabled for prompt flows until rewritten again |
| Language changed | Invalidate decomposition/profile context and rewrite | Uses newly prepared context |
| Slide count changed | Keep decomposed files, invalidate rewrite only | Uses newly rewritten brief |
| Tone/verbosity changed | Does not invalidate rewrite | Passed separately to outline |

There is no silent "rewrite without documents" fallback in the first release.
If selected documents cannot be prepared or profiled, show a localized error
and keep the previous rewrite visible but stale.

## Data contracts

### Frontend types

Add explicit types instead of keeping document responses as `any`:

```ts
type DecomposedDocument = {
  name: string;
  file_path: string;
};

type PreparedDocumentSet = {
  fileFingerprint: string;
  decompositionKey: string;
  uploadedPaths: string[];
  documents: DecomposedDocument[];
};
```

Extend `RewritePromptRequest` with:

```ts
filePaths?: string[];
```

Serialize it as optional `file_paths`. Prompt-only clients remain compatible.

### Backend request model

Extend `PromptRewriteRequest` with:

```py
file_paths: Optional[List[str]] = None
```

Contract requirements:

- At most the same eight files allowed by the upload UI.
- Empty lists normalize to no document context.
- Every path is resolved with `TEMP_FILE_SERVICE.resolve_existing_temp_paths`.
- Extra request keys remain forbidden.
- `PromptRewriteResponse` remains unchanged.

### Document profile model

Add a strict Pydantic model containing bounded fields:

- Source display names
- Primary topic and stated purpose
- Stated audience, if present
- Section/topic map
- Important entities and terms
- Document-stated claims with source provenance
- Numbers and dates with source provenance
- Explicit constraints or requested outcomes
- Conflicts, ambiguity, and missing information
- Stable anchor terms for rewrite quality checks

Use the existing provider-independent structured-output and schema-retry
utilities. Do not introduce provider-specific calls.

## Implementation sequence

### Task 1: Backend request contract

- [x] Add optional `file_paths` validation to `PromptRewriteRequest`.
- [x] Keep prompt-only payloads and the response contract backward compatible.
- [x] Resolve paths inside the endpoint/service boundary before reading.
- [x] Add request-model and endpoint tests for omitted, valid, excessive,
  missing, cross-owner, and out-of-root paths.

Commit target: `feat: accept document context in prompt rewrite requests`

### Task 2: Document profile service

- [x] Add the strict `DocumentProfile` model.
- [x] Add a provider-independent document profiler with explicit
  prompt-injection boundaries.
- [x] Use direct structured profiling for bounded inputs.
- [x] Use deterministic chunking plus profile merge for inputs above the
  configured token/character budget.
- [x] Centralize all chunk, field, and output limits as named constants.
- [x] Include source display names in provenance, never server file paths.
- [x] Add versioned, owner-scoped, content-hash disk caching with atomic writes.
- [x] Add a per-key in-process single-flight guard; cross-process duplicate
  computation may occur but must remain safe through atomic cache writes.
- [x] Never log raw document text, generated profiles, or prompt content.

Suggested files:

- `servers/fastapi/models/document_profile.py`
- `servers/fastapi/services/document_profile_service.py`
- `servers/fastapi/utils/llm_calls/generate_document_profile.py`

Commit target: `feat: build cached profiles for decomposed documents`

### Task 3: Document-aware rewrite composition

- [x] Load or build the profile when resolved `file_paths` are present.
- [x] Add a delimited profile block to both initial and repair rewrite messages.
- [x] State the source-priority rules explicitly in the system prompt.
- [x] Preserve document uncertainty and conflicts rather than inventing a
  resolution.
- [x] Require the rewritten brief to tell outline generation to use the
  uploaded sources as its evidence base.
- [x] Extend the quality gate with document-aware checks using bounded profile
  anchor terms and protected numeric/alphanumeric identifiers.
- [x] Keep the existing one-repair maximum and coded client-safe failures.
- [x] Ensure cancellation/disconnect checks cover profiling and rewriting.

Commit target: `feat: ground rewritten prompts in document profiles`

### Task 4: Frontend document preparation orchestration

- [x] Type the upload and decomposition responses.
- [x] Add `signal` support to `uploadDoc` and `decomposeDocuments`.
- [x] Add `ensureDocumentsPrepared` to upload/decompose only on a cache miss.
- [x] Keep separate upload and decomposition cache keys so a language change
  can reuse uploaded originals while regenerating extracted text.
- [x] Prepare documents before document-aware rewrite.
- [x] Reuse the prepared text paths during Create instead of uploading and
  decomposing again.
- [x] For document-only creation, prepare on Create and skip rewrite.
- [x] Use request IDs plus `AbortController` across upload, decomposition, and
  rewrite so changed files or settings cannot commit obsolete results.
- [x] On an expired/missing temporary path, reprepare the same local files once
  and retry through the normal safe path.

Primary files:

- `app/(presentation-generator)/services/api/presentation-generation.ts`
- `app/(presentation-generator)/upload/components/UploadPage.tsx`

Commit target: `feat: prepare uploaded documents before prompt rewrite`

### Task 5: Rewrite freshness context

- [x] Replace prompt-only freshness with a deterministic
  `rewriteContextKey`.
- [x] Include normalized prompt, language, parsed slide count, and selected file
  fingerprint.
- [x] Capture the context key at request start and store it only after success.
- [x] Mark the result stale when any included input changes.
- [x] Keep the previous rewrite visible when stale or after a failed refresh.
- [x] Do not invalidate for tone, verbosity, theme, or other settings that are
  not inputs to rewrite.
- [x] Require both a fresh rewrite and matching prepared documents before a
  prompt-plus-document Create.

Commit target: `fix: derive rewrite freshness from the complete context`

### Task 6: Loading, errors, and accessibility

- [x] Represent preparation as explicit phases:
  `uploading_documents`, `reading_documents`, and `rewriting`.
- [x] Add localized Vietnamese and English status/error strings.
- [x] Keep the current result card and stale state; do not add a new document
  summary card in this release.
- [x] Announce phase changes through the existing polite live region.
- [x] Prevent duplicate Rewrite/Create actions while work is active.
- [x] Keep file removal and source editing safe by aborting and invalidating the
  active request before updating state.
- [x] Do not surface raw provider, parser, path, or document content in errors.

Commit target: `feat: surface document-aware rewrite progress`

### Task 7: Tests and evaluation

Backend unit and integration coverage:

- [x] Prompt-only rewrite remains byte-contract compatible.
- [x] Decomposed files are resolved within the current owner boundary.
- [x] Profile schema parsing and bounded output.
- [x] Small-document direct profile path.
- [x] Large-document chunk and merge path.
- [x] Multiple documents with complementary and conflicting claims.
- [x] Document prompt injection is ignored.
- [x] Profile cache miss, hit, version invalidation, corruption recovery, and
  concurrent callers.
- [x] Document-aware initial rewrite and repair calls.
- [x] Missing/stale temporary files return coded safe errors.
- [x] Original parser/OCR runs during decomposition only; outline later reads
  the decomposed text artifact.

Frontend contract and Cypress coverage:

- [x] Prompt-only rewrite performs no document requests.
- [x] First prompt-plus-document rewrite uploads, decomposes, then rewrites.
- [x] A second rewrite with the same files/language skips upload/decomposition.
- [x] Create reuses prepared paths.
- [x] Document-only Create prepares files and skips rewrite.
- [x] Add/remove/replace file marks the result stale.
- [x] Language change re-decomposes and marks stale.
- [x] Slide-count change marks stale without re-decomposing.
- [x] A late response from an obsolete file set is discarded.
- [x] Failed preparation keeps the previous rewrite visible and prevents unsafe
  Create.
- [x] Keyboard submission obeys the same freshness checks.

Evaluation fixtures:

- [ ] Sparse prompt plus a Vietnamese report with concrete dates and metrics.
- [ ] Unknown product name explained only by the attached document.
- [ ] Two documents containing conflicting values.
- [ ] A document containing malicious rewrite instructions.
- [ ] Long PDF, scanned PDF, Office document, image OCR, and plain text.
- [ ] Vietnamese, English, and mixed-language documents.

Verification commands:

- [x] Targeted backend request/profile/rewrite tests and Ruff.
- [x] Outline/document-loader regression tests.
- [x] Full frontend Node test suite.
- [x] Prompt rewrite Cypress component suite.
- [x] Frontend i18n, ESLint, typecheck, dead-code, and production build.

Commit target: `test: cover document-aware prompt rewrite flow`

### Task 8: Rollout

- [x] Gate document-aware rewrite behind a feature flag for the first rollout;
  prompt-only behavior remains unchanged.
- [ ] Remove the flag only after document-aware fixtures show no material
  regression.

Commit target: `chore: add document-aware rewrite rollout flag`

## Failure policy

- Upload/decomposition failure: keep selected local files and the previous
  rewrite; show a localized retryable error.
- Profile failure: do not silently rewrite without documents.
- Rewrite failure: keep the previous rewrite visible but stale.
- Stale or missing temporary paths: reprepare once from the selected local
  files; if that fails, surface a coded error.
- Outline failure: retain the current existing outline retry behavior.
- Cancellation caused by an edit is not shown as an error.

## Non-goals for this release

- Displaying or editing the generated document profile in the UI.
- Automatically creating a rewrite when documents are attached without a user
  prompt.
- Adding a vector database or retrieval system.
- Persisting profiles in the presentation database.
- Replacing full-document outline context with the compact profile.
- Changing community-reference behavior.
- Redesigning the upload page.

## Definition of done

- [x] A prompt plus documents produces a visibly document-specific rewritten
  brief before Create.
- [x] Rewriting the same prompt/file set again does not re-upload, re-decompose,
  or regenerate the document profile.
- [x] Outline generation receives the approved rewritten prompt and full
  decomposed document text.
- [x] Adding/removing files, changing language, changing slide count, or editing
  the prompt yields the correct stale behavior.
- [x] Prompt-only and document-only flows remain backward compatible.
- [x] No raw prompt/document/profile content or server paths appear in logs or
  client-facing errors.
- [ ] All automated verification and evaluation fixtures pass.

