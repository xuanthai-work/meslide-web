import assert from "node:assert/strict";
import test from "node:test";

import {
  BACKEND_ERROR_KEYS,
  BACKEND_STATUS_KEYS,
  translateBackendError,
  translateBackendStatus,
} from "../i18n/backend-messages.ts";
import vi from "../i18n/locales/vi.ts";
import en from "../i18n/locales/en.ts";
import { translate } from "../i18n/translate.ts";

function readPath(catalog, path) {
  return path.split(".").reduce((node, part) => node?.[part], catalog);
}

const viT = (key, params) => translate(key, params, "vi-VN");
const enT = (key, params) => translate(key, params, "en-US");

test("every mapped backend code resolves in both catalogs", () => {
  for (const key of [
    ...Object.values(BACKEND_STATUS_KEYS),
    ...Object.values(BACKEND_ERROR_KEYS),
  ]) {
    assert.ok(readPath(vi, key), `missing vi key ${key}`);
    assert.ok(readPath(en, key), `missing en key ${key}`);
    assert.ok(viT(key, { max: 20, provider: "OpenAI", query: "Q", filename: "a.pdf", max_size: 5, accepted: ".png", accepted_types: ".pdf", template_name: "x", tool: "search", count: 2 }));
    assert.ok(enT(key, { max: 20, provider: "OpenAI", query: "Q", filename: "a.pdf", max_size: 5, accepted: ".png", accepted_types: ".pdf", template_name: "x", tool: "search", count: 2 }));
  }
});

test("coded statuses translate while legacy statuses remain verbatim", () => {
  const payload = {
    type: "status",
    status: "Drafting your presentation outline",
    status_code: "outline.drafting",
  };
  assert.equal(translateBackendStatus(viT, payload), "Đang soạn dàn ý bài thuyết trình");
  assert.equal(
    translateBackendStatus(viT, { status: payload.status }),
    payload.status,
  );
  assert.match(
    translateBackendStatus(viT, {
      status: "Searching",
      status_code: "outline.searching_provider",
      status_params: { provider: "Tavily", query: "thị trường" },
    }),
    /Tavily.*thị trường/,
  );
});

test("image-search statuses and warnings translate in both locales", () => {
  for (const t of [viT, enT]) {
    assert.ok(
      t("presentation.status.searchingWebImages").trim(),
      "searchingWebImages",
    );
    assert.ok(
      t("presentation.status.importingSlideImages").trim(),
      "importingSlideImages",
    );
    for (const error_code of [
      "image_search.no_results",
      "image_search.search_timeout",
      "image_search.candidate_rejected",
      "image_search.not_configured",
      "image_search.placeholder_fallback",
    ]) {
      const translated = translateBackendError(t, {
        detail: "English fallback",
        error_code,
      });
      assert.notEqual(translated, "English fallback", error_code);
      assert.ok(translated.trim(), error_code);
    }
  }
  // The Vietnamese catalog clarifies that slide text survives an image
  // placeholder (Phase 7 requirement).
  assert.match(
    translateBackendError(viT, {
      detail: "fallback",
      error_code: "image_search.no_results",
    }),
    /Nội dung chữ của slide không bị ảnh hưởng/,
  );
  assert.match(
    translateBackendError(enT, {
      detail: "fallback",
      error_code: "image_search.no_results",
    }),
    /Slide text is unaffected/,
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
    const translated = translateBackendError(viT, {
      detail: "Legacy detail",
      error_code,
    });
    assert.notEqual(translated, "Legacy detail", error_code);
    assert.ok(translated.trim(), error_code);
  }
  assert.match(
    translateBackendError(viT, {
      detail: "Too many",
      error_code: "error.slides_too_many",
      error_params: { max: 20 },
    }),
    /20/,
  );
  assert.equal(
    translateBackendError(viT, { detail: "Legacy backend detail" }),
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
    traceCodes.filter((code) => !(code in BACKEND_STATUS_KEYS)),
    [],
  );
});
