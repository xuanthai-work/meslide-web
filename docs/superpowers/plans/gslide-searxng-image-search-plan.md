# GSlide Automatic Web Image Search Implementation Plan

- Related specification:
  `docs/superpowers/specs/gslide-searxng-image-search-spec.md`
- Date: 2026-09-08
- Implementation status: Implemented through Phase 9 verification; rollout remains gated off by default
- Scope: `gslide-api`, `gslide-web`, and `gslide-ops`

## 1. Delivery strategy

Implement automatic image search as the second branch of the existing
presentation Web Search feature. Keep text research and image acquisition
separate internally so either can fail without corrupting the other.

The critical path is:

```text
existing web_search flag
  -> generate image_query per image slot
  -> search SearXNG images
  -> safely download and persist ImageAsset
  -> update Standard JSON or Smart HTML
  -> stream asset result/warning
```

Do not begin with editor or chat UI. Prove the automatic backend path and export
stability first.

## 2. Phase 0 — Contract and fixture lock

### Tasks

- [ ] Capture sanitized JSON fixtures from the deployed SearXNG version for at
  least two enabled image engines.
- [ ] Record actual meanings of `img_src`, `thumbnail_src`, `url`, `title`,
  `engine`, `resolution`, `width`, and `height`.
- [ ] Define `ImageSearchCandidate` and service interfaces.
- [ ] Lock named constants for query length, results per query, candidates
  attempted, timeouts, redirects, maximum bytes, maximum pixels, concurrency,
  and cache TTL.
- [ ] Map the current Standard image-resolution call graph from presentation
  stream, regeneration, and chat into `process_slides.py`.
- [ ] Map the Smart `slide_html` and `slide_assets` event order and cancellation
  points.
- [ ] Add contract tests proving that `web_search` is persisted through create,
  prepare, regenerate, and duplicate flows.
- [ ] Add a guard test proving `searxng` is not an `ImageProvider` enum value.

### Exit criteria

- [ ] Real SearXNG fixtures and typed models agree.
- [ ] Standard and Smart insertion points are documented with no unresolved
  lifecycle ambiguity.
- [ ] Limits and failure semantics are named, not embedded as magic values.

## 3. Phase 1 — SearXNG image-search deployment

### Primary files

- `gslide-ops/deploy/searxng/settings.yml`
- `gslide-ops/docker-compose.yml`
- `gslide-ops/.env.example`
- `gslide-ops/README.md`
- Kubernetes SearXNG configuration and documentation

### Tasks

- [ ] Enable and verify JSON image search.
- [ ] Configure `image_proxy: true` if the selected engines and deployed
  SearXNG version support stable proxy URLs.
- [ ] Set image-search safe search to level `1`.
- [ ] Enable a small explicit set of reliable image engines.
- [ ] Keep the SearXNG service internal-only with no public ingress.
- [ ] Add `WEB_IMAGE_SEARCH_ENABLED=false` as an operator rollout flag.
- [ ] Add bounded defaults for result limit and upstream timeouts.
- [ ] Document that SearXNG is required for images even when text research uses
  OpenAI/Google native search.
- [ ] Add an image-category readiness probe or diagnostic command.

### Verification

- [ ] The API container can receive JSON results from a
  `categories=images&safesearch=1` query.
- [ ] Text search still works against the same SearXNG instance.
- [ ] SearXNG remains unreachable from public ingress.

## 4. Phase 2 — Shared SearXNG connection helpers

### Primary files

- `gslide-api/servers/fastapi/utils/web_search.py`
- new `services/image_search/` package
- environment/user-config helpers only where operator flags are exposed

### Tasks

- [ ] Extract reusable SearXNG base/search URL parsing, required configuration,
  JSON response validation, timeout setup, and credential-redacted logging.
- [ ] Preserve the existing text-search contract and tests during extraction.
- [ ] Add an image-search availability function based on
  `WEB_IMAGE_SEARCH_ENABLED` and `SEARXNG_BASE_URL`.
- [ ] Make operator flag `false` preserve the complete pre-feature image path;
  reserve placeholder behavior for an enabled feature whose search is
  unavailable or fails.
- [ ] Do not add or mutate an image-generation provider setting.
- [ ] Treat the operator flag as a rollout gate; continue using
  `presentation.web_search` as the only user/presentation switch.

### Tests

- [ ] Base URL and `/search` URL normalization.
- [ ] Credential redaction.
- [ ] Text-search routing regression.
- [ ] Native text search plus SearXNG image-search availability.
- [ ] Missing/disabled SearXNG image-search state.

## 5. Phase 3 — Image-search adapter, query normalization, and ranking

### Suggested files

```text
gslide-api/servers/fastapi/services/image_search/
  __init__.py
  models.py
  service.py
  searxng.py
  query.py
  ranking.py
  downloader.py
```

### Tasks

- [ ] Implement `ImageSearchService.search()` and `search_and_import()`.
- [ ] Call SearXNG with `format=json`, `categories=images`, and `safesearch=1`.
- [ ] Parse known response-field variants defensively.
- [ ] Normalize whitespace and canonicalize URLs.
- [ ] Deduplicate candidates by canonical image URL.
- [ ] Rank known resolution, minimum usable size, requested aspect ratio, engine
  order, and source-domain diversity.
- [ ] Add a deterministic query normalizer that preserves named entities,
  places, products, and dates while removing generation-only adjectives and
  commands.
- [ ] Do not add an extra LLM request to normalize queries.
- [ ] Cache searches by normalized query, limit, aspect ratio, safe-search
  value, and adapter version.
- [ ] Track already-selected URLs/domains in a presentation-scoped resolution
  context.

### Tests

- [ ] Exact SearXNG request parameters.
- [ ] Fixture parsing and missing-field tolerance.
- [ ] Invalid scheme filtering and URL deduplication.
- [ ] Query normalization for Vietnamese and English prompts.
- [ ] Resolution/aspect-ratio ranking.
- [ ] Deck-level URL/domain diversity.
- [ ] Cache hit, miss, and expiration.

## 6. Phase 4 — Secure remote-image import

### Tasks

- [ ] Accept candidates only from the internal search service in the automatic
  flow; do not expose an arbitrary URL-import endpoint.
- [ ] Permit only HTTP/HTTPS and validate DNS results.
- [ ] Reject loopback, private, link-local, multicast, reserved, and metadata
  service addresses.
- [ ] Disable implicit redirects and validate each bounded redirect hop.
- [ ] If SearXNG proxying is used, allow only the configured SearXNG origin and
  exact proxy route.
- [ ] Apply connect/read/total timeouts.
- [ ] Stream downloads with a hard byte limit.
- [ ] Validate MIME type and image bytes using shared upload validation.
- [ ] Enforce Pillow decompression-bomb and maximum-pixel limits.
- [ ] Reject SVG in the first release.
- [ ] Re-encode to an approved raster format and strip metadata.
- [ ] Write through a temporary file and atomically promote only on success.
- [ ] Create the owner-scoped `ImageAsset` after file validation.
- [ ] Store source/query/engine/original URL metadata in `extras`.
- [ ] Clean temporary files and roll back database state on failure or stream
  cancellation.

### Security tests

- [ ] Invalid schemes and malformed URLs.
- [ ] IPv4 and IPv6 local/private/reserved destinations.
- [ ] Public-to-private redirect.
- [ ] DNS rebinding/connected-peer validation.
- [ ] Oversized declared and streamed bodies.
- [ ] MIME spoofing, HTML payloads, malformed images, and decompression bombs.
- [ ] Cancellation during search and download.
- [ ] Owner isolation and partial-file cleanup.

### Exit criteria

- [ ] A successful call returns a normal persisted `ImageAsset` and local URL.
- [ ] A malicious candidate cannot turn the API into a general network proxy.

## 7. Phase 5 — Standard structured-output contract

### Primary areas

- Template V2 schema generation
- slide-content LLM prompts
- `gslide-api/servers/fastapi/utils/process_slides.py`
- presentation generation and chat slide-creation callers

### Tasks

- [ ] Add optional `image_query` beside existing `image_prompt` in image-slot
  structured output.
- [ ] When `web_search=true`, instruct the LLM to produce a concise searchable
  phrase for every image slot.
- [ ] Keep `image_prompt` for backward compatibility and the Web Search off
  branch.
- [ ] Add a deterministic `image_prompt` to `image_query` compatibility fallback.
- [ ] Extend asset-discovery helpers to read both keys without treating
  `image_query` as an icon query.
- [ ] Pass `presentation.web_search` and a presentation-scoped dedupe context
  into `process_slide_and_fetch_assets()`.
- [ ] Preserve explicit outline/source image URLs as first priority.
- [ ] Branch exactly once per unresolved slot:

```python
if presentation.web_search and web_image_search_feature_enabled:
    if web_image_search_configured:
        asset = await image_search_service.search_and_import(image_query)
    else:
        asset = placeholder_with_warning()
else:
    asset = await image_generation_service.generate_image(image_prompt)
```

- [ ] Do not fall through from failed search to image generation.
- [ ] Save searched assets through the existing generation transaction.
- [ ] Emit `slide_assets` updates and coded warnings consistently.
- [ ] Apply the same rule to regenerated/chat-created Standard slides that
  inherit `presentation.web_search`.

### Tests

- [ ] With the rollout flag enabled, Web Search on calls search and never image
  generation.
- [ ] Web Search off calls existing image generation, never search.
- [ ] Operator rollout flag off preserves the complete pre-feature behavior,
  including for presentations whose `web_search` value is true.
- [ ] Explicit outline URL bypasses both.
- [ ] Search candidate retry and placeholder warning.
- [ ] Multiple slots do not reuse one image unintentionally.
- [ ] Old structured output without `image_query` remains valid.
- [ ] Slide stream cancellation cancels pending search/import work.

## 8. Phase 6 — Smart HTML image-query contract

### Primary areas

- `utils/llm_calls/generate_smart_presentation.py`
- Smart HTML validation/sanitization
- `_stream_smart_presentation()`
- frontend Smart `slide_assets` merge behavior

### Tasks

- [ ] Extend the Smart prompt to emit local placeholders with bounded
  `data-image-query` and meaningful `alt` text when Web Search is enabled.
- [ ] Prohibit invented remote image URLs.
- [ ] Parse image-query slots with an HTML parser, not regular-expression HTML
  rewriting.
- [ ] Start bounded asset tasks per streamed slide.
- [ ] Preserve fast slide streaming by sending placeholder HTML first if useful,
  then emit an updated `slide_assets` event after search/import completes.
- [ ] Replace only the intended `img[src]` attribute with the local asset URL.
- [ ] Remove `data-image-query` before final persistence.
- [ ] Run Smart HTML validation/sanitization after replacement.
- [ ] Await or cancel all asset tasks before commit/rollback.
- [ ] Emit non-fatal coded warnings and retain placeholders when no candidate is
  usable.
- [ ] Leave current Web Search off Smart behavior unchanged.

### Tests

- [ ] Query slots are generated only when Web Search is on.
- [ ] Remote URLs invented by the model are rejected or replaced.
- [ ] Multiple slots resolve to the correct DOM nodes.
- [ ] Asset updates merge into the streamed slide without losing other HTML.
- [ ] Final stored HTML contains local URLs and no `data-image-query` markers.
- [ ] Failure keeps valid HTML with placeholders.
- [ ] Disconnect cancels background asset work and prevents orphan records.

## 9. Phase 7 — Status, warnings, and localized UI

### Tasks

- [ ] Add backend status codes for searching and importing slide images.
- [ ] Add warning codes for disabled/unconfigured search, no results, timeout,
  rejected candidates, download failure, and placeholder fallback.
- [ ] Add matching Vietnamese and English catalog entries.
- [ ] Surface image warnings through the existing generation status/toast path.
- [ ] Make it clear that text research may have succeeded even when an image
  slot uses a placeholder.
- [ ] Keep the existing Web Search toggle label unless product wants helper copy
  such as “Tìm nội dung và hình ảnh trên web”.
- [ ] Update helper text to disclose that image results come from the web and
  may have third-party usage rights.
- [ ] Do not add SearXNG to the Image Provider settings selector.

### Tests

- [ ] Backend-code mapping parity.
- [ ] Vietnamese/English catalog parity.
- [ ] No hard-coded user-facing error strings in touched frontend files.
- [ ] Toggle payload still uses the existing `web_search` boolean.

## 10. Phase 8 — Export, lifecycle, and observability

### Tasks

- [ ] Verify local searched assets survive presentation reload.
- [ ] Verify duplicate/delete behavior and cleanup ownership.
- [ ] Verify PDF and PPTX embed local searched assets.
- [ ] Store and retain source metadata without showing a false royalty-free
  claim.
- [ ] Add metrics for search latency, candidates returned/rejected, import
  latency, bytes, selected engine/domain, placeholder rate, and cancellation.
- [ ] Hash or redact sensitive queries in logs according to privacy settings.
- [ ] Add a diagnostic health endpoint or operator command for SearXNG image
  search that does not mutate a presentation.

### Resilience matrix

| Text research | Image search | Expected result |
| --- | --- | --- |
| Success | Success | Full text and searched images |
| Success | Failure | Full text, placeholders, image warnings |
| Empty/failure | Success | Base LLM text behavior plus searched images |
| Empty/failure | Failure | Existing base text behavior plus placeholders |

## 11. Phase 9 — Rollout and final verification

### Rollout sequence

1. Deploy SearXNG image settings and verify engines.
2. Deploy API with `WEB_IMAGE_SEARCH_ENABLED=false`.
3. Exercise the automatic search service in staging diagnostics.
4. Enable the flag in staging for presentations with `web_search=true`.
5. Run Standard and Smart generation/export smoke tests.
6. Monitor placeholder, timeout, and rejection rates.
7. Enable production after security and export gates pass.

### Automated verification

- [ ] Backend adapter, query, ranking, cache, downloader, and security tests.
- [ ] Presentation create/prepare/stream/regenerate/duplicate contract tests.
- [ ] Standard and Smart generation integration tests.
- [ ] Text web-search regression tests for native and SearXNG routes.
- [ ] Existing image-generation tests with Web Search off.
- [ ] Owner isolation, cancellation, cleanup, and export tests.
- [ ] TypeScript, ESLint, Node contract/catalog tests, Cypress, and production
  build.
- [ ] Compose smoke test against the real configured SearXNG image engines.

### Manual smoke matrix

| Mode | Text route | Web Search | Expected images |
| --- | --- | --- | --- |
| Standard | OpenAI native | On | SearXNG local assets |
| Standard | SearXNG text | On | SearXNG local assets |
| Standard | None | Off | Existing AI-generated assets |
| Smart | Google native | On | SearXNG local assets |
| Smart | SearXNG text | On | SearXNG local assets |
| Smart | None | Off | Current Smart behavior |

For every Web Search on case, repeat after blocking SearXNG and the source image
host; already completed decks and exports must retain their images.

### Definition of done

- [ ] All acceptance criteria in the specification are demonstrated.
- [ ] `web_search=true` automatically activates both independent pipelines.
- [ ] No `IMAGE_PROVIDER=searxng` path exists.
- [ ] Web Search off retains existing image-generation behavior.
- [ ] Search failure never invokes a paid image generator.
- [ ] Persisted searched images are validated, local, and owner-scoped.
- [ ] Security review has no open Critical or High findings.
- [ ] Automated checks and manual smoke matrix pass.
- [ ] Operator docs cover enable, health check, failure diagnosis, and rollback.

## 12. Recommended implementation tasks for Claude

Use these bounded tasks in order:

1. **Contract audit and fixtures:** capture real SearXNG image responses and lock
   limits/models.
2. **Ops and shared connection:** configure image engines/proxy/safe search and
   extract common SearXNG helpers without breaking text search.
3. **Search service:** query normalization, adapter, ranking, cache, and deck
   deduplication context.
4. **Secure importer:** SSRF-safe download, validation, re-encoding,
   `ImageAsset` persistence, metadata, and cleanup.
5. **Standard integration:** structured `image_query`, resolver branch,
   streaming warnings, and regression tests.
6. **Smart integration:** HTML query slots, asynchronous asset updates,
   sanitization, cancellation, and tests.
7. **Hardening and release:** localization, observability, export/lifecycle,
   Compose smoke test, and rollout documentation.

Claude should complete and verify one task before starting the next. In
particular, Standard/Smart integration must call the reviewed importer service;
neither path may implement its own remote URL downloader.

## 13. Completion record — 2026-09-08

Implementation for Phases 0–8 is present across `gslide-api`, `gslide-web`, and
`gslide-ops`. Phase 9 automated verification and a live read-only SearXNG smoke
test completed successfully. The production rollout itself remains an operator
decision: `WEB_IMAGE_SEARCH_ENABLED` deliberately defaults to `false`.

Verified gates:

- image-search/web-search backend suite: 231 passed;
- frontend Node contracts/catalogs: 133 passed;
- TypeScript, ESLint, Cypress component tests (3 specs), and production build:
  passed;
- Docker Compose configuration: valid;
- live local SearXNG: 110/110 image results usable from the five configured
  engines, and 20 text results from the general category;
- API health surface: reports the disabled rollout gate safely and the probe
  returns `not_enabled` without importing or mutating data.

The complete backend suite now passes on Windows: 1075 passed and 2 skipped.
The portability pass also fixed native Windows export paths, trusted roots on
different drives, platform-specific converter suffix selection, and made POSIX
permission assertions conditional without weakening their Linux coverage.
