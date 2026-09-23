# Test Suite Cleanup Implementation Plan

> **For agentic workers:** Execute this plan only after the active stop/retry agent has finished and its changes are no longer being edited concurrently. Work in an isolated worktree if necessary. Run targeted checks after each group and final checks at the end; this plan does not require intermediate commits.

**Goal:** Reduce test maintenance and runtime by removing permanent skips, unsupported legacy compatibility tests, retired-feature tombstones, and duplicate contracts while preserving coverage for active behavior, security, ownership, and the currently supported database lifecycle.

**Architecture:** Use a risk-based test pyramid. Pure logic belongs in direct unit tests, API behavior belongs in one boundary-level contract test, and browser tests remain only for interaction behavior that cannot be proved below the browser. Tests must assert observable behavior rather than source-code spelling or the absence of long-retired symbols.

**Tech Stack:** Node 22 test runner, TypeScript, Cypress component tests, pytest, FastAPI TestClient, SQLAlchemy/Alembic, ESLint, TypeScript, Knip.

---

## Spec

Keep tests that protect:

- Features that are currently available to users.
- Authentication, authorization, ownership boundaries, path traversal, and cross-user access.
- Fresh database creation and the migration path the product currently supports.
- Data-loss prevention and retry/resume behavior.
- Public API contracts used by the current web client.

Remove or consolidate tests that only protect:

- Database layouts and clients that are no longer supported.
- PostHog, Presenton Cloud, Smart/Community mode, manual outline UI, or other retired modules from returning.
- A module, route, field, or file remaining absent.
- Permanently skipped behavior.
- The same HTTP contract at both unit and integration level without different risk coverage.
- A specific implementation shape such as a function name, `.reduce()` call, import statement, or source-code regex.

This cleanup must not change production behavior. If a test deletion exposes production compatibility code that is also dead, record it for a separate production-code cleanup instead of mixing it into this branch.

## Global Constraints

- Do not edit files that the stop/retry agent is still changing. Preserve unrelated user edits in the shared worktree.
- Record baseline counts and runtimes before deletion. The current observed baseline is 1,330 passing backend tests, 2 skipped backend tests, and 32 frontend Node test files; remeasure after the feature agent finishes.
- A test may be deleted only when its behavior falls into one of the removal categories above or equivalent active coverage is identified by file and test name.
- Do not delete security or ownership coverage merely because it references a legacy path.
- Do not run the entire Cypress suite after every edit. Run the affected spec during development and the full suite once at the end.
- Keep the inventory current after each group so a reviewer can understand and restore disputed coverage. Commit only at the end if the user requests a commit; web and API are separate repositories.

## Review Focus

- Every deleted test has a written reason in the inventory: `retired`, `unsupported compatibility`, `permanent skip`, `duplicate`, or `implementation-coupled`.
- Current user-visible behavior remains covered at the lowest useful layer.
- Fresh database startup and current ownership constraints remain covered.
- CI configuration matches the final test commands.
- Final test runtime and counts are compared with the baseline.

### Task 1: Freeze the feature result and establish a clean baseline

**Files:**

- Create: `gslide-web/docs/testing/test-suite-inventory.md`
- Inspect: `gslide-web/tests/*.test.mjs`
- Inspect: `gslide-web/cypress/component/*`
- Inspect: `gslide-api/servers/fastapi/tests/**/*`

**Step 1: Verify isolation**

Run in both repositories:

```powershell
git status --short
```

Expected: the stop/retry agent has finished editing. Record unrelated user edits and leave them untouched. If feature changes are still active, wait or use an isolated worktree based on a stable revision.

**Step 2: Capture the frontend baseline**

Run from `gslide-web`:

```powershell
Measure-Command { npm test }
npm run check
Measure-Command { npx cypress run --component --browser electron }
```

Record pass/fail counts and elapsed times in `docs/testing/test-suite-inventory.md`. A failure introduced by the feature branch must be resolved in that feature branch before cleanup begins.

**Step 3: Capture the backend baseline**

Run from `gslide-api/servers/fastapi`:

```powershell
Measure-Command { python tests/run_suite.py -q -rs }
```

Record pass, skip, and runtime totals.

**Step 4: Build the inventory**

Give every test file one disposition and reason:

| Disposition | Meaning |
|---|---|
| Keep | Covers active behavior, security, ownership, or supported migration |
| Merge | Same contract is already tested at a more appropriate layer |
| Replace | Behavior matters, but the current test is coupled to source shape |
| Delete | Retired, unsupported, or permanently skipped |

For `Merge` and `Replace`, name the surviving test before deleting anything.

### Task 2: Remove permanent skips and duplicate removed-auth contracts

**Files:**

- Modify: `gslide-api/servers/fastapi/tests/unit/test_auth_bootstrap.py`
- Modify: `gslide-api/servers/fastapi/tests/integration/test_auth_endpoints.py`
- Modify or delete: `gslide-api/servers/fastapi/tests/unit/test_auth_endpoints_removed.py`

**Step 1: Remove the permanently skipped reset-auth test**

Delete `test_reset_auth_recovers_user_without_replacing_account`. Remove `json`, `stat`, `pytest`, or other imports only when they become unused. Keep `test_bootstrap_does_not_require_demo_password_or_replace_users`, which protects active account ownership.

**Step 2: Remove the permanently skipped duplicate-register test**

Delete `test_register_conflict_on_duplicate_username`; registration is already removed and the test can never exercise its old 201/409 contract.

**Step 3: Keep at most one 410 contract**

The current suite tests removed registration in both `test_auth_endpoints.py` and `test_auth_endpoints_removed.py`. If the 410 response is still consumed by the current client, keep only `test_removed_register_endpoint_returns_410` in the dedicated file and remove the misnamed `test_register_creates_normal_user_and_sets_cookie`. If no current client calls the route, remove both tombstone tests and record that decision as `unsupported client`.

Do not remove login, logout, cookie-security, access-key, or account-ownership tests in this task.

**Step 4: Verify no permanent skips remain**

```powershell
python -m pytest tests/unit/test_auth_bootstrap.py tests/integration/test_auth_endpoints.py tests/unit/test_auth_endpoints_removed.py -q -rs
rg -n "pytest\.mark\.skip|pytest\.skip|unittest\.skip" tests
```

Expected: targeted tests pass and the search reports no unexplained permanent skips.

### Task 3: Remove PostHog tombstone tests

**Files:**

- Delete: `gslide-web/tests/no-posthog-integration.test.mjs`
- Modify: `gslide-web/tests/ci-enforcement-pr6.test.mjs`
- Modify: `gslide-web/tests/standalone-compose.test.mjs`

**Step 1: Delete the dedicated absence suite**

Delete `no-posthog-integration.test.mjs`. It only verifies that removed files, dependencies, identifiers, and routes remain absent.

**Step 2: Remove duplicate PostHog absence assertions**

Remove only the `POSTHOG_` negative assertions from the CI and compose tests. Preserve their active deployment, lint, typecheck, build, network, and secret-boundary checks.

**Step 3: Verify**

```powershell
npm test
rg -n -i "posthog" tests
```

Expected: Node tests pass and no test exists solely to police the retired integration.

### Task 4: Remove retired feature and deleted-module tombstones

**Files:**

- Delete: `gslide-web/tests/retired-smart-community.test.mjs`
- Delete: `gslide-web/tests/outline-ui-removal.test.mjs`
- Delete: `gslide-api/servers/fastapi/tests/unit/test_retired_smart_community_contract.py`
- Delete or split: `gslide-api/servers/fastapi/tests/unit/test_cloud_removed.py`
- Inspect: `gslide-api/servers/fastapi/tests/unit/test_provider_settings.py`

**Step 1: Remove web absence tests**

Delete the Smart/Community and manual-outline removal suites. Current automatic generation and current navigation tests remain the source of truth.

**Step 2: Remove backend absence tests**

Delete `test_retired_smart_community_contract.py`; current presentation creation is already exercised in `tests/integration/test_presentation_generation_flow.py` and request-model tests.

For `test_cloud_removed.py`, delete module/file/router/source-absence checks. Move a provider-settings case into `test_provider_settings.py` only if it represents accepted current input. Since old Presenton Cloud clients and old saved settings are unsupported, do not retain sanitization tests solely for those old values.

**Step 3: Verify current contracts remain covered**

```powershell
python -m pytest tests/unit/test_provider_settings.py tests/integration/test_presentation_generation_flow.py -q
```

Run from `gslide-web`:

```powershell
npm test
```

### Task 5: Replace historical database compatibility tests with the supported migration contract

**Files:**

- Rewrite: `gslide-api/servers/fastapi/tests/unit/test_migrations.py`
- Keep: `gslide-api/servers/fastapi/tests/unit/test_database_startup.py`
- Keep: `gslide-api/servers/fastapi/tests/unit/test_database_lazy.py`
- Review and keep if current: `gslide-api/servers/fastapi/tests/unit/test_template_bundle_migration.py`
- Keep: `gslide-api/servers/fastapi/tests/unit/test_asset_ownership_security.py`

**Step 1: Encode the supported database boundary**

The supported contract is:

1. A fresh empty database can upgrade to Alembic `head`.
2. The resulting schema contains the tables and key ownership columns required by the current models.
3. Current runtime startup remains lazy and creates the intended current tables.
4. Ownership and cross-user access rules remain enforced.

Unversioned legacy databases, orphan revision IDs, duplicate historical columns, Smart/Community data, Presenton Cloud tables, and upgrades from retired intermediate revisions are outside support.

**Step 2: Replace historical fixtures**

Replace the large set of hand-built historical schemas in `test_migrations.py` with a small fresh-database migration test that:

- creates an empty SQLite database;
- runs `command.upgrade(config, "head")`;
- reads the `alembic_version` row;
- verifies representative current tables and ownership columns;
- fails if the migration chain cannot build a fresh current database.

Do not preserve tests named around `legacy_database`, `unversioned_database`, `removed_intermediate_revision`, old theme stamps, old template-v2 stamps, Smart-mode backfill, or leftover cloud-provider tables.

**Step 3: Retain narrowly current migration tests**

Keep `test_template_bundle_migration.py` only if template bundle columns are part of the currently supported deployment upgrade. If all deployed databases are already past that revision, replace it with assertions in the fresh-head test and delete the historical upgrade/downgrade fixtures.

**Step 4: Verify migration and ownership coverage**

```powershell
python -m pytest tests/unit/test_migrations.py tests/unit/test_database_startup.py tests/unit/test_database_lazy.py tests/unit/test_template_bundle_migration.py tests/unit/test_asset_ownership_security.py -q
```

Expected: fresh-head and ownership tests pass without constructing unsupported old schemas.

### Task 6: Replace implementation-coupled frontend tests with behavior tests

**Files:**

- Modify: `gslide-web/tests/generation-lifecycle.test.mjs`
- Create: `gslide-web/tests/stream-asset-merge.test.mjs`
- Test: `gslide-web/app/(presentation-generator)/presentation/utils/streamAssetMerge.ts`
- Review: every frontend test that uses `readFile`, `readFileSync`, or `existsSync`

**Step 1: Preserve pure lifecycle behavior**

Keep direct tests for `isUsefulStreamEvent`, `shouldSilentRetry`, `needsCancelConfirm`, `isStalled`, `silentRetryDelayMs`, and `shouldShowKeepWaiting`.

**Step 2: Remove source-shape assertions**

Delete tests that require the hooks to contain a particular import, function name, `.reduce()` call, Redux action spelling, or source substring. In particular, remove the assertion that retry preservation must call `normalizedPartialData.slides.reduce()` and `mergeSingleSlidePreservingResolvedAssets()`.

**Step 3: Test slide preservation directly**

Add direct tests for the exported functions in `streamAssetMerge.ts`:

- replaying saved slides preserves already resolved asset URLs;
- adding a later slide keeps earlier slides;
- replaying the same slide replaces generation data without duplicating it;
- empty incoming input leaves the current resolved slides intact where the helper contract requires it.

These tests must assert returned slide data, not the helper implementation.

**Step 4: Classify the remaining source-reading tests**

Keep source-reading tests only when the file itself is the public artifact, such as CI YAML, Docker Compose, localization files, or generated manifest contracts. For application behavior, replace the source check with a direct pure-function, API, or focused component test; otherwise delete it as implementation-coupled.

**Step 5: Verify**

```powershell
node --test tests/generation-lifecycle.test.mjs tests/stream-asset-merge.test.mjs
npm test
```

### Task 7: Consolidate duplicate API contracts

**Files:**

- Modify: `gslide-web/docs/testing/test-suite-inventory.md`
- Modify/delete: duplicate test files identified by the inventory

**Step 1: Apply one-owner rules**

Use one primary layer for each contract:

- Pure parsing, merging, limits, and state transitions: unit test.
- Request validation and HTTP status/body: one API boundary test.
- Database ownership and authorization: integration/security test.
- Visual interaction, focus, click, and toast persistence: component/browser test.

Two tests may remain only when they exercise materially different failure modes.

**Step 2: Remove duplicates in small batches**

Delete one contract group at a time. After each deletion, run the nearest surviving test file. Update the inventory with the surviving owner.

**Step 3: Verify both suites**

Run from `gslide-web`:

```powershell
npm test
```

Run from `gslide-api/servers/fastapi`:

```powershell
python tests/run_suite.py -q -rs
```

### Task 8: Keep Cypress focused and remove it from the inner development loop

**Files:**

- Review: `gslide-web/cypress/component/*`
- Modify if needed: `gslide-web/package.json`
- Modify if needed: `gslide-web/.github/workflows/test.yml`
- Modify if needed: `gslide-web/.gitlab-ci.yml`
- Modify if needed: `gslide-web/tests/ci-enforcement-pr6.test.mjs`
- Create: `gslide-web/docs/testing/manual-generation-smoke.md`

**Step 1: Keep only browser-specific active behavior**

Retain Cypress cases that prove click behavior, confirmation dialogs, toast actions, component wiring, or URL/router integration. Remove cases that duplicate pure functions, static copy, request serialization, or source checks.

For stop/retry, keep one focused browser path:

1. generation has produced several slides;
2. user presses Stop;
3. the saved draft remains visible;
4. Retry appears and opens a new stream;
5. saved slides are replayed without duplication;
6. later slides continue generating.

**Step 2: Add focused scripts**

Add scripts similar to:

```json
"test:cypress": "cypress run --component --browser electron",
"test:cypress:generation": "cypress run --component --browser electron --spec cypress/component/generation-status-toast.cy.tsx"
```

Feature work should run the focused spec during iteration. Run the full browser suite once before completion.

**Step 3: Use the measured runtime to choose CI placement**

- If the cleaned full Cypress suite completes in 5 minutes or less, keep it required in pull requests.
- If it takes more than 5 minutes, keep the specs but move the full command to a manual/nightly job; require the focused affected spec for stop/retry changes.

Do not delete all Cypress coverage based on an estimate. Browser startup and bundling may dominate runtime, so deleting a few specs may not make implementation loops materially faster.

**Step 4: Document the manual smoke test**

Create `manual-generation-smoke.md` with exact setup, expected status text, stop at slide 5 or 6, Retry action, retained slide count, continuation, and failure observations. This checklist supplements automation and is the fallback when a developer intentionally skips Cypress locally.

**Step 5: Update CI contract tests**

If Cypress moves out of the required PR workflow, update `ci-enforcement-pr6.test.mjs` so it asserts the new intended commands rather than the removed command.

### Task 9: Final verification and measured result

**Files:**

- Modify: `gslide-web/docs/testing/test-suite-inventory.md`

**Step 1: Run frontend gates**

```powershell
npm run check
npm run build
npm run test:cypress
```

If Task 8 moved full Cypress to manual/nightly, still run it once for this cleanup before claiming completion.

**Step 2: Run backend gates**

```powershell
python tests/run_suite.py -q -rs
```

Expected: zero unexplained skips and all retained tests pass.

**Step 3: Check for stale tests and artifacts**

```powershell
rg -n "pytest\.mark\.skip|pytest\.skip|describe\.skip|it\.skip|test\.skip" gslide-api/servers/fastapi/tests gslide-web/tests gslide-web/cypress
git status --short
```

Delete generated Cypress screenshots/videos from the working tree unless intentionally tracked.

**Step 4: Record the result**

Update the inventory with:

- test files and test cases before/after;
- frontend Node, Cypress, and backend runtime before/after;
- every deleted group and its surviving coverage;
- any production dead code deliberately deferred to another change.

**Step 5: Review the final diff**

Run `git diff --check` and `git status --short` separately in `gslide-web` and `gslide-api`. Compare the final diff against the inventory and keep any unrelated user edits out of the cleanup result. If the user asks for commits, make one cleanup commit in each affected repository after verification.
