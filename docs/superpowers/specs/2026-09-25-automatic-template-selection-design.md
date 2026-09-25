# Automatic Template Selection from the Final Prompt

## Intent

When a user creates a presentation without pressing **Dùng mẫu này** in the upload template picker, select an available built-in template from the final presentation prompt. The final prompt is the rewritten brief as it exists when the user presses **Tạo**, including any edits made after the rewrite. A confirmed manual choice always wins.

Success means an unconfirmed template preview never counts as a user choice, automatic generation receives one valid template ID, and selection failures do not prevent presentation creation when a built-in template is available. No new UI surface is introduced.

## Current Flow and Constraint

`UploadTemplatePicker` loads all pages of built-in template summaries, automatically places the first template in `selectedTemplateId`, and shows it as selected. `UploadPage` requires that ID before Create, then embeds it in `/presentation?id=<id>&auto=1&template=<id>`. `useAutomaticPresentationGeneration` needs the URL template ID before it starts the outline and slide pipeline.

The rewrite response is editable. The rewrite API cannot make a lasting template choice because the user may edit the resulting brief before Create. The upload flow also permits document-only creation with no rewritten prompt.

## Chosen Approach

Add a separate template recommendation call at Create time. The upload page keeps preview state separate from an explicitly confirmed template ID. The recommendation API receives the final prompt and the IDs of built-in templates currently available to the picker. It looks up the allowed templates on the server, sends their ID, name, and description to the configured LLM, and returns one allowed ID.

This reuses the backend's structured-output LLM path and avoids coupling template selection to rewrite timing. A keyword-only matcher would be cheaper but would not reliably interpret audience, purpose, and requested style. Extending `/prompt/rewrite` would reduce one call but could return a stale selection after a user edit.

Only default templates with at least one usable layout are candidates. Personal and custom templates are outside this feature, matching the current upload picker. The missing Editorial description in the bundled template metadata must be filled so every current candidate has useful selection context. Future built-in templates should provide a meaningful name and description; missing descriptions must not crash selection.

## Browser Flow

1. On load, the first built-in template may remain visible as a preview, but no template is marked as confirmed. Its rail check mark appears only after a user presses **Dùng mẫu này**. Browsing, hover, focus, rail clicks, carousel keys, opening the picker, and closing it do not confirm a template.
2. Pressing **Dùng mẫu này** stores that template ID as the explicit choice. If the available list changes and no longer contains it, clear the explicit choice. The picker remains usable for another choice.
3. Create keeps the existing rewrite-freshness, input, document, and template-availability checks. It captures the current final prompt and the current built-in template list once, then immediately enters a guarded loading state so keyboard and pointer submissions cannot start a second recommendation or creation request.
4. If an explicit choice exists in the captured list, use it without a recommendation request. Otherwise, if the final prompt is nonempty, call `POST /api/v1/ppt/prompt/select-template`. For document-only creation with no final prompt, use the deterministic fallback directly.
5. Pass the resolved template ID explicitly through both direct and document creation paths and into the presentation URL. Do not read a potentially stale `selectedTemplateId` closure after the asynchronous recommendation call. The final prompt captured at Create remains the presentation content even if the input changes while Create is running.

Create stays disabled while templates load or when the list is empty or failed, as it does today. The existing retry control continues to recover that condition. The recommendation adds no new picker, status panel, or user action.

## API Contract

`POST /api/v1/ppt/prompt/select-template`

Request:

```json
{
  "prompt": "Final rewritten presentation brief, including user edits",
  "candidate_ids": ["id-of-built-in-template-1", "id-of-built-in-template-2"]
}
```

Response:

```json
{ "template_id": "id-of-built-in-template-2" }
```

The endpoint accepts a nonblank prompt and a nonempty, deduplicated ID list. It re-queries the database and intersects the IDs with currently available default templates that have layouts, preserving the order of `candidate_ids` for deterministic fallback. It never trusts client-provided names, descriptions, or default flags. If no eligible candidate remains, it returns a coded client error. Request validation bounds the prompt to 8,000 characters; an overlong edited prompt causes the browser to use the fallback and must not block presentation creation.

The LLM receives the final prompt as untrusted data plus the server-sourced candidate metadata. It chooses by presentation audience, objective, structure, and any explicit visual direction in the prompt, and returns only a `template_id` through the existing structured-output helper. The server validates membership in the eligible ID set. An unknown, malformed, or empty model result is treated as a recommendation failure, never as an arbitrary template ID.

The endpoint is read-only and creates no presentation or template record. It does not modify `/prompt/rewrite`, `/presentation/create`, or the automatic-generation URL contract.

## Fallback and Failure Handling

The fallback is the available built-in template whose name is `General` (case-insensitive), or the first available template in the picker's existing order if General is absent. Both server and browser use this rule over their eligible candidate lists; the server preserves request candidate order rather than database row order.

- Invalid or empty model output and provider failures: the endpoint logs the failure and returns the fallback eligible ID.
- Recommendation transport error, timeout, validation error, or unavailable endpoint: the browser uses its fallback from the captured template list and continues Create.
- Document-only creation with no final prompt: skip the recommendation request and use the fallback.
- No available built-in template: keep Create disabled and preserve the existing load/empty retry behavior; there is no ID to fall back to.
- Explicit manual selection: skip the LLM even when the final prompt suggests another style. If the confirmed ID disappears from the available list, clear confirmation and follow the automatic path.
- Repeated Create input: one in-flight operation may resolve a template and create a presentation; subsequent submissions are ignored until completion or recoverable failure.

The chosen ID must be resolved before creating the presentation record, so selection failure cannot leave an extra presentation record behind. Existing creation errors retain their current user-facing handling.

## Ownership and Likely Files

- `gslide-web/app/(presentation-generator)/upload/components/UploadTemplatePicker.tsx`: distinguish preview from confirmation and control the rail check mark.
- `gslide-web/app/(presentation-generator)/upload/components/UploadPage.tsx`: snapshot inputs, gate duplicate Create, resolve the template, and pass the resolved ID to both generation paths.
- `gslide-web/app/(presentation-generator)/services/api/presentation-generation.ts`: typed recommendation client call.
- `gslide-api/servers/fastapi/api/v1/ppt/endpoints/prompt.py` and a focused request/response model: expose the recommendation contract.
- `gslide-api/servers/fastapi/utils/llm_calls/`: focused built-in template selector using the shared structured-output helper.
- `gslide-api/templates/editorial/template.json`: supply the missing description.

The frontend and backend are separate Git repositories under the shared workspace. The implementation plan must verify both halves together before rollout.

## Verification

- Browser component tests: first template is a preview with no confirmation check; every preview-only interaction leaves automatic selection active; pressing **Dùng mẫu này**, including on the first template, bypasses the recommendation request.
- Browser component tests: the recommendation receives the edited final prompt, its returned ID reaches `/presentation`, direct and document creation use the same resolved ID, and document-only creation uses the fallback without a recommendation request.
- Browser component tests: invalid/failed recommendation uses General or first available, empty/failed template loading still blocks Create, and rapid duplicate Create actions yield one recommendation and one presentation creation.
- Backend tests with a mocked LLM: candidate metadata comes from persisted default templates with layouts; custom, missing, and layoutless IDs are excluded; valid structured output is accepted; invalid output and provider failure select the fallback; no eligible candidates return the coded error.
- Run the affected web component/API tests, web typecheck, and backend unit tests. Check that manual selection and the existing presentation bootstrap still work.

## Non-goals

- Showing the automatic recommendation or its rationale before Create.
- Selecting custom templates or learning from previous user choices.
- Changing prompt rewrite, document extraction, outline generation, or slide rendering.
- Guaranteeing a single objectively correct template for every prompt; the model selects from available candidates with deterministic recovery on failure.
