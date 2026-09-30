import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  BACKEND_ERROR_MESSAGES,
  BACKEND_STATUS_MESSAGES,
} from "../lib/backend-messages.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

// Every failure code the backend image-search pipeline can emit (Phase 7).
const IMAGE_SEARCH_FAILURE_CODES = [
  "image_search.disabled",
  "image_search.not_configured",
  "image_search.empty_query",
  "image_search.no_results",
  "image_search.search_timeout",
  "image_search.import_timeout",
  "image_search.download_failed",
  "image_search.candidate_rejected",
  "image_search.importer_unavailable",
  "image_search.no_usable_candidate",
  "image_search.placeholder_fallback",
];

test("every backend image-search failure code has a frontend mapping", () => {
  assert.deepEqual(
    IMAGE_SEARCH_FAILURE_CODES.filter(
      (code) => !(code in BACKEND_ERROR_MESSAGES),
    ),
    [],
  );
});

test("image-search progress status codes have a frontend mapping", () => {
  assert.ok("images.searching_web" in BACKEND_STATUS_MESSAGES);
  assert.ok("images.importing" in BACKEND_STATUS_MESSAGES);
});

test("generation payloads still send the existing web_search boolean", async () => {
  const uploadPage = await read(
    "app/(presentation-generator)/upload/components/UploadPage.tsx",
  );
  const documentsPreview = await read(
    "app/(presentation-generator)/documents-preview/components/DocumentPreviewPage.tsx",
  );

  // The toggle stays a boolean on the existing field; no provider string or
  // new field is introduced for image search. Create now runs a single
  // request, so the boolean is sent exactly once.
  assert.match(uploadPage, /web_search:\s*!!generationConfig\.webSearch/g);
  assert.equal(
    (uploadPage.match(/web_search:\s*!!generationConfig\.webSearch/g) ?? []).length,
    1,
  );
  assert.match(
    documentsPreview,
    /web_search:\s*!!config\?\.webSearch/,
  );
});

test("searxng is never offered as an image provider option", async () => {
  const providerConstants = await read("utils/providerConstants.ts");
  const imageProviderSection = providerConstants.slice(
    providerConstants.indexOf("export const IMAGE_PROVIDERS"),
  );

  assert.doesNotMatch(imageProviderSection, /searxng/i);
});

test("streamed slide warnings localize through the backend messages", async () => {
  const streaming = await read(
    "app/(presentation-generator)/presentation/hooks/usePresentationStreaming.ts",
  );

  assert.match(streaming, /translateBackendError/);
  assert.match(streaming, /Một số ảnh slide dùng ảnh giữ chỗ/);
  // Coded image-search warnings keep their own dedupe key, not the
  // English fallback text.
  assert.match(streaming, /errorCode \?\? detail/);
});

test("web search provider settings UI is removed", async () => {
  await assert.rejects(
    read(
      "app/(presentation-generator)/(dashboard)/settings/WebSearchProvider.tsx",
    ),
  );
});

test("image-search copy never claims royalty-free results", async () => {
  const backendMessages = await read("lib/backend-messages.ts");
  const streaming = await read(
    "app/(presentation-generator)/presentation/hooks/usePresentationStreaming.ts",
  );

  // Searched images come from third-party sources with unknown usage
  // rights; no copy may promise they are free to use (spec FR-7).
  const royaltyFreePattern = /royalty[- ]free|free to use|miễn phí bản quyền|miễn phí giấy phép/i;
  for (const [name, source] of [
    ["backend-messages", backendMessages],
    ["streaming", streaming],
  ]) {
    const matches = [...source.matchAll(
      new RegExp(`.{0,60}(?:${royaltyFreePattern.source})`, "gi"),
    )];
    const imageSearchHits = matches
      .map((match) => match[0])
      .filter((context) => /imageSearch|image_search|ảnh|image/i.test(context));
    assert.deepEqual(
      imageSearchHits,
      [],
      `${name} copy must not claim royalty-free searched images`,
    );
  }
});
