# GSlide Automatic Web Image Search Specification

- Status: Draft for implementation
- Date: 2026-09-08
- Scope owners: GSlide Web, GSlide API, GSlide Ops
- Related plan: `docs/superpowers/plans/gslide-searxng-image-search-plan.md`

## 1. Objective

Extend the existing per-presentation **Web Search** option so that, when it is
enabled, GSlide gathers both factual text context and relevant web images and
produces slides containing both content and resolved image assets.

Text search and image search share the presentation's existing `web_search`
switch, but remain separate backend pipelines:

```text
presentation.web_search = true
              |
              +--> text research: native provider or SearXNG
              |
              +--> image search: SearXNG images category
```

SearXNG is not an AI image provider. `IMAGE_PROVIDER` and the existing AI image
generation implementation remain unchanged.

## 2. Current state

The repository audit found:

- `PresentationModel.web_search` already persists the Web Search choice for
  each presentation, and the upload UI already exposes that setting.
- Text research routes through provider-native search for supported OpenAI or
  Google models, or through SearXNG for external/custom-model search.
- `utils/web_search.py` calls SearXNG with `q` and `format=json`, but does not
  query the `images` category.
- Standard slide images are resolved centrally through
  `process_slide_and_fetch_assets()` and `ImageGenerationService`.
- An outline-provided image URL currently takes priority over image generation.
- Smart slides are generated as HTML and do not yet expose a safe image-query
  placeholder that the backend can resolve.
- `ImageAsset` and `/app_data/...` URLs already provide persistent local assets
  suitable for reopening and export.
- `gslide-ops/deploy/searxng/settings.yml` enables JSON output, with
  `image_proxy: false` and `safe_search: 0` at the time of this specification.

## 3. Product decisions

### 3.1 One user switch, two internal pipelines

No new image-search toggle is added to presentation creation in the first
release. The existing Web Search switch controls both pipelines.

| `web_search` | Text content | Automatic slide images |
| --- | --- | --- |
| `false` | Existing non-web generation | Existing image behavior (`IMAGE_PROVIDER` where currently supported) |
| `true` | Native search or SearXNG according to `WEB_SEARCH_PROVIDER` | SearXNG image search |

This is a presentation-level choice, not a global replacement of
`IMAGE_PROVIDER`.

### 3.2 Routing is deliberately asymmetric

When Web Search is enabled:

- Text research may use provider-native search or SearXNG, according to the
  existing text-search router.
- Image search always uses SearXNG because the current native text-search tools
  do not provide the image-result contract required by GSlide.

Therefore a deployment using native text research must still configure and run
SearXNG to obtain automatic web images.

### 3.3 No silent cross-fallback

- When `web_search=false`, image slots keep using the configured AI image
  generator.
- When `web_search=true`, unresolved image slots use SearXNG and do not invoke a
  paid AI image generator if search fails.
- While the operator rollout flag is disabled, all presentations retain the
  complete pre-feature image behavior. This is feature gating, not a search-
  failure fallback.
- Search failure produces a placeholder and a non-fatal slide warning.
- Text-search success is not rolled back because image search failed, and image
  search success is not rolled back because text research returned no context.

### 3.4 Local persistence, not hotlinking

Every selected search result must be downloaded, validated, normalized, stored
as an owner-scoped `ImageAsset`, and referenced through a local
`/app_data/...` URL.

Slides must not persist raw remote image URLs. This protects reopening,
duplication, and PDF/PPTX export from expiring URLs, hotlink blocking, and
upstream outages.

### 3.5 Core scope versus later enhancements

The core release is automatic prompt-to-slide image resolution. A manual Web
Image Search tab in the editor and an explicit chat `search_image` tool may
reuse the same service later, but they are not required to complete this
release.

## 4. End-to-end behavior

### 4.1 Web Search disabled

```text
outline/content generation
        -> image_prompt
        -> ImageGenerationService
        -> generated ImageAsset/local URL
        -> slide
```

This path must remain behaviorally compatible with the current product.

### 4.2 Web Search enabled

```text
topic/documents
        |
        +-> text research -> outline and slide text
        |
        +-> slide image_query
                    -> SearXNG categories=images
                    -> rank candidates
                    -> download first valid candidate
                    -> validate/re-encode
                    -> ImageAsset/local URL
                    -> slide image slot
```

### 4.3 Asset priority

For each image slot, resolve in this order:

1. An explicit image URL supplied by an approved source/outline and already
   accepted by the existing flow.
2. SearXNG image search when `presentation.web_search=true`.
3. AI image generation when `presentation.web_search=false`.
4. Local placeholder plus warning when the selected branch cannot resolve an
   asset.

SearXNG and AI generation are mutually exclusive for one automatic resolution
attempt.

## 5. Functional requirements

### FR-1: Reuse the persisted presentation setting

- Reuse `PresentationModel.web_search`; do not add `image_search` or
  `IMAGE_SEARCH_ENABLED` to the presentation schema for the first release.
- Ensure create, outline, prepare, stream, regenerate, and duplicate flows
  preserve the stored value.
- Do not infer the setting from the current browser URL after the presentation
  has been created.
- Do not modify `IMAGE_PROVIDER`, `DISABLE_IMAGE_GENERATION`, or
  `WEB_SEARCH_PROVIDER` when the switch changes.

### FR-2: Separate internal image-search service

Create a provider-neutral interface even though the first adapter is SearXNG:

```python
class ImageSearchService:
    async def search(
        self,
        query: str,
        *,
        limit: int,
        aspect_ratio: float | None = None,
    ) -> list[ImageSearchCandidate]: ...

    async def search_and_import(...) -> ImageAsset: ...
```

Do not add SearXNG to `ImageProvider` and do not put search logic inside an AI
provider method.

### FR-3: SearXNG image request

The adapter must call the configured SearXNG `/search` endpoint with:

```text
q=<normalized image query>
format=json
categories=images
safesearch=1
```

It must normalize common SearXNG result fields into:

```python
ImageSearchCandidate(
    title: str,
    image_url: str,
    thumbnail_url: str | None,
    source_page_url: str | None,
    engine: str | None,
    width: int | None,
    height: int | None,
)
```

The adapter must tolerate missing optional fields, reject invalid schemes,
deduplicate canonical URLs, and cap results.

### FR-4: Search-query contract

Structured Standard slide content must distinguish the two intents:

```json
{
  "image_prompt": "Cinematic conceptual illustration of clean energy",
  "image_query": "Vietnam solar wind farm aerial photograph"
}
```

- `image_prompt` remains optimized for an AI image generator.
- `image_query` is concise and optimized for finding an existing image.
- When Web Search is enabled, the content-generation schema/prompt requests
  `image_query` for every resolvable image slot.
- During compatibility rollout, a missing `image_query` may be derived
  deterministically from `image_prompt`; it must not trigger an extra LLM call.
- Query normalization preserves named entities, places, products, and dates,
  removes generation instructions, normalizes whitespace, and enforces a
  bounded length.

### FR-5: Candidate selection

For an image slot, the resolver must:

- Prefer known dimensions and sufficient resolution.
- Prefer an aspect ratio close to the target slot when it is available.
- Avoid duplicate image URLs within one presentation generation job.
- Avoid repeatedly selecting the same source domain when alternatives exist.
- Attempt a bounded number of candidates in ranked order.
- Continue to the next candidate when download or validation fails.
- Never use search results representing charts, graphs, dashboards, or
  infographics as substitutes for editable slide components.

### FR-6: Safe download and import

The downloader must:

- Accept only server-produced SearXNG candidates, never an arbitrary client URL
  in the automatic flow.
- Permit only HTTP and HTTPS.
- Reject loopback, private, link-local, multicast, reserved, and cloud-metadata
  destinations after DNS resolution.
- Revalidate every redirect target and bound redirect count.
- Apply connect, read, and total timeouts.
- Stream with a maximum byte limit.
- Validate allowed MIME types and actual bytes with Pillow.
- Enforce decompression-bomb and maximum-pixel limits.
- Reject remote SVG for the first release.
- Re-encode to an approved raster format and strip metadata.
- Remove partial files if any stage fails.
- Create a database row only after the local file is valid.

If SearXNG image proxying is used, requests may target only the exact configured
SearXNG origin and approved proxy path. The endpoint must not become a general
URL proxy.

### FR-7: ImageAsset metadata

Store source information in `ImageAsset.extras` without a schema migration:

```json
{
  "origin": "web_search",
  "provider": "searxng",
  "query": "Vietnam solar wind farm aerial photograph",
  "title": "Solar farm in Ninh Thuan",
  "source_page_url": "https://example.org/article",
  "original_image_url": "https://cdn.example.org/photo.jpg",
  "engine": "bing images",
  "imported_at": "2026-09-08T10:00:00Z"
}
```

GSlide must not label arbitrary results as royalty-free. Source metadata must
remain available for a future attribution UI.

### FR-8: Standard slide generation

- Pass `presentation.web_search` into the asset-resolution boundary.
- Extend `process_slide_and_fetch_assets()` and
  `process_old_and_new_slides_and_fetch_assets()` to select the correct branch
  without changing icon behavior.
- Keep explicit outline/source image URLs at the highest priority.
- Persist searched images through the same transaction/lifecycle used for
  generated `ImageAsset` records.
- Emit per-slide asset warnings without failing the entire slide stream.
- Apply the same behavior to regeneration and chat-created Standard slides when
  they inherit the presentation setting.

### FR-9: Smart slide generation

Smart HTML generation must express unresolved image intent without inventing a
remote URL:

```html
<img
  src="/static/images/placeholder.jpg"
  data-image-query="Vietnam semiconductor factory interior"
  alt="Semiconductor production line"
/>
```

The backend must:

1. Extract bounded `data-image-query` values from generated slide HTML.
2. Schedule SearXNG resolution for those slots when `web_search=true`.
3. Stream either a placeholder draft followed by an existing `slide_assets`
   update, or wait for resolution before the final slide event.
4. Replace only the matching `img[src]` with a local asset URL.
5. Remove `data-image-query` before persistence.
6. Run the existing Smart HTML validation/sanitization after replacement.
7. Wait for bounded asset tasks before the final database commit.

When `web_search=false`, current Smart image behavior remains unchanged until a
separate Smart image-generation contract is deliberately implemented.

### FR-10: Progress, errors, and localization

- Add stable status codes for searching and importing slide images.
- Add coded non-fatal warnings for no results, timeout, unsafe candidates,
  download failure, invalid image, and placeholder fallback.
- Do not expose raw upstream response bodies to users.
- Add Vietnamese and English catalog entries with parity tests.
- The generation status UI may report image-search progress without blocking
  already-streamed slide text.

## 6. Non-functional requirements

### NFR-1: Independence

- Text and image search share only the presentation switch and common SearXNG
  connection helpers.
- Either pipeline may succeed when the other fails.
- Search code must not instantiate `ImageGenerationService`.
- SearXNG must never be accepted as an `IMAGE_PROVIDER` value.

### NFR-2: Performance

- Search timeout target: at most 10 seconds per query.
- Download/import timeout target: at most 20 seconds per candidate.
- Cap concurrent image resolutions globally and per presentation.
- Cache identical normalized queries briefly.
- Deduplicate downloads within one generation job.
- Asset work must respect stream disconnect/cancellation behavior.

### NFR-3: Export and lifecycle

- Reopening and exporting a completed deck must not require SearXNG or the
  original image host.
- Duplicate/delete/cleanup behavior must treat searched assets consistently
  with generated assets while retaining `extras.origin`.
- Owner isolation must apply to files and database records.

### NFR-4: Observability

Record provider, normalized-query hash, latency, candidate count, rejected
candidate reasons, selected engine/domain, bytes, and final outcome. Do not log
credentials, signed proxy URLs, or full sensitive queries.

## 7. Out of scope

- Replacing or removing AI image generation.
- Adding SearXNG to `IMAGE_PROVIDER`.
- A second presentation-level image-search switch.
- Automatically mixing searched and AI-generated images while Web Search is on.
- Manual editor image search for the first core release.
- An explicit chat `search_image` picker for the first core release.
- Reverse-image search, video search, or SVG import.
- Guaranteeing copyright or commercial-use rights for search results.

## 8. Acceptance criteria

The core feature is complete when:

1. Creating a presentation with Web Search enabled automatically performs both
   text research and SearXNG image search.
2. Standard slide image slots are filled with validated local assets when
   usable search results exist.
3. Smart slide `data-image-query` slots resolve to validated local assets.
4. Web Search disabled preserves the current AI image-generation path.
5. Enabling Web Search never changes `IMAGE_PROVIDER` or its credentials.
6. Native OpenAI/Google text research can coexist with SearXNG image search.
7. Failure of one search pipeline does not cancel successful work from the
   other pipeline.
8. Image-search failure never invokes an AI generator; it produces a warning
   and placeholder.
9. Slides and PDF/PPTX exports retain searched images after SearXNG and the
   source host become unavailable.
10. No persisted slide contains an unapproved remote search-result URL.
11. SSRF, redirects, MIME spoofing, byte limit, pixel limit, owner isolation,
    cancellation, and cleanup tests pass.
12. Existing image generation, Standard/Smart generation, chat, export,
    localization, and build suites continue to pass.

## 9. Rollout and rollback

Deploy behind an operator-level compatibility flag such as
`WEB_IMAGE_SEARCH_ENABLED=false`. This flag controls rollout availability only;
it is not a second user-facing presentation option.

When the flag becomes true, presentations with `web_search=true` receive image
search automatically. Disabling the flag restores the complete pre-feature
image behavior and leaves already imported local images intact. Once the
feature is enabled, an individual SearXNG failure must not be treated as a
reason to call a paid generator.
