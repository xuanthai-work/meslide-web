# Smart Mode and Community Removal Design

**Date:** 2026-09-22

**Status:** Approved conversational design; implementation pending

**Repositories:** `gslide-web`, `gslide-api`

**Archive location:** `D:\work\Gapo\gslide-gitlab\smart mode and community backup`

## Context

Smart Mode and Community are already disabled in the active product flow through feature flags. The current user-visible path is Standard generation, but both repositories still contain Smart/Community UI, request fields, API routes, streaming branches, HTML-slide editing code, database columns, configuration, and tests.

The goal is to remove those capabilities completely from runtime source while preserving a source-only recovery archive outside the application repositories. The user has confirmed that no Smart decks remain in the database, so existing user data does not need to be migrated or retained.

## Goals

- Remove all Smart Mode and Community UI and runtime behavior.
- Remove their frontend and backend APIs and data contracts.
- Make Standard generation the only presentation-generation path.
- Remove Smart/Community database columns after verifying that no Smart/HTML decks remain.
- Preserve the pre-removal source in a path-preserving archive.
- Keep Standard and Template V2 flows behaviorally unchanged.

## Non-goals

- The archive will not be a runnable standalone project.
- No compatibility renderer or read-only access will remain for old Smart decks.
- No migration of Smart decks to Standard is required.
- `gslide-inf` will not be changed unless implementation discovers a concrete Smart/Community dependency; the initial audit found none.
- Generic uses of the word “smart” that are unrelated to Smart Mode are not removal targets.

## Chosen Approach

Perform a coordinated hard removal in one product release:

1. Capture all affected source in an external archive.
2. Remove Smart/Community frontend code and contracts.
3. Remove Smart/Community backend routes, services, streaming branches, models, and contracts.
4. Add a forward database migration that validates the no-Smart-data precondition and drops obsolete columns.
5. Deploy without leaving old API instances running against the contracted schema.

This is preferred over feature-flag-only removal or legacy read compatibility because those approaches leave the retired feature in runtime code and continue its maintenance burden.

## Source Archive

The archive will use this structure:

```text
smart mode and community backup/
├── README.md
├── manifest.md
├── gslide-web/
│   └── <original relative paths>
└── gslide-api/
    └── <original relative paths>
```

Archive rules:

- Capture the current working-tree version before editing, not only `HEAD`, so existing uncommitted work is preserved.
- Copy fully removed files at their original relative paths.
- For mixed files, copy the complete pre-removal file at its original relative path.
- Record repository commit IDs, capture time, affected-file list, and removal category in `manifest.md`.
- Add a README explaining that the archive is recovery material only and must not be imported, built, deployed, or added to either application repository.
- Do not modify archived copies after source removal begins.

## Frontend Design

### Upload and generation

- Remove the generation-mode type, dialog, selector, and Smart mode state.
- Remove Community reference selection and `communityId` query handling.
- Ignore legacy `mode=smart` and `communityId` upload query parameters by treating the page as a normal Standard upload.
- Remove `generation_mode` and `community_design_ids` from the create request and persisted client state.
- Keep document upload, document-aware prompt rewrite, outline generation, slide generation, retry, and Standard Template V2 behavior unchanged.

### Navigation and pages

- Remove the Community dashboard route and components.
- Remove Community navigation from the sidebar.
- A request to the removed `/community` route will resolve as a normal Next.js 404.

### Presentation and rendering

- Remove Smart routing and mode-specific presentation state.
- Remove the Smart HTML slide renderer/editor, Smart selection overlays, chart injection, and Smart-only export/thumbnail branches when they are not used by Standard or Template V2.
- Remove the Smart HTML stream event handling and completion fallback.
- Keep Template V2 rendering through its separate renderer and layout pipeline.
- Remove Smart-only slide edit clients and types, including `html_content`.

### Flags, assets, and localization

- Remove `smartModeEnabled` and `communityEnabled` from feature flags and environment configuration.
- Preserve unrelated flags, including `documentAwareRewrite`.
- Remove Smart/Community translations, video assets, tests, and configuration entries.

## Backend Design

### Routing and services

- Remove the Community router and Presenton Community proxy service.
- Remove Community reference normalization and prompt-context construction.
- Remove the presentation mode-switch endpoint.
- Remove the Smart presentation streaming module and Smart generator.
- Collapse the presentation stream endpoint to its existing Standard path.
- Remove the Smart HTML slide-edit endpoint and supporting Smart-only image/HTML helpers.
- Remove obsolete environment variables, generated OpenAPI entries, tests, and dependencies that have no remaining callers.

### Request and response contracts

- Stop accepting `generation_mode` and `community_design_ids` when creating a presentation.
- Stop returning `generation_mode`, the Smart/Standard `type` alias, and `community_design_ids`.
- Remove `html_content` from slide models and API responses.
- Keep `PresentationVersion` (`v1-standard` and `v2-standard`) because it represents the supported Standard rendering generations, not Smart Mode.

### Standard behavior

The supported server flow remains:

```text
create Standard presentation
→ create/update outline
→ prepare Standard layout/template
→ stream Standard slides
→ edit/save/export
```

Errors and retry semantics for outline and Standard slide generation remain unchanged.

## Database Design

Create a new Alembic revision after the current head. Do not edit or delete the historical revisions that originally added and backfilled Smart fields, because deployed databases and fresh database creation depend on the immutable revision chain.

The new upgrade migration will:

1. Inspect the relevant tables and columns so it works with the repository's supported database/test setup.
2. Assert that there are no presentations with `generation_mode = 'smart'`.
3. Assert that there are no slides with non-empty `html_content`.
4. Abort with a clear diagnostic if either precondition fails; it will not silently delete user data.
5. Drop `presentations.community_design_ids`.
6. Drop `presentations.generation_mode`.
7. Drop `slides.html_content`.

The downgrade will restore the three nullable/defaulted schema fields but cannot recreate removed Smart source behavior. No user rows are expected to be deleted by this migration.

## Compatibility and Deployment

The web and API contract changes are coordinated. Runtime compatibility with Smart clients or direct callers is not retained:

- Removed Community and mode-switch endpoints return 404.
- Legacy upload query parameters are harmlessly ignored by the new web client.
- Smart request/response fields are no longer part of the supported contract.

Because the migration drops columns still referenced by the old backend model, old API processes must not remain active after the migration. Deployment order:

1. Create and verify the source archive.
2. Stop all old API instances.
3. Run the new migration.
4. Start the new API version.
5. Deploy the new web version.
6. Run Standard smoke tests and verify removed routes.

For rolling infrastructure, scale the old API deployment to zero or use an equivalent maintenance window before applying the contract migration.

## Verification Strategy

### Frontend

- Typecheck/lint/build checks used by `gslide-web`.
- Unit tests for upload, rewrite, create request shape, presentation loading, streaming, retry, editing, saving, duplication, and export.
- Component/Cypress coverage for prompt rewrite with and without supporting documents.
- Standard Template V2 rendering and editing regression tests.
- Assertions that Community navigation and Smart controls are absent.
- Assertions that legacy Smart query parameters enter the Standard flow.

### Backend

- API tests for create, outline generation, Standard stream, retry/disconnect behavior, update, duplicate, and export.
- Contract tests proving Smart/Community fields and routes are absent.
- Migration tests for a clean upgrade, precondition failure, and schema-restoring downgrade.
- OpenAPI regeneration/check after route and model removal.

### Repository audit

- Search both runtime trees for Smart Mode and Community symbols after removal.
- Permit matches only in immutable historical migrations, the approved design/implementation documents, and unrelated generic terminology verified case by case.
- Verify `gslide-inf` remains unchanged unless a real dependency is discovered.
- Verify the backup manifest matches the archived file tree.

## Acceptance Criteria

- The active UI contains no Smart Mode or Community affordance.
- The active web bundle contains no Smart/Community route, API client, mode selection, or Smart HTML editor/renderer.
- The backend exposes no Community, mode-switch, Smart stream/generator, or Smart HTML edit endpoint.
- Runtime request/response models and database models contain no Smart/Community fields.
- The database migration refuses unexpected Smart/HTML data and drops all three obsolete columns on a clean database.
- Existing Standard and Template V2 workflows pass their regression suites.
- The external backup exists with complete pre-removal files and a usable manifest.
- Historical Alembic revisions remain intact.

## Known Risks and Mitigations

- **Shared-code removal:** Some Smart-named frontend components touch generic editor concerns. Remove by call path and data dependency, not by filename alone; preserve Template V2 components and verify them explicitly.
- **Dirty working tree:** Existing user changes overlap upload files. Archive current copies first, patch narrowly, and never reset or overwrite unrelated edits.
- **Schema/runtime mismatch:** Stop old API instances before migration and deploy the new API immediately after it.
- **Unexpected data:** Migration preconditions fail closed instead of deleting rows.
- **Generated artifacts:** Regenerate or update OpenAPI and derived tests so removed endpoints do not survive in checked-in artifacts.
