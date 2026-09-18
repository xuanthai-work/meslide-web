# Image-search insertion points — Standard & Smart call graphs

- Date: 2026-09-08
- Locked by: Phase 0 of
  `superpowers/plans/gslide-searxng-image-search-plan.md`
- All backend paths relative to `gslide-api/servers/fastapi/`

## 1. Standard structured-output image slots

- Slot keys (discovery): `utils/process_slides.py:19-21` —
  `IMAGE_PROMPT_KEYS = ("__image_prompt__", "image_prompt", "prompt")`,
  `ICON_QUERY_KEYS = ("__icon_query__", "icon_query", "query")`.
  Note the generic `prompt`/`query` fallbacks: `image_query` must NOT collide
  with them (a dict holding `image_query` must not be read as an icon slot).
- Schema generation: `templates/v2/schema.py` — `_content_schema_for_element`
  (~L207) and `_component_content_field_schema` (~L953) emit
  `{"image_prompt": string}` / `{"icon_query": string}` per image/icon
  element. **Insertion point A:** add optional `image_query` beside
  `image_prompt` here.
- Slide-content LLM: `utils/llm_calls/generate_slide_content.py` —
  `_prepare_response_schema` strips asset-only fields and injects speaker
  note; system prompt embeds schema markdown (L140-142); icon/image prompt
  language pinned to English (L75-76). **Insertion point B:** when
  `web_search=true`, prompt instruction to produce a concise `image_query` per
  image slot.
- Asset hydration reads both keys: `templates/v2/content.py`
  `template_asset_prompt` (~L62) and `api/v1/ppt/endpoints/presentation.py`
  `_apply_template_image_content` (~L766).

## 2. Standard resolution boundary — `utils/process_slides.py`

`process_slide_and_fetch_assets()` (L95-204) per slide:

1. discovers image + icon slots (`_asset_dicts_with_prompt`);
2. **outline URL priority** (L112-128): `outline_image_urls[i]` written
   directly via `_set_asset_url`, generation skipped — must stay first;
3. otherwise queues `image_generation_service.generate_image(ImagePrompt(...))`
   (L130-135). **Insertion point C — the single branch:** when
   `presentation.web_search` and rollout flag on → queue
   `image_search_service.search_and_import(image_query)` instead. No
   cross-fallback on failure: placeholder + warning, never paid generation;
4. `asyncio.gather(..., return_exceptions=allow_image_fallback)` (L146-150);
5. write-back mutates `slide.content` via `set_dict_at_path`; `ImageAsset` →
   local `/app_data/...` URL (`filesystem_image_path_to_app_data_url`);
   exception w/ fallback → `/static/images/placeholder.jpg` +
   `image_generation_warning(result)` into `image_warnings`;
6. returns new `ImageAsset` rows; **no DB session touched here** — callers
   own persistence.

`process_old_and_new_slides_and_fetch_assets()` (L207-330): same discovery
+ prompt-to-URL reuse of unchanged prompts (L226-259) — used by slide edit and
chat slide replacement; must get the same search branch.

Callers and where `presentation.web_search` is in scope:

| Caller | Location | web_search available |
| --- | --- | --- |
| Standard stream (`stream_presentation`, `?regenerate=true`) | `api/v1/ppt/endpoints/presentation.py:2131-2143` | yes (`presentation` from L1977) |
| Legacy `/generate` (+async) handler | same file L2853-2860 | yes (`request.web_search`; row now persists it) |
| Slide edit `/slide/edit` | `api/v1/ppt/endpoints/slide.py:77-88` | yes (L41) |
| Chat `saveSlide`/`addNewSlide` | `services/chat/memory_layer.py:1033-1045, 1121-1127` | yes (L985) |

Persistence at each site: stream → `add_all(generated_assets)` + single
commit (L2216-2227); handler → L2893-2896; slide edit → L100-105;
chat → L1065-1067 / L1140-1142. Searched assets must ride these same
transactions.

## 3. Standard SSE events

- `slide_assets` payload `{"type","slide_index","slide","warnings"}` emitted
  at L2162-2172 (opportunistic) and L2186-2196 (drain); slide `ui` rehydrated
  via `_apply_template_content_to_ui` before each emission.
- Warnings list per slide: dicts from `image_generation_warning()`
  (`utils/image_generation_error.py:99-117`) or
  `{"type": "asset_generation_failed", ...}` — image-search warnings must use
  the same channel/shape (coded, localized in Phase 7).
- Frontend consumer: `gslide-web/.../hooks/usePresentationStreaming.ts:537-580`
  merges via `mergeSingleSlidePreservingResolvedAssets` (placeholder URLs
  never overwrite resolved ones) and toasts deduped warnings.

## 4. Standard cancellation

- Stream loop: `request.is_disconnected()` → `asyncio.CancelledError` before
  each slide (presentation.py L2077-2085); checker also passed into slide
  content LLM call. Pending asset tasks gathered with
  `return_exceptions=True` at L2198-2210 → a search/import in flight must
  respect CancelledError and clean up partial files.
- `safe_sse_stream` (`utils/sse.py:28-103`): CancelledError = clean stop,
  no error frame; other exceptions → error frame + `rollback_stream_session`.

## 5. Smart flow — `_stream_smart_presentation()` (L1694-1967)

- Today: **no `slide_assets` event, no asset pipeline, no `ImageAsset` rows**
  in smart mode; slides stored as `html_content` only.
- Text web search (external SearXNG only) at L1759-1771, gated on
  `presentation.web_search` — the image branch reuses the same flag.
- Event order: statuses → fonts → `slide_html` per streamed slide (L1887-1898)
  → final missing `slide_html` (L1919-1930) → single commit L1937-1945
  (delete old slides, add presentation+slides) → `complete`.
- Cancellation: event-pump loop polls `request.is_disconnected()` every
  iteration (L1860-1866) and cancels `generation_task` in `finally`
  (L1900-1903). **Insertion point D:** smart asset tasks must be registered
  with the pump so disconnect cancels them before any commit; commit only
  after awaiting/cancelling all asset tasks.
- Sanitization (`generate_smart_presentation.py`): `normalize_smart_slide_html`
  (~L409-427) strips unsafe tags/scripts/`on*=`/`javascript:` URLs —
  **`<img>` and `data-*` attributes survive**, so `data-image-query` slots
  are representable; re-run sanitization after URL replacement and strip
  `data-image-query` before persistence.
- Prompt: `SMART_DIRECT_HTML_PROMPT` (~L159-202); image instructions live in
  `SMART_VISUAL_EVIDENCE_PROMPT` (~L102-140). **Insertion point E:** when
  web_search=true, instruct placeholder `<img src="/static/images/placeholder.jpg" data-image-query="..." alt="...">`, forbid invented remote URLs.

## 6. Flag plumbing pattern (for `WEB_IMAGE_SEARCH_ENABLED`)

Follow the WEB_GROUNDING pattern: getter in `utils/get_env.py`
(`overlay_or_env`), explicit overlay-eligibility decision in
`utils/provider_overlay.py:19-41`, setter in `utils/set_env.py`,
`UserConfig` field in `models/user_config.py` + `models/user_config_model.py`.
`SEARXNG_BASE_URL` stays env-only (get_env.py:128-129) — image search
availability = `WEB_IMAGE_SEARCH_ENABLED` AND `SEARXNG_BASE_URL`.

## 7. Known gaps found during mapping (fixed / to watch)

1. **FIXED in Phase 0:** legacy `/generate` handler constructed
   `PresentationModel` without `web_search` (dropped the user's choice);
   now persists `web_search=request.web_search`.
2. `SEARXNG_BASE_URL` is env-only and not overlay-eligible — keep it that
   way for the image-search availability check.
3. Generic slot keys `prompt`/`query` in discovery tolerate sloppy templates;
   `image_query` integration must extend `IMAGE_PROMPT_KEYS`-based discovery
   without matching `query` (icon) slots.
