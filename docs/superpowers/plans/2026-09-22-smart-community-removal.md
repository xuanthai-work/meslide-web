# Smart Mode and Community Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Smart Mode and Community from the web app, API, runtime contracts, and database schema while preserving the current Standard and Template V2 workflows and a path-preserving source archive.

**Architecture:** The removal is a coordinated contract contraction across `gslide-api` and `gslide-web`. The API becomes Standard-only first, an Alembic migration fails closed when unexpected Smart/HTML data exists, and the web then removes every retired caller and renderer. Before any source edit, the current working-tree versions of all affected files are copied to an external, non-runnable archive.

**Tech Stack:** Next.js 16, React 19, TypeScript, Redux Toolkit, Node test runner, Cypress; FastAPI, SQLModel, SQLAlchemy, Alembic, pytest; PowerShell on Windows.

**Spec:** `docs/superpowers/specs/2026-09-22-smart-community-removal-design.md`

## Global Constraints

- Archive to exactly `D:\work\Gapo\gslide-gitlab\smart mode and community backup` before modifying runtime source.
- Archive the current working-tree files, including uncommitted content, at their original relative paths.
- The archive is recovery material only; it must not be imported, built, deployed, or added to either application repository.
- Keep Standard generation and Standard Template V2 behavior unchanged.
- Keep `documentAwareRewrite`; remove only `smartModeEnabled` and `communityEnabled`.
- Do not remove generic “smart” terminology unless its call path belongs to Smart Mode.
- Do not modify `gslide-inf` unless a concrete dependency is found; the design audit found none.
- Keep the historical Alembic revisions `f3a7c1d9e5b2` and `d2f4a6b8c0e1` intact.
- Legacy field names may remain only in the two historical revisions, the new removal revision, and the exact schema-inference branch in `migrations.py` required to upgrade old databases.
- The new migration must fail instead of deleting rows when Smart presentations or non-empty slide HTML are found.
- Never reset, overwrite, or accidentally stage the pre-existing dirty web files. Record the initial dirty-path list and exclude those paths from commits unless the user explicitly authorizes including them.
- Use `apply_patch` for source edits and file deletions. Exact archive copies may use `Copy-Item -LiteralPath` after validating every destination is inside the approved backup directory.

## Review Focus

- Legacy `/upload?mode=smart&communityId=…` URLs must open the normal Standard flow without fetching Community data; Task 8 adds the regression assertion.
- `documentAwareRewrite` must still resolve from `GSLIDE_FEATURE_DOCUMENT_AWARE_REWRITE`; Task 7 retains and tests that flag alone.
- Template V2 selection overlays, rendering, editing, and export must survive removal of Smart HTML; Tasks 10 and 11 rename the shared overlay and run Template V2 tests.
- The schema migration must drop retired columns only on a clean database and must fail on unexpected Smart/HTML rows; Task 6 tests both conditions and downgrade restoration.
- Removed direct API callers must receive 404 while Standard create/stream/chat remain valid; Tasks 2–5 add OpenAPI and endpoint regression tests.

---

### Task 1: Freeze the recovery archive and baseline

**Files:**
- Create: `D:\work\Gapo\gslide-gitlab\smart mode and community backup\README.md`
- Create: `D:\work\Gapo\gslide-gitlab\smart mode and community backup\manifest.md`
- Create: mirrored `gslide-web` paths enumerated in `manifest.md` under `D:\work\Gapo\gslide-gitlab\smart mode and community backup\gslide-web`
- Create: mirrored `gslide-api` paths enumerated in `manifest.md` under `D:\work\Gapo\gslide-gitlab\smart mode and community backup\gslide-api`

**Interfaces:**
- Consumes: Current `gslide-web` and `gslide-api` working trees before feature-removal edits.
- Produces: An immutable path-preserving source snapshot plus the initial dirty-path lists used by every later task.

- [ ] **Step 1: Record repository state before copying**

Run from `D:\work\Gapo\gslide-gitlab`:

```powershell
git -C gslide-web rev-parse HEAD
git -C gslide-web status --short
git -C gslide-api rev-parse HEAD
git -C gslide-api status --short
```

Expected: capture both commit IDs; preserve the exact `gslide-web` dirty list in `manifest.md`; `gslide-api` is expected to be clean.

- [ ] **Step 2: Build the archive include list from the implementation tasks**

The manifest must contain every file named under Tasks 2–12, classified as `delete`, `modify`, `rename`, `generated`, or `historical-preserve`. It must explicitly include these easy-to-miss Smart-only files:

```text
gslide-api/servers/fastapi/utils/llm_calls/edit_slide_html.py
gslide-api/servers/fastapi/utils/llm_calls/generate_smart_presentation.py
gslide-api/servers/fastapi/utils/smart_slide_layout.py
gslide-api/servers/fastapi/services/image_search/smart_html.py
gslide-web/app/(presentation-generator)/components/useSmartChartInjection.ts
gslide-web/components/SmartHtmlSelectionOverlay.cy.tsx
gslide-web/public/Smart.mp4
```

- [ ] **Step 3: Create the archive documentation**

Create `README.md` with this content:

```markdown
# Smart Mode and Community source archive

This directory contains the pre-removal working-tree source for Smart Mode and Community.
It is recovery material only: do not import it, build it, deploy it, or add it to the
`gslide-web` or `gslide-api` repositories. Restore a file by comparing its archived
relative path with the corresponding repository path and applying only the required code.
```

Create `manifest.md` with the captured timestamp, both commit IDs, both initial status outputs, and a table:

```markdown
| Repository | Relative path | Action | Archived SHA-256 |
|---|---|---|---|
```

- [ ] **Step 4: Copy each listed source file without broad recursion**

For every manifest entry, resolve and validate the source and destination, then copy with the same relative path:

```powershell
$workspace = (Resolve-Path -LiteralPath 'D:\work\Gapo\gslide-gitlab').Path
$backup = Join-Path $workspace 'smart mode and community backup'
$source = Join-Path $workspace 'gslide-web\lib\feature-flags.ts'
$destination = Join-Path $backup 'gslide-web\lib\feature-flags.ts'
if (-not $destination.StartsWith($backup, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid backup destination' }
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
Copy-Item -LiteralPath $source -Destination $destination
```

Repeat with literal paths from the manifest; do not use `*` or copy either whole repository.

- [ ] **Step 5: Hash and verify the archive**

For each manifest entry, compare `Get-FileHash -Algorithm SHA256` for source and destination. Then run:

```powershell
Get-ChildItem -LiteralPath 'D:\work\Gapo\gslide-gitlab\smart mode and community backup' -Recurse -File | Measure-Object
```

Expected: every manifest source exists in the archive and every recorded source/destination hash matches.

- [ ] **Step 6: Run and record the baseline suites**

```powershell
cd D:\work\Gapo\gslide-gitlab\gslide-web
npm test
npm run typecheck

cd D:\work\Gapo\gslide-gitlab\gslide-api
npm run test:fastapi
```

Expected: record passes and any pre-existing failures in `manifest.md`. Do not fix unrelated baseline failures in this task.

This task intentionally has no Git commit because the approved archive lives outside both repositories.

### Task 2: Remove the Community API and public mode contract

**Files:**
- Create: `gslide-api/servers/fastapi/tests/unit/test_retired_smart_community_contract.py`
- Modify: `gslide-api/servers/fastapi/api/v1/ppt/router.py`
- Modify: `gslide-api/servers/fastapi/api/v1/ppt/endpoints/presentation_crud.py`
- Modify: `gslide-api/servers/fastapi/api/v1/ppt/endpoints/presentation.py`
- Modify: `gslide-api/servers/fastapi/api/v1/ppt/endpoints/presentation_responses.py`
- Modify: `gslide-api/servers/fastapi/models/presentation_with_slides.py`
- Modify: `gslide-api/servers/fastapi/tests/test_presentation_generation_api.py`
- Delete: `gslide-api/servers/fastapi/api/v1/ppt/endpoints/community.py`
- Delete: `gslide-api/servers/fastapi/services/community_presentations.py`
- Delete: `gslide-api/servers/fastapi/tests/unit/test_presentation_mode_switch.py`

**Interfaces:**
- Consumes: Existing Standard `POST /api/v1/ppt/presentation/create` body and `PresentationWithSlides` fields.
- Produces: Standard-only create contract; no Community router; no `PATCH /presentation/{id}/mode`; response serialization without mode aliases.

- [ ] **Step 1: Write the failing contract test**

Add assertions to the new test file:

```python
from server import app
from models.presentation_with_slides import PresentationWithSlides


def test_retired_routes_are_absent_from_openapi():
    paths = app.openapi()["paths"]
    assert "/api/v1/ppt/community/presentations" not in paths
    assert "/api/v1/ppt/community/presentations/{community_id}" not in paths
    assert not any(path.endswith("/mode") for path in paths)


def test_presentation_response_has_no_retired_mode_fields():
    fields = PresentationWithSlides.model_fields
    assert "generation_mode" not in fields
    assert "type" not in fields
    assert "community_design_ids" not in fields
```

- [ ] **Step 2: Run the test and verify the old contract is detected**

Run:

```powershell
cd D:\work\Gapo\gslide-gitlab\gslide-api\servers\fastapi
uv run --locked pytest tests/unit/test_retired_smart_community_contract.py -q
```

Expected: FAIL because Community/mode paths and response fields still exist.

- [ ] **Step 3: Remove Community routing and service files**

Delete the `COMMUNITY_ROUTER` import/include from `api/v1/ppt/router.py`, then delete `endpoints/community.py` and `services/community_presentations.py` with `apply_patch`. Do not remove `aiohttp`; it remains used by downloads, model discovery, web search, fonts, webhooks, and image generation.

- [ ] **Step 4: Contract Standard creation to Standard inputs only**

In `create_presentation`, remove the `generation_mode` and `community_design_ids` body parameters, `normalize_community_ids`, Smart validation branches, and the two model assignments. The resulting creation tail must be equivalent to:

```python
presentation = PresentationModel(
    version=version,
    content=content,
    n_slides=n_slides or 0,
    language=language,
    file_paths=validated_file_paths,
    tone=tone.value,
    verbosity=verbosity.value,
    instructions=instructions,
    include_table_of_contents=include_table_of_contents,
    include_title_slide=include_title_slide,
    web_search=web_search,
)
```

Keep all existing slide-count, prompt, file-path, web-search, logging, and ownership validation.

- [ ] **Step 5: Remove mode switching and response aliases**

Delete `switch_presentation_mode`, its re-export in `presentation.py`, and the old mode-switch test file. Change `_presentation_response_data` to:

```python
def _presentation_response_data(presentation: PresentationModel) -> dict:
    return presentation.model_dump(
        exclude={
            "layout",
            "structure",
            "theme",
            "generation_mode",
            "community_design_ids",
        }
    )
```

Remove `generation_mode`, `type`, and `community_design_ids` from `PresentationWithSlides`.

- [ ] **Step 6: Update the generation API test**

Replace `test_presentation_responses_include_cloud_compatible_type` with:

```python
def test_presentation_response_omits_retired_mode_fields():
    assert "generation_mode" not in PresentationWithSlides.model_fields
    assert "type" not in PresentationWithSlides.model_fields
    assert "community_design_ids" not in PresentationWithSlides.model_fields
```

- [ ] **Step 7: Run the focused tests**

```powershell
cd D:\work\Gapo\gslide-gitlab\gslide-api\servers\fastapi
uv run --locked pytest tests/unit/test_retired_smart_community_contract.py tests/test_presentation_generation_api.py -q
```

Expected: PASS.

- [ ] **Step 8: Commit the API contract removal**

```powershell
git -C D:\work\Gapo\gslide-gitlab\gslide-api add -- servers/fastapi/api/v1/ppt/router.py servers/fastapi/api/v1/ppt/endpoints/presentation_crud.py servers/fastapi/api/v1/ppt/endpoints/presentation.py servers/fastapi/api/v1/ppt/endpoints/presentation_responses.py servers/fastapi/models/presentation_with_slides.py servers/fastapi/tests/test_presentation_generation_api.py servers/fastapi/tests/unit/test_retired_smart_community_contract.py servers/fastapi/api/v1/ppt/endpoints/community.py servers/fastapi/services/community_presentations.py servers/fastapi/tests/unit/test_presentation_mode_switch.py
git -C D:\work\Gapo\gslide-gitlab\gslide-api commit -m "refactor: remove community and presentation mode APIs"
```

### Task 3: Collapse generation and streaming to Standard only

**Files:**
- Modify: `gslide-api/servers/fastapi/api/v1/ppt/endpoints/presentation.py`
- Modify: `gslide-api/servers/fastapi/api/v1/ppt/endpoints/slide.py`
- Modify: `gslide-api/servers/fastapi/services/image_search/constants.py`
- Modify: `gslide-api/servers/fastapi/utils/llm_utils.py`
- Modify: `gslide-api/servers/fastapi/tests/unit/test_presentation_stream_disconnect.py`
- Delete: `gslide-api/servers/fastapi/api/v1/ppt/endpoints/presentation_smart_stream.py`
- Delete: `gslide-api/servers/fastapi/utils/llm_calls/generate_smart_presentation.py`
- Delete: `gslide-api/servers/fastapi/utils/llm_calls/edit_slide_html.py`
- Delete: `gslide-api/servers/fastapi/utils/smart_slide_layout.py`
- Delete: `gslide-api/servers/fastapi/services/image_search/smart_html.py`
- Delete: `gslide-api/servers/fastapi/tests/unit/test_presentation_smart_stream.py`
- Delete: `gslide-api/servers/fastapi/tests/unit/test_smart_presentation_generation.py`
- Delete: `gslide-api/servers/fastapi/tests/unit/test_image_search_smart_html.py`

**Interfaces:**
- Consumes: Existing Standard `stream_presentation` implementation and `POST /slide/edit` JSON-slide editor.
- Produces: One Standard SSE path and one Standard JSON-slide edit API; no `slide_html` producer or `/slide/edit-html` path.

- [ ] **Step 1: Extend the failing retired-contract test**

Add:

```python
def test_smart_html_edit_route_is_absent():
    paths = app.openapi()["paths"]
    assert "/api/v1/ppt/slide/edit-html" not in paths
    assert "/api/v1/ppt/slide/edit" in paths
```

Run the focused test and expect FAIL because `/slide/edit-html` still exists.

- [ ] **Step 2: Remove Smart stream dispatch**

Remove the `_stream_smart_presentation` import and this branch from `stream_presentation`:

```python
if presentation.generation_mode == "smart":
    return await _stream_smart_presentation(...)
```

The first post-fetch validation must now be the existing Standard structure/layout validation. Preserve disconnect checks, safe SSE cancellation, `regenerate`, progress events, `slide_assets`, completion, and error events.

- [ ] **Step 3: Remove Smart HTML slide editing**

Delete `edit_slide_html` and its imports from `endpoints/slide.py`. Preserve `edit_slide`, template-layout detection, memory persistence for JSON slides, and asset resolution.

- [ ] **Step 4: Delete Smart generation and HTML helper modules**

Delete the five Smart-only runtime files listed above. Remove `max_slots_per_smart_slide` from `ImageSearchLimits` and update the `llm_utils.py` comment so it describes the remaining chat/Standard event consumer without claiming a Smart generator.

- [ ] **Step 5: Remove Smart-only tests while preserving Standard disconnect coverage**

Delete Smart stream/generation/image-search tests. In `test_presentation_stream_disconnect.py`, remove `test_stream_smart_presentation_accepts_request` and `test_smart_wait_loop_checks_request_disconnect_in_source`; keep and run:

```text
test_stream_presentation_accepts_request
test_standard_stream_passes_disconnect_checker_and_stops
test_safe_sse_stream_swallows_cancelled_error_cleanly
```

- [ ] **Step 6: Run focused Standard tests**

```powershell
cd D:\work\Gapo\gslide-gitlab\gslide-api\servers\fastapi
uv run --locked pytest tests/unit/test_retired_smart_community_contract.py tests/unit/test_presentation_stream_disconnect.py tests/test_presentation_generation_api.py -q
```

Expected: PASS and no import error for deleted Smart modules.

- [ ] **Step 7: Commit Standard-only generation**

Stage only the files listed in this task and commit:

```powershell
git -C D:\work\Gapo\gslide-gitlab\gslide-api commit -m "refactor: keep standard presentation generation only"
```

### Task 4: Make presentation chat Standard-only

**Files:**
- Modify: `gslide-api/servers/fastapi/api/v1/ppt/endpoints/chat.py`
- Modify: `gslide-api/servers/fastapi/models/chat.py`
- Modify: `gslide-api/servers/fastapi/services/chat/memory_layer.py`
- Modify: `gslide-api/servers/fastapi/services/chat/prompts.py`
- Modify: `gslide-api/servers/fastapi/services/chat/schemas.py`
- Modify: `gslide-api/servers/fastapi/services/chat/service.py`
- Modify: `gslide-api/servers/fastapi/services/chat/tools.py`
- Modify: `gslide-api/servers/fastapi/tests/unit/test_chat_trace_codes.py`
- Delete: `gslide-api/servers/fastapi/tests/unit/test_smart_chat_assistant.py`

**Interfaces:**
- Consumes: `ChatMessageRequest` with presentation ID, message, optional conversation ID, and attachments; Standard `PresentationChatService` and JSON-slide tools.
- Produces: A chat request and service with no presentation-type switch, no HTML-slide tools, and the existing Standard tool set unchanged.

- [ ] **Step 1: Add a failing Standard-only chat contract test**

Append to `test_retired_smart_community_contract.py`:

```python
from models.chat import ChatMessageRequest


def test_chat_request_has_no_presentation_type_switch():
    assert "presentation_type" not in ChatMessageRequest.model_fields
```

Run it and expect FAIL while the field remains.

- [ ] **Step 2: Remove the request and endpoint type switch**

Remove `presentation_type` from `ChatMessageRequest`. Update chat endpoint construction so it no longer passes `request.presentation_type`:

```python
service = PresentationChatService(
    sql_session=sql_session,
    presentation_id=request.presentation_id,
    conversation_id=request.conversation_id,
)
```

Also remove `presentation_type` query parameters and validation from the list-conversations, history, and delete-conversation handlers. Those handlers must scope by `presentation_id` and `conversation_id` only.

- [ ] **Step 3: Remove Smart prompt, schemas, traces, and tool dispatch**

Remove:

```text
SMART_CHAT_AI_ASSISTANT_SYSTEM_PROMPT
GetSmartPresentationContextInput
SaveSmartSlideInput
getSmartPresentationContext handler/definition
_get_smart_tool_definitions
Smart branch in _save_slide
chat.trace.reading_smart_deck_context
```

Make `build_system_prompt` always return the existing Standard prompt. Make `ChatTools.get_tool_definitions()` directly return the current Standard list.

- [ ] **Step 4: Remove Smart memory operations**

Remove `presentation_type` state and every Smart/HTML-only method/branch from `PresentationChatMemoryLayer`, including:

```text
get_smart_presentation_context
save_html_slide
_smart_slide_title
HTML branches in search/get/delete/fallback slide creation
community_design_ids from memory context
generate_smart_presentation imports
```

Preserve Standard outline, source-document, JSON-slide, layout, component, theme, asset, and memory methods.

- [ ] **Step 5: Simplify the chat service**

Remove the `Literal["standard", "smart"]` constructor parameter, stored `_presentation_type`, persisted-mode comparison, and `presentation_type` argument to `build_system_prompt`. The constructor interface becomes:

```python
def __init__(
    self,
    sql_session: AsyncSession,
    presentation_id: uuid.UUID,
    conversation_id: uuid.UUID | None,
    chat_mode: ChatToolMode = "presentation",
):
```

- [ ] **Step 6: Delete Smart chat tests and update trace-code assertions**

Delete `test_smart_chat_assistant.py`. Remove only `reading_smart_deck_context` expectations from trace-code tests; preserve all Standard trace-code assertions.

- [ ] **Step 7: Run the chat suite**

```powershell
cd D:\work\Gapo\gslide-gitlab\gslide-api\servers\fastapi
uv run --locked pytest tests/unit/test_retired_smart_community_contract.py tests/unit/test_chat_trace_codes.py tests/unit/test_chat_llm_tools.py tests/unit/test_chat_prompts.py tests/test_chat_endpoint.py -q
```

Expected: PASS; Standard chat still exposes its JSON-slide tools.

- [ ] **Step 8: Commit Standard-only chat**

Stage only Task 4 files and commit:

```powershell
git -C D:\work\Gapo\gslide-gitlab\gslide-api commit -m "refactor: remove smart presentation chat"
```

### Task 5: Remove Smart fields from runtime SQL models

**Files:**
- Modify: `gslide-api/servers/fastapi/models/sql/presentation.py`
- Modify: `gslide-api/servers/fastapi/models/sql/slide.py`
- Modify: `gslide-api/servers/fastapi/api/v1/ppt/endpoints/presentation_responses.py`
- Modify: `gslide-api/servers/fastapi/tests/unit/test_retired_smart_community_contract.py`

**Interfaces:**
- Consumes: Standard-only API/stream/chat from Tasks 2–4.
- Produces: Runtime SQLModel classes with no retired fields; cloning copies only Standard data.

- [ ] **Step 1: Add failing model-field assertions**

```python
from models.sql.presentation import PresentationModel
from models.sql.slide import SlideModel


def test_runtime_sql_models_have_no_retired_fields():
    assert "generation_mode" not in PresentationModel.model_fields
    assert "community_design_ids" not in PresentationModel.model_fields
    assert "html_content" not in SlideModel.model_fields
```

Run the focused contract test; expect FAIL.

- [ ] **Step 2: Remove the model fields and clone assignments**

Delete `generation_mode` and `community_design_ids` declarations and their `get_new_presentation()` assignments. Delete `html_content` and its `get_new_slide()` assignment. Remove now-unused `Literal` and any now-unused imports.

- [ ] **Step 3: Simplify response serialization**

Now that the model no longer has retired properties, reduce the response helper to:

```python
def _presentation_response_data(presentation: PresentationModel) -> dict:
    return presentation.model_dump(exclude={"layout", "structure", "theme"})
```

- [ ] **Step 4: Run model and API tests**

```powershell
cd D:\work\Gapo\gslide-gitlab\gslide-api\servers\fastapi
uv run --locked pytest tests/unit/test_retired_smart_community_contract.py tests/test_presentation_generation_api.py -q
```

Expected: PASS.

- [ ] **Step 5: Commit runtime model cleanup**

```powershell
git -C D:\work\Gapo\gslide-gitlab\gslide-api commit -m "refactor: remove smart fields from runtime models"
```

### Task 6: Contract the database schema safely

**Files:**
- Create: `gslide-api/servers/fastapi/alembic/versions/a4e8c2d6f0b1_remove_smart_community_fields.py`
- Modify: `gslide-api/servers/fastapi/migrations.py`
- Modify: `gslide-api/servers/fastapi/tests/unit/test_migrations.py`
- Preserve unchanged: `gslide-api/servers/fastapi/alembic/versions/f3a7c1d9e5b2_add_smart_generation_fields.py`
- Preserve unchanged: `gslide-api/servers/fastapi/alembic/versions/d2f4a6b8c0e1_backfill_smart_presentation_mode.py`

**Interfaces:**
- Consumes: Previous Alembic head `9c3b5d1f7e2a` and a database asserted to contain no Smart/HTML decks.
- Produces: Head `a4e8c2d6f0b1` with the three retired columns removed; downgrade restores compatible column definitions.

- [ ] **Step 1: Write failing migration tests**

Add four tests using the existing `_alembic_config`, SQLite engine, and `command.upgrade/downgrade` patterns:

```python
def test_remove_smart_fields_migration_drops_columns_on_clean_database(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'remove-smart-clean.db'}"
    command.upgrade(_alembic_config(database_url), "9c3b5d1f7e2a")
    command.upgrade(_alembic_config(database_url), "head")
    engine = create_engine(database_url)
    try:
        inspector = inspect(engine)
        presentation_columns = {c["name"] for c in inspector.get_columns("presentations")}
        slide_columns = {c["name"] for c in inspector.get_columns("slides")}
        assert "generation_mode" not in presentation_columns
        assert "community_design_ids" not in presentation_columns
        assert "html_content" not in slide_columns
    finally:
        engine.dispose()


def test_remove_smart_fields_migration_refuses_unexpected_data(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'remove-smart-refuse.db'}"
    command.upgrade(_alembic_config(database_url), "9c3b5d1f7e2a")
    engine = create_engine(database_url)
    try:
        with engine.begin() as connection:
            connection.execute(text("INSERT INTO presentations (id, version, content, n_slides, language, created_at, updated_at, generation_mode) VALUES ('00000000-0000-0000-0000-000000000001', 'v2-standard', 'x', 1, 'en', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'smart')"))
        with pytest.raises(RuntimeError, match="Smart presentation data still exists"):
            command.upgrade(_alembic_config(database_url), "head")
    finally:
        engine.dispose()


def test_remove_smart_fields_migration_refuses_html_slide_data(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'remove-smart-html-refuse.db'}"
    command.upgrade(_alembic_config(database_url), "9c3b5d1f7e2a")
    engine = create_engine(database_url)
    try:
        with engine.begin() as connection:
            connection.execute(text("INSERT INTO presentations (id, version, content, n_slides, language, created_at, updated_at, generation_mode) VALUES ('00000000-0000-0000-0000-000000000001', 'v2-standard', 'x', 1, 'en', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'standard')"))
            connection.execute(text("INSERT INTO slides (id, presentation, layout_group, layout, \"index\", content, html_content) VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'smart-html', 'smart-html', 0, '{}', '<section>legacy</section>')"))
        with pytest.raises(RuntimeError, match="Smart HTML slide data still exists"):
            command.upgrade(_alembic_config(database_url), "head")
    finally:
        engine.dispose()


def test_remove_smart_fields_downgrade_restores_schema(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'remove-smart-down.db'}"
    command.upgrade(_alembic_config(database_url), "head")
    command.downgrade(_alembic_config(database_url), "9c3b5d1f7e2a")
    engine = create_engine(database_url)
    try:
        inspector = inspect(engine)
        assert {"generation_mode", "community_design_ids"} <= {
            c["name"] for c in inspector.get_columns("presentations")
        }
        assert "html_content" in {c["name"] for c in inspector.get_columns("slides")}
    finally:
        engine.dispose()
```

Add `import pytest` if not already present.

- [ ] **Step 2: Run the new tests and verify they fail**

```powershell
cd D:\work\Gapo\gslide-gitlab\gslide-api\servers\fastapi
uv run --locked pytest tests/unit/test_migrations.py -k "remove_smart_fields" -q
```

Expected: FAIL because the new head revision does not exist.

- [ ] **Step 3: Add the fail-closed Alembic revision**

Use revision `a4e8c2d6f0b1`, down revision `9c3b5d1f7e2a`. Its upgrade must:

```python
bind = op.get_bind()
inspector = sa.inspect(bind)
tables = set(inspector.get_table_names())

if "presentations" in tables:
    columns = {c["name"] for c in inspector.get_columns("presentations")}
    if "generation_mode" in columns:
        smart_count = bind.execute(
            sa.text("SELECT COUNT(*) FROM presentations WHERE generation_mode = 'smart'")
        ).scalar_one()
        if smart_count:
            raise RuntimeError("Smart presentation data still exists; remove or migrate it before dropping Smart Mode fields")

if "slides" in tables:
    columns = {c["name"] for c in inspector.get_columns("slides")}
    if "html_content" in columns:
        html_count = bind.execute(
            sa.text("SELECT COUNT(*) FROM slides WHERE html_content IS NOT NULL AND TRIM(html_content) <> ''")
        ).scalar_one()
        if html_count:
            raise RuntimeError("Smart HTML slide data still exists; remove or migrate it before dropping html_content")
```

After validation, use `op.batch_alter_table` and guarded column checks to drop `community_design_ids`, `generation_mode`, and `html_content`. Downgrade restores:

```python
sa.Column("generation_mode", sa.String(), nullable=False, server_default="standard")
sa.Column("community_design_ids", sa.JSON(), nullable=True)
sa.Column("html_content", sa.String(), nullable=True)
```

- [ ] **Step 4: Update migration-head inference**

Add:

```python
REVISION_SMART_COMMUNITY_REMOVED = "a4e8c2d6f0b1"
REVISION_HEAD = REVISION_SMART_COMMUNITY_REMOVED
```

When `_infer_revision_from_schema` sees the template-bundle-ready schema, return the new head only when all three retired columns are absent; otherwise return `REVISION_TEMPLATE_BUNDLE_COLUMNS`. Update existing assertions that previously equated `REVISION_HEAD` with `REVISION_TEMPLATE_BUNDLE_COLUMNS`.

- [ ] **Step 5: Run migration tests**

```powershell
cd D:\work\Gapo\gslide-gitlab\gslide-api\servers\fastapi
uv run --locked pytest tests/unit/test_migrations.py -q
```

Expected: PASS, including legacy upgrade, clean contraction, fail-closed data checks, downgrade, and revision inference.

- [ ] **Step 6: Prove historical revisions were not modified**

```powershell
git -C D:\work\Gapo\gslide-gitlab\gslide-api diff --exit-code -- servers/fastapi/alembic/versions/f3a7c1d9e5b2_add_smart_generation_fields.py servers/fastapi/alembic/versions/d2f4a6b8c0e1_backfill_smart_presentation_mode.py
```

Expected: exit code 0.

- [ ] **Step 7: Commit the migration**

```powershell
git -C D:\work\Gapo\gslide-gitlab\gslide-api add -- servers/fastapi/alembic/versions/a4e8c2d6f0b1_remove_smart_community_fields.py servers/fastapi/migrations.py servers/fastapi/tests/unit/test_migrations.py
git -C D:\work\Gapo\gslide-gitlab\gslide-api commit -m "db: remove smart and community fields"
```

### Task 7: Remove Community navigation and feature flags from the web

**Files:**
- Create: `gslide-web/tests/retired-smart-community.test.mjs`
- Modify: `gslide-web/lib/feature-flags.ts`
- Modify: `gslide-web/app/(presentation-generator)/(dashboard)/Components/DashboardSidebar.tsx`
- Modify: `gslide-web/cypress/component/feature-flags.cy.tsx`
- Modify: `gslide-web/cypress/component/prompt-rewrite.cy.tsx`
- Modify: `gslide-web/cypress/component/web-search-upload-toggle.cy.tsx`
- Modify: `gslide-web/.env.example`
- Modify: `gslide-web/docker-compose.yml`
- Modify: `gslide-web/deploy/kubernetes/01-configmap.yaml`
- Modify: `gslide-web/.github/workflows/test.yml`
- Modify: `gslide-web/.gitlab-ci.yml`
- Modify: `gslide-web/tests/standalone-compose.test.mjs`
- Modify: `gslide-web/tests/ci-enforcement-pr6.test.mjs`
- Delete: `gslide-web/app/(presentation-generator)/(dashboard)/community/page.tsx`
- Delete: `gslide-web/app/(presentation-generator)/(dashboard)/community/components/CommunityPage.tsx`
- Delete: `gslide-web/app/(presentation-generator)/(dashboard)/community/components/CommunityDesignPreviewDialog.tsx`
- Delete: `gslide-web/app/(presentation-generator)/services/api/community.ts`
- Delete: `gslide-web/app/(presentation-generator)/upload/components/CommunityPresentationFilters.tsx`
- Delete: `gslide-web/app/(presentation-generator)/upload/components/CommunityReferencePicker.tsx`

**Interfaces:**
- Consumes: Existing `FeatureFlagsProvider` and `documentAwareRewrite` consumers.
- Produces: `FeatureFlags = { documentAwareRewrite: boolean }`; no Community page, navigation, client, or picker.

- [ ] **Step 1: Add failing source-boundary tests**

```javascript
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("community route and client are removed", () => {
  assert.equal(existsSync(new URL("../app/(presentation-generator)/(dashboard)/community/page.tsx", import.meta.url)), false);
  assert.equal(existsSync(new URL("../app/(presentation-generator)/services/api/community.ts", import.meta.url)), false);
});

test("only document-aware rewrite remains in feature flags", () => {
  const source = read("lib/feature-flags.ts");
  assert.match(source, /documentAwareRewrite/);
  assert.doesNotMatch(source, /smartModeEnabled|communityEnabled|GSLIDE_FEATURE_SMART_MODE|GSLIDE_FEATURE_COMMUNITY/);
});
```

- [ ] **Step 2: Run the test and verify it fails**

```powershell
cd D:\work\Gapo\gslide-gitlab\gslide-web
node --test tests/retired-smart-community.test.mjs
```

Expected: FAIL while Community files and flags exist.

- [ ] **Step 3: Delete Community UI/client files and sidebar branch**

Delete the six Community files with `apply_patch`. Remove `communityEnabled`, the Community icon/import, and the conditional Community link from `DashboardSidebar`.

- [ ] **Step 4: Reduce feature flags to document-aware rewrite**

The resulting interface/resolver must be:

```typescript
export interface FeatureFlags {
  documentAwareRewrite: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  documentAwareRewrite: false,
};

export const resolveFeatureFlags = (
  environment: Record<string, string | undefined>,
): FeatureFlags => ({
  documentAwareRewrite: parseFeatureFlag(
    environment.GSLIDE_FEATURE_DOCUMENT_AWARE_REWRITE,
  ),
});
```

- [ ] **Step 5: Update test providers and deployment configuration**

Remove Smart/Community properties from Cypress provider values. Keep the `documentAwareRewrite` test matrix. Remove `GSLIDE_FEATURE_SMART_MODE` and `GSLIDE_FEATURE_COMMUNITY` from `.env.example`, compose, Kubernetes config, GitHub Actions, and GitLab CI; retain `GSLIDE_FEATURE_DOCUMENT_AWARE_REWRITE`. Update `standalone-compose.test.mjs` and `ci-enforcement-pr6.test.mjs` to assert the retired variables are absent and the document-aware rewrite variable remains.

- [ ] **Step 6: Run focused tests**

```powershell
cd D:\work\Gapo\gslide-gitlab\gslide-web
node --test tests/retired-smart-community.test.mjs tests/prompt-rewrite.test.mjs
npx cypress run --component --spec "cypress/component/feature-flags.cy.tsx,cypress/component/prompt-rewrite.cy.tsx,cypress/component/web-search-upload-toggle.cy.tsx"
```

Expected: PASS.

- [ ] **Step 7: Commit only clean paths**

Commit deleted Community files, feature flags, sidebar, config, and the new test if none were dirty at Task 1. Leave any initially dirty Cypress path unstaged and record that exception.

```powershell
git -C D:\work\Gapo\gslide-gitlab\gslide-web commit -m "refactor: remove community UI and feature flags"
```

### Task 8: Make upload and client state Standard-only

**Files:**
- Modify: `gslide-web/app/(presentation-generator)/upload/components/UploadPage.tsx`
- Modify: `gslide-web/app/(presentation-generator)/upload/components/ConfigurationSelects.tsx`
- Modify: `gslide-web/app/(presentation-generator)/documents-preview/components/DocumentPreviewPage.tsx`
- Modify: `gslide-web/app/(presentation-generator)/services/api/presentation-generation.ts`
- Modify: `gslide-web/app/(presentation-generator)/services/api/dashboard.ts`
- Modify: `gslide-web/app/(presentation-generator)/(dashboard)/dashboard/components/PresentationCard.tsx`
- Modify: `gslide-web/store/slices/presentationGeneration.ts`
- Modify: `gslide-web/tests/automatic-presentation-generation.test.mjs`
- Modify: `gslide-web/tests/retired-smart-community.test.mjs`
- Delete: `gslide-web/app/(presentation-generator)/upload/generation-mode.ts`
- Delete: `gslide-web/app/(presentation-generator)/upload/components/GenerationModeDialog.tsx`
- Delete: `gslide-web/tests/presentation-mode-flow.test.mjs`
- Delete: `gslide-web/public/Smart.mp4`

**Interfaces:**
- Consumes: Standard create inputs (`content`, `version`, `n_slides`, files, language, tone, verbosity, instructions, web search).
- Produces: Standard-only create client/result and upload navigation without `type=smart`; Redux presentation data without mode/community properties.

- [ ] **Step 1: Add failing Standard-only source assertions**

Append:

```javascript
test("upload ignores retired query switches and creates Standard requests", () => {
  const upload = read("app/(presentation-generator)/upload/components/UploadPage.tsx");
  const api = read("app/(presentation-generator)/services/api/presentation-generation.ts");
  assert.doesNotMatch(upload, /params\.get\(["']mode["']\)|communityId|generationMode|communityReference|type=smart/);
  assert.doesNotMatch(api, /generation_mode|community_design_ids|switchPresentationMode/);
  assert.match(api, /version\s*=\s*["']v2-standard["']/);
});
```

Run the file; expect FAIL.

- [ ] **Step 2: Remove mode and Community state from UploadPage**

Remove mode/community imports, state, URL parsing/fetching, `handleGenerationModeChange`, promptless Community validation, Smart URL construction, request fields, configuration props, and picker rendering. Keep the existing prompt rewrite and document-preparation logic byte-for-byte where possible. The only feature flag consumed by this page becomes:

```typescript
const { documentAwareRewrite } = useFeatureFlags();
```

Create navigation must always use the existing Standard URLs.

- [ ] **Step 3: Simplify ConfigurationSelects**

Remove `GenerationModeDialog`, mode props, feature-flag consumption, dialog state, and selector JSX. Keep slide count, language, tone, verbosity, instructions, title/table-of-contents, and web-search settings.

- [ ] **Step 4: Contract the presentation client**

Remove the two retired parameters and `switchPresentationMode`. Return the API result directly:

```typescript
return await ApiResponseHandler.handleResponse(
  response,
  "Failed to create presentation",
);
```

The JSON body must end at `web_search`; it must not synthesize `type`.

- [ ] **Step 5: Remove retired fields from remaining creation/state paths**

Remove `generation_mode: "standard"` from `DocumentPreviewPage`. Remove mode/community properties and reducers from `PresentationData`, including `setPresentationGenerationMode` and `updateSlideHtmlContent`. Remove dashboard routing based on `type`/`generation_mode`; route all supported cards through the Standard/Template V2 decision already based on `version`/layout data.

- [ ] **Step 6: Delete mode files, video, and obsolete tests**

Delete the mode type/dialog, `Smart.mp4`, and the old positive Smart mode-flow test. Update automatic-generation assertions to require a Standard version without requiring a `generation_mode` property.

- [ ] **Step 7: Run upload and state tests**

```powershell
cd D:\work\Gapo\gslide-gitlab\gslide-web
node --test tests/retired-smart-community.test.mjs tests/automatic-presentation-generation.test.mjs tests/prompt-rewrite.test.mjs
npm run typecheck
```

Expected: PASS. This specifically confirms that removing Smart state did not disturb the current prompt rewrite/autoresize work.

- [ ] **Step 8: Commit clean paths without absorbing initial dirty work**

Do not stage `UploadPage.tsx`, `prompt-rewrite` tests, or any other path recorded dirty in Task 1. Commit only clean Task 8 paths; leave overlapping removals visible in the working tree and report them at handoff.

### Task 9: Remove presentation-type switching from the web chat client

**Files:**
- Modify: `gslide-web/app/(presentation-generator)/presentation/components/Chat.tsx`
- Modify: `gslide-web/app/(presentation-generator)/presentation/components/PresentationActions.tsx`
- Modify: `gslide-web/app/(presentation-generator)/presentation/components/chat/chat-adapter.ts`
- Modify: `gslide-web/app/(presentation-generator)/presentation/components/chat/chat-types.ts`
- Modify: `gslide-web/app/(presentation-generator)/presentation/components/chat/chat-utils.ts`
- Modify: `gslide-web/app/(presentation-generator)/presentation/components/chat/useChatSession.ts`
- Modify: `gslide-web/app/(presentation-generator)/services/api/chat.ts`
- Modify: `gslide-web/tests/retired-smart-community.test.mjs`

**Interfaces:**
- Consumes: The Standard-only chat API from Task 4 and existing presentation/Template V2 chat variants.
- Produces: A chat adapter keyed only by resource/conversation IDs and payloads without `presentation_type`; Template V2 still selects its tool mode through `variant`, not presentation mode.

- [ ] **Step 1: Add failing web chat contract assertions**

Append:

```javascript
test("web chat no longer sends or stores presentation type", () => {
  for (const path of [
    "app/(presentation-generator)/services/api/chat.ts",
    "app/(presentation-generator)/presentation/components/chat/chat-types.ts",
    "app/(presentation-generator)/presentation/components/chat/chat-adapter.ts",
    "app/(presentation-generator)/presentation/components/chat/useChatSession.ts",
    "app/(presentation-generator)/presentation/components/Chat.tsx",
  ]) {
    assert.doesNotMatch(read(path), /presentation_type|presentationType|Smart HTML presentation/);
  }
});
```

Run the retirement test and expect FAIL.

- [ ] **Step 2: Contract the API client and adapter**

Remove `presentation_type` from `ChatMessageRequest`. Change list/history/delete signatures to accept only their IDs and stop appending the query parameter:

```typescript
static async listConversations(
  presentationId: string,
): Promise<ChatConversationSummary[]>;

static async getHistory(
  presentationId: string,
  conversationId: string,
): Promise<ChatHistoryData>;

static async deleteConversation(
  presentationId: string,
  conversationId: string,
): Promise<void>;
```

Change `presentationChatAdapter.streamMessage` to map only:

```typescript
{
  presentation_id: payload.resourceId,
  message: payload.message,
  conversation_id: payload.conversation_id,
  attachments: payload.attachments,
}
```

- [ ] **Step 3: Remove presentation type from chat interfaces and storage**

Remove type arguments/properties from `ChatApiAdapter`, `ChatProps`, `loadChatConversation`, and `useChatSession`. Change the storage key to:

```typescript
export const conversationStorageKey = (
  scope: string,
  resourceId: string,
) => `gslide:chat:${scope}:conversationId:${resourceId}`;
```

Update all callers to use the two-argument key and the contracted adapter methods.

- [ ] **Step 4: Remove Smart UI context and action gating**

In `Chat.tsx`, remove the default `presentationType`, both Smart context blocks, and every type argument passed to session/list/delete/stream/storage calls. Preserve Template V2 context, image attachments, selected Template V2 element context, streaming, preview/apply, and reset behavior. In `PresentationActions.tsx`, remove `aiOnly = props.presentationType === "smart"` and use the existing Standard/Template V2 capability rules directly.

- [ ] **Step 5: Pin the Standard and Template V2 client boundaries**

Add these assertions to `retired-smart-community.test.mjs`:

```javascript
const chatApi = read("app/(presentation-generator)/services/api/chat.ts");
const chatUi = read("app/(presentation-generator)/presentation/components/Chat.tsx");
const chatUtils = read("app/(presentation-generator)/presentation/components/chat/chat-utils.ts");
assert.doesNotMatch(chatApi, /searchParams\.set\(["']presentation_type|presentation_type\s*:/);
assert.match(chatUi, /variant\s*===\s*["']template-v2["']/);
assert.match(chatUtils, /gslide:chat:\$\{scope\}:conversationId:\$\{resourceId\}/);
```

- [ ] **Step 6: Run chat and type checks**

```powershell
cd D:\work\Gapo\gslide-gitlab\gslide-web
node --test tests/retired-smart-community.test.mjs
npm run typecheck
```

Expected: PASS; Standard and Template V2 chat still load history, stream messages, and reset conversations.

- [ ] **Step 7: Commit the web chat contraction**

Stage only Task 9 paths that were clean at baseline and commit:

```powershell
git -C D:\work\Gapo\gslide-gitlab\gslide-web commit -m "refactor: remove smart mode from web chat"
```

### Task 10: Remove Smart HTML presentation rendering and stream handling

**Files:**
- Modify: `gslide-web/app/(presentation-generator)/components/PresentationRender.tsx`
- Modify: `gslide-web/app/(presentation-generator)/presentation/hooks/usePresentationStreaming.ts`
- Modify: `gslide-web/app/(presentation-generator)/presentation/components/PresentationPage.tsx`
- Modify: `gslide-web/app/(presentation-generator)/presentation/components/PresentationHeader.tsx`
- Modify: `gslide-web/app/(presentation-generator)/presentation/components/SidePanel.tsx`
- Modify: `gslide-web/app/(presentation-generator)/presentation/components/SlideActionBar.tsx`
- Modify: `gslide-web/app/(presentation-generator)/presentation/components/SlideThumbnailCard.tsx`
- Modify: `gslide-web/app/(export)/pdf-maker/PdfMakerPage.tsx`
- Modify: `gslide-web/app/(presentation-generator)/types/slide.ts`
- Modify: `gslide-web/lib/generation-lifecycle.ts`
- Modify: `gslide-web/tests/generation-lifecycle.test.mjs`
- Modify: `gslide-web/tests/retired-smart-community.test.mjs`
- Delete: `gslide-web/app/(presentation-generator)/components/SmartHtmlEditor.tsx`
- Delete: `gslide-web/app/(presentation-generator)/components/SmartHtmlSlide.tsx`
- Delete: `gslide-web/app/(presentation-generator)/components/useSmartChartInjection.ts`
- Delete: `gslide-web/tests/smart-html-slide-security.test.mjs`
- Delete: `gslide-web/tests/smart-slide-assets-merge.test.mjs`

**Interfaces:**
- Consumes: V1 JSON rendering, Template V2 rendering, Standard SSE `status/chunk/slide_assets/fonts/complete/closing/error/heartbeat` events.
- Produces: Presentation/editor/export paths with no HTML-slide branch and no `slide_html` event.

- [ ] **Step 1: Add failing absence assertions**

```javascript
test("smart html renderer and stream event are removed", () => {
  assert.equal(existsSync(new URL("../app/(presentation-generator)/components/SmartHtmlSlide.tsx", import.meta.url)), false);
  const stream = read("app/(presentation-generator)/presentation/hooks/usePresentationStreaming.ts");
  const lifecycle = read("lib/generation-lifecycle.ts");
  assert.doesNotMatch(stream, /slide_html|isSmartMode|html_content/);
  assert.doesNotMatch(lifecycle, /slide_html/);
});
```

Run and expect FAIL.

- [ ] **Step 2: Delete Smart HTML render/editor modules**

Delete the three Smart-only components/hooks and their two dedicated tests. Do not delete Template V2 HTML preview or Konva components.

- [ ] **Step 3: Remove HTML branches from render surfaces**

- `PresentationRender`: render supported slides through `V1ContentRender` after existing Template V2 handling; remove Smart imports and `html_content` conditional.
- `SlideThumbnailCard`: keep near-viewport and Template V2 preview branches, then use `V1ContentRender`; remove Smart thumbnail branch.
- `PdfMakerPage`: keep Template V2 preview and Standard `SlideScale`; remove `SmartHtmlPdfSlide`, chart injection, HTML Tailwind trigger, and HTML conditional.
- `SlideActionBar`: remove HTML-slide capability checks while retaining Standard action visibility rules.

- [ ] **Step 4: Remove mode decisions from the presentation shell**

- `PresentationPage`: remove query/persisted Smart classification, Smart background, `generationMode` stream option/header prop, and Smart `presentationType`; keep Template V2 detection by `version/layout/slides`.
- `PresentationHeader`: remove `generationMode` prop and every `type=smart` query suffix.
- `SidePanel`: always retain the Standard add-slide control and padding; remove HTML fallback classification.

- [ ] **Step 5: Collapse the stream hook**

Remove `generationMode` from hook options, `isSmartMode`, Smart status/outcome tracking, the `slide_html` case, Smart completion fetch fallback, and Smart dependencies. Preserve Standard retry/stall/cancel lifecycle exactly.

- [ ] **Step 6: Remove retired slide/event types**

Remove `html_content` from the web `Slide` type. Remove `slide_html` from `UsefulStreamEventType` and its set. Change its test assertion to:

```javascript
assert.equal(isUsefulStreamEvent("slide_html"), false);
assert.equal(isUsefulStreamEvent("slide_assets"), true);
```

- [ ] **Step 7: Run rendering and lifecycle tests**

```powershell
cd D:\work\Gapo\gslide-gitlab\gslide-web
node --test tests/retired-smart-community.test.mjs tests/generation-lifecycle.test.mjs tests/template-v2-text-fit.test.mjs
npm run typecheck
```

Expected: PASS, including Template V2 tests.

- [ ] **Step 8: Commit the renderer removal**

Stage only Task 9 paths that were clean at baseline and commit:

```powershell
git -C D:\work\Gapo\gslide-gitlab\gslide-web commit -m "refactor: remove smart html presentation runtime"
```

### Task 11: Preserve the shared Template V2 overlay under a neutral name

**Files:**
- Rename: `gslide-web/app/(presentation-generator)/components/SmartHtmlSelectionOverlay.tsx` → `gslide-web/app/(presentation-generator)/components/HtmlSelectionOverlay.tsx`
- Rename: `gslide-web/components/SmartHtmlSelectionOverlay.cy.tsx` → `gslide-web/components/HtmlSelectionOverlay.cy.tsx`
- Modify: `gslide-web/components/slide-editor/surface/TemplateV2KonvaOverlays.tsx`
- Modify: `gslide-web/components/slide-editor/surface/TemplateV2KonvaSlide.tsx`
- Modify: `gslide-web/components/slide-editor/surface/TemplateV2KonvaStage.tsx`
- Modify: `gslide-web/tests/retired-smart-community.test.mjs`

**Interfaces:**
- Consumes: The overlay geometry currently shared by Smart HTML and Template V2 Konva.
- Produces: `HtmlSelectionOverlay` and `HtmlSelectionRect` used only by Template V2; identical visual/interaction behavior.

- [ ] **Step 1: Add a failing neutral-name test**

```javascript
test("template v2 keeps the shared selection overlay under a neutral name", () => {
  assert.equal(existsSync(new URL("../app/(presentation-generator)/components/SmartHtmlSelectionOverlay.tsx", import.meta.url)), false);
  assert.equal(existsSync(new URL("../app/(presentation-generator)/components/HtmlSelectionOverlay.tsx", import.meta.url)), true);
  const overlays = read("components/slide-editor/surface/TemplateV2KonvaOverlays.tsx");
  assert.match(overlays, /HtmlSelectionOverlay/);
  assert.doesNotMatch(overlays, /SmartHtmlSelectionOverlay|SmartSelectionRect/);
});
```

Run and expect FAIL.

- [ ] **Step 2: Rename the shared component and exported type**

Rename with `apply_patch` semantics and change exports to:

```typescript
export type HtmlSelectionRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export default function HtmlSelectionOverlay(/* existing props */) {
  // Preserve the existing implementation.
}
```

- [ ] **Step 3: Update Template V2 imports and Cypress coverage**

Update all three Konva surface files to `HtmlSelectionOverlay`/`HtmlSelectionRect`. Rename the Cypress file and its describe block while preserving all geometry and visibility assertions.

- [ ] **Step 4: Run the shared-overlay and Template V2 tests**

```powershell
cd D:\work\Gapo\gslide-gitlab\gslide-web
npx cypress run --component --spec components/HtmlSelectionOverlay.cy.tsx
node --test tests/retired-smart-community.test.mjs tests/template-v2-text-fit.test.mjs
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit the neutral rename**

```powershell
git -C D:\work\Gapo\gslide-gitlab\gslide-web add -- 'app/(presentation-generator)/components/HtmlSelectionOverlay.tsx' 'app/(presentation-generator)/components/SmartHtmlSelectionOverlay.tsx' components/HtmlSelectionOverlay.cy.tsx components/SmartHtmlSelectionOverlay.cy.tsx components/slide-editor/surface/TemplateV2KonvaOverlays.tsx components/slide-editor/surface/TemplateV2KonvaSlide.tsx components/slide-editor/surface/TemplateV2KonvaStage.tsx tests/retired-smart-community.test.mjs
git -C D:\work\Gapo\gslide-gitlab\gslide-web commit -m "refactor: rename shared html selection overlay"
```

### Task 12: Remove retired copy, generated contracts, and stale tests

**Files:**
- Modify: `gslide-web/i18n/locales/en.ts`
- Modify: `gslide-web/i18n/locales/vi.ts`
- Modify: `gslide-web/i18n/backend-messages.ts`
- Modify: `gslide-web/components/runtime/TailwindBrowserRuntime.tsx`
- Modify: `gslide-web/utils/api.ts`
- Modify: `gslide-web/eslint.config.mjs`
- Modify: `gslide-web/tests/gslide-ui-kit.test.mjs`
- Modify: `gslide-web/tests/gslide-internal-rename.test.mjs`
- Modify: `gslide-web/tests/studio-chrome-kit.test.mjs`
- Modify: `gslide-api/servers/fastapi/tests/unit/test_image_search_downloader.py`
- Modify: `gslide-api/servers/fastapi/tests/unit/test_image_search_lifecycle.py`
- Modify: `gslide-api/servers/fastapi/tests/unit/test_small_surfaces_coverage.py`
- Modify: `gslide-api/servers/fastapi/openai_spec.json`
- Preserve unchanged: `gslide-api/servers/fastapi/NOTICE`
- Preserve unchanged: `gslide-api/servers/fastapi/uv.lock`

**Interfaces:**
- Consumes: Runtime removals from Tasks 2–10.
- Produces: Localization, static tests, OpenAPI, lockfiles, and notices that describe only shipped Standard functionality.

- [ ] **Step 1: Add final forbidden-contract assertions**

Extend the web retirement test to scan runtime/config sources while excluding docs and historical backup/migrations:

```javascript
for (const path of [
  "i18n/locales/en.ts",
  "i18n/locales/vi.ts",
  "i18n/backend-messages.ts",
]) {
  assert.doesNotMatch(read(path), /community|smart mode|reading_smart_deck_context/i);
}
```

Extend the backend contract test:

```python
def test_openapi_contains_no_retired_symbols():
    serialized = str(app.openapi()).lower()
    for retired in ("community_design_ids", "generation_mode", "html_content", "smart presentation"):
        assert retired not in serialized
```

- [ ] **Step 2: Remove retired localization keys and static source assertions**

Remove Community navigation/filter/preview copy, upload mode copy, Smart generation statuses, Smart HTML errors, and the Smart chat trace translation. Remove deleted Smart/Community files from the ESLint allowlist. Remove `/community` from `TailwindBrowserRuntime` deferral logic and make the remote-asset comment in `utils/api.ts` feature-neutral. Update static UI-kit/internal-rename/studio tests so they no longer require deleted files or symbols. Remove Smart-only expectations/comments from the three backend coverage tests while preserving their Standard image-search assertions. Preserve generic “smart” words that refer to unrelated copy only after verifying their context.

- [ ] **Step 3: Regenerate OpenAPI from the FastAPI app**

Use the repository's existing OpenAPI generation command if one is found with:

```powershell
rg -n -S "openai_spec.json|openapi\(\)" scripts servers package.json
```

If no script exists, run this explicit command from `servers/fastapi`:

```powershell
uv run --locked python -c "import json; from server import app; open('openai_spec.json','w',encoding='utf-8').write(json.dumps(app.openapi(), ensure_ascii=False, separators=(',', ':')))"
```

Then assert the generated file has no Community, mode-switch, edit-html, mode fields, or `html_content`.

- [ ] **Step 4: Prove dependencies before changing lockfiles/notices**

Run:

```powershell
cd D:\work\Gapo\gslide-gitlab\gslide-api
rg -n -S "import aiohttp|from aiohttp" servers/fastapi --glob '!**/services/community_presentations.py'
```

Expected: many remaining `aiohttp` consumers, so keep `aiohttp`, its lock entries, and its notice. Remove lockfile/NOTICE entries only for a package with zero remaining runtime imports and a direct Smart-only provenance. Do not churn `uv.lock` merely because Smart code was deleted.

- [ ] **Step 5: Run focused cleanup tests**

```powershell
cd D:\work\Gapo\gslide-gitlab\gslide-web
node --test tests/retired-smart-community.test.mjs tests/gslide-ui-kit.test.mjs tests/gslide-internal-rename.test.mjs tests/studio-chrome-kit.test.mjs tests/ci-enforcement-pr6.test.mjs

cd D:\work\Gapo\gslide-gitlab\gslide-api\servers\fastapi
uv run --locked pytest tests/unit/test_retired_smart_community_contract.py -q
```

Expected: PASS.

- [ ] **Step 6: Commit generated/copy cleanup without dirty-path leakage**

Commit clean paths separately in their owning repositories. Do not stage `tests/studio-chrome-kit.test.mjs` if it was dirty in Task 1.

### Task 13: Full verification, source audit, and deployment handoff

**Files:**
- Modify: `D:\work\Gapo\gslide-gitlab\smart mode and community backup\manifest.md`
- No runtime source changes unless a verification failure directly identifies an omission from Tasks 2–12.

**Interfaces:**
- Consumes: Completed API, migration, web, tests, and immutable archive.
- Produces: Evidence that Standard works, retired capabilities are absent, archive hashes remain valid, and deployment conditions are explicit.

- [ ] **Step 1: Run the complete backend quality gate**

```powershell
cd D:\work\Gapo\gslide-gitlab\gslide-api
npm run check:fastapi
```

Expected: ruff, pyright, vulture, deptry, and the full FastAPI suite all PASS.

- [ ] **Step 2: Run the complete frontend quality gate**

```powershell
cd D:\work\Gapo\gslide-gitlab\gslide-web
npm run check
npm run build
```

Expected: Node tests, i18n check, ESLint, TypeScript, dead-code analysis, and production build all PASS.

- [ ] **Step 3: Run the component regressions**

```powershell
cd D:\work\Gapo\gslide-gitlab\gslide-web
npx cypress run --component
```

Expected: all component tests PASS, including prompt rewrite/autoresize, document-aware rewrite, web-search toggle, HTML selection overlay, and Template V2 surfaces.

- [ ] **Step 4: Audit runtime source for retired symbols**

```powershell
cd D:\work\Gapo\gslide-gitlab
rg -n -i -S "smart mode|smart_mode|smartMode|generation_mode|community_design_ids|communityEnabled|html_content|slide_html|SmartHtml" gslide-web gslide-api --glob '!**/docs/**' --glob '!**/tests/**' --glob '!**/alembic/versions/f3a7c1d9e5b2_add_smart_generation_fields.py' --glob '!**/alembic/versions/d2f4a6b8c0e1_backfill_smart_presentation_mode.py' --glob '!**/alembic/versions/a4e8c2d6f0b1_remove_smart_community_fields.py' --glob '!**/migrations.py'
```

Expected: no runtime matches. Separately inspect `migrations.py`, the three allowed Alembic revisions, and absence tests; they may name retired schema only to upgrade or prove removal. Review plain `community` and generic `smart` matches individually; allow only unrelated terminology, historical legal text, or the approved documents.

- [ ] **Step 5: Verify removed routes from the generated schema**

Load `servers/fastapi/openai_spec.json` and prove these paths are absent:

```text
/api/v1/ppt/community/presentations
/api/v1/ppt/community/presentations/{community_id}
/api/v1/ppt/presentation/{id}/mode
/api/v1/ppt/slide/edit-html
```

Also prove Standard create, outline, presentation stream, slide edit, chat, duplicate, and export paths remain.

- [ ] **Step 6: Revalidate the archive and finalize the manifest**

Re-hash every archived file and compare it with the SHA-256 captured in Task 1. Add:

```markdown
## Completion verification

- Archive hashes revalidated: PASS
- gslide-api check: PASS
- gslide-web check/build: PASS
- Cypress component suite: PASS
- Runtime retired-symbol audit: PASS
- gslide-inf changed: NO
```

- [ ] **Step 7: Review Git state without absorbing user changes**

```powershell
git -C D:\work\Gapo\gslide-gitlab\gslide-api status --short
git -C D:\work\Gapo\gslide-gitlab\gslide-web status --short
git -C D:\work\Gapo\gslide-gitlab\gslide-web diff --check
git -C D:\work\Gapo\gslide-gitlab\gslide-api diff --check
```

Expected: API contains only intentional committed work; web may still show the initial dirty paths plus narrowly applied Smart/Community removals on those paths. No unrelated path is staged or altered.

- [ ] **Step 8: Record deployment requirements in the handoff**

The final handoff must state:

```text
1. Stop every old API instance.
2. Run Alembic upgrade to a4e8c2d6f0b1.
3. Start the new API.
4. Deploy the new web.
5. Smoke-test upload → rewrite → create → outline → stream → edit → save → export.
6. Confirm the four retired routes return 404.
```

Do not run production deployment or production migration from this implementation session unless the user separately authorizes that external state change.
