import assert from "node:assert/strict";
import test from "node:test";

import {
  BACKEND_ERROR_MESSAGES,
  BACKEND_STATUS_MESSAGES,
  translateBackendError,
  translateBackendStatus,
} from "../lib/backend-messages.ts";

test("every mapped backend code resolves to a non-empty Vietnamese message", () => {
  for (const message of [
    ...Object.values(BACKEND_STATUS_MESSAGES),
    ...Object.values(BACKEND_ERROR_MESSAGES),
  ]) {
    assert.ok(message.trim(), `empty backend message for ${JSON.stringify(message)}`);
  }
});

test("coded statuses translate while legacy statuses remain verbatim", () => {
  const payload = {
    type: "status",
    status: "Drafting your presentation outline",
    status_code: "outline.drafting",
  };
  assert.equal(
    translateBackendStatus(payload),
    "Đang soạn dàn ý bài thuyết trình",
  );
  assert.equal(
    translateBackendStatus({ status: payload.status }),
    payload.status,
  );
  assert.match(
    translateBackendStatus({
      status: "Searching",
      status_code: "outline.searching_provider",
      status_params: { provider: "Tavily", query: "thị trường" },
    }),
    /Tavily.*thị trường/,
  );
});

test("image-search statuses and warnings translate", () => {
  assert.ok(BACKEND_STATUS_MESSAGES["images.searching_web"].trim());
  assert.ok(BACKEND_STATUS_MESSAGES["images.importing"].trim());
  for (const error_code of [
    "image_search.no_results",
    "image_search.search_timeout",
    "image_search.candidate_rejected",
    "image_search.not_configured",
    "image_search.placeholder_fallback",
  ]) {
    const translated = translateBackendError({
      detail: "English fallback",
      error_code,
    });
    assert.notEqual(translated, "English fallback", error_code);
    assert.ok(translated.trim(), error_code);
  }
  // The Vietnamese copy clarifies that slide text survives an image
  // placeholder (Phase 7 requirement).
  assert.match(
    translateBackendError({
      detail: "fallback",
      error_code: "image_search.no_results",
    }),
    /Nội dung chữ của slide không bị ảnh hưởng/,
  );
});

test("coded errors translate and interpolate; legacy errors remain verbatim", () => {
  const fixtures = [
    "error.outline_parse_failed",
    "error.outline_slide_count",
    "error.outline_generation_failed",
    "error.slides_generation_failed",
    "error.chat_stream_failed",
    "error.presentation_not_found",
    "error.image.invalid_image",
    "error.template.not_found",
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
  for (const error_code of fixtures) {
    const translated = translateBackendError({
      detail: "Legacy detail",
      error_code,
    });
    assert.notEqual(translated, "Legacy detail", error_code);
    assert.ok(translated.trim(), error_code);
  }
  assert.match(
    translateBackendError({
      detail: "Too many",
      error_code: "error.slides_too_many",
      error_params: { max: 20 },
    }),
    /20/,
  );
  assert.equal(
    translateBackendError({ detail: "Legacy backend detail" }),
    "Legacy backend detail",
  );
});

test("every emitted Task A trace code has a frontend mapping", () => {
  const traceCodes = [
    "adding_outline_slide", "updating_outline_slide", "deleting_outline_slide",
    "adding_blank_slide", "adding_slide_from_layout", "reading_template_summary",
    "reading_source_documents", "searching_relevant_slides",
    "opening_requested_slide", "checking_available_layouts", "checking_layout_schema",
    "generating_slide_assets", "saving_slide", "updating_slide", "deleting_slide",
    "adding_slide_element", "updating_slide_element", "removing_slide_element",
    "adding_slide_component", "creating_slide_component", "updating_slide_component",
    "removing_slide_component", "checking_available_themes", "applying_presentation_theme",
    "running_tool", "model_note", "using_tools", "tool_failed", "tool_result",
    "tool_returned_results", "found_requested_data", "no_matching_data",
    "tool_completed", "tool_limit_reached",
  ].map((suffix) => `chat.trace.${suffix}`);

  assert.deepEqual(
    traceCodes.filter((code) => !(code in BACKEND_STATUS_MESSAGES)),
    [],
  );
});
