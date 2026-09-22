import type { MessageKey, Params } from "./types";
import type vi from "./locales/vi";

type AppMessageKey = MessageKey<typeof vi>;
export type BackendMessageParams = Record<string, unknown>;

export const BACKEND_STATUS_KEYS = {
  "outline.preparing": "outline.status.preparing",
  "outline.analyzing_topic": "outline.status.analyzingTopic",
  "outline.searching_provider": "outline.status.searchingProvider",
  "outline.web_research_complete": "outline.status.webResearchComplete",
  "outline.native_search_drafting": "outline.status.nativeSearchDrafting",
  "outline.drafting": "outline.status.drafting",
  "images.searching_web": "presentation.status.searchingWebImages",
  "images.importing": "presentation.status.importingSlideImages",
  "chat.reading_deck_context": "chat.status.readingDeckContext",
  "chat.finalizing_response": "chat.status.finalizingResponse",
  "chat.saving_chat": "chat.status.savingChat",
  "chat.trace.adding_outline_slide": "chat.trace.addingOutlineSlide",
  "chat.trace.updating_outline_slide": "chat.trace.updatingOutlineSlide",
  "chat.trace.deleting_outline_slide": "chat.trace.deletingOutlineSlide",
  "chat.trace.adding_blank_slide": "chat.trace.addingBlankSlide",
  "chat.trace.adding_slide_from_layout": "chat.trace.addingSlideFromLayout",
  "chat.trace.reading_template_summary": "chat.trace.readingTemplateSummary",
  "chat.trace.reading_source_documents": "chat.trace.readingSourceDocuments",
  "chat.trace.searching_relevant_slides": "chat.trace.searchingRelevantSlides",
  "chat.trace.opening_requested_slide": "chat.trace.openingRequestedSlide",
  "chat.trace.checking_available_layouts": "chat.trace.checkingAvailableLayouts",
  "chat.trace.checking_layout_schema": "chat.trace.checkingLayoutSchema",
  "chat.trace.generating_slide_assets": "chat.trace.generatingSlideAssets",
  "chat.trace.saving_slide": "chat.trace.savingSlide",
  "chat.trace.updating_slide": "chat.trace.updatingSlide",
  "chat.trace.deleting_slide": "chat.trace.deletingSlide",
  "chat.trace.adding_slide_element": "chat.trace.addingSlideElement",
  "chat.trace.updating_slide_element": "chat.trace.updatingSlideElement",
  "chat.trace.removing_slide_element": "chat.trace.removingSlideElement",
  "chat.trace.adding_slide_component": "chat.trace.addingSlideComponent",
  "chat.trace.creating_slide_component": "chat.trace.creatingSlideComponent",
  "chat.trace.updating_slide_component": "chat.trace.updatingSlideComponent",
  "chat.trace.removing_slide_component": "chat.trace.removingSlideComponent",
  "chat.trace.checking_available_themes": "chat.trace.checkingAvailableThemes",
  "chat.trace.applying_presentation_theme": "chat.trace.applyingPresentationTheme",
  "chat.trace.running_tool": "chat.trace.runningTool",
  "chat.trace.model_note": "chat.trace.modelNote",
  "chat.trace.using_tools": "chat.trace.usingTools",
  "chat.trace.tool_failed": "chat.trace.toolFailed",
  "chat.trace.tool_result": "chat.trace.toolResult",
  "chat.trace.tool_returned_results": "chat.trace.toolReturnedResults",
  "chat.trace.found_requested_data": "chat.trace.foundRequestedData",
  "chat.trace.no_matching_data": "chat.trace.noMatchingData",
  "chat.trace.tool_completed": "chat.trace.toolCompleted",
  "chat.trace.tool_limit_reached": "chat.trace.toolLimitReached",
} as const satisfies Record<string, AppMessageKey>;

export type BackendStatusCode = keyof typeof BACKEND_STATUS_KEYS;

export const BACKEND_ERROR_KEYS = {
  "error.outline_parse_failed": "errors.backend.outlineParseFailed",
  "error.outline_slide_count": "errors.backend.outlineSlideCount",
  "error.outline_generation_failed": "errors.backend.outlineGenerationFailed",
  "error.slides_generation_failed": "errors.backend.slidesGenerationFailed",
  "error.chat_stream_failed": "errors.backend.chatStreamFailed",
  "error.template_not_found": "errors.backend.templateNotFound",
  "error.template_layout_not_object": "errors.backend.templateLayoutNotObject",
  "error.bundled_template_unavailable": "errors.backend.bundledTemplateUnavailable",
  "error.template_layout_invalid_json": "errors.backend.templateLayoutInvalidJson",
  "error.template_layout_min_one": "errors.backend.templateLayoutMinOne",
  "error.template_id_required": "errors.backend.templateIdRequired",
  "error.template_layout_not_found": "errors.backend.templateLayoutNotFound",
  "error.presentation_not_found": "errors.backend.presentationNotFound",
  "error.slides_must_be_positive": "errors.backend.slidesMustBePositive",
  "error.slides_too_many": "errors.backend.slidesTooMany",
  "error.slides_toc_min": "errors.backend.slidesTocMin",
  "error.prompt_required": "errors.backend.promptRequired",
  "error.outlines_required": "errors.backend.outlinesRequired",
  "error.outlines_too_many": "errors.backend.outlinesTooMany",
  "error.layout_min_one": "errors.backend.layoutMinOne",
  "error.not_prepared_for_stream": "errors.backend.notPreparedForStream",
  "error.outlines_empty": "errors.backend.outlinesEmpty",
  "error.presentation_data_invalid": "errors.backend.presentationDataInvalid",
  "error.presentation_layout_empty": "errors.backend.presentationLayoutEmpty",
  "error.presentation_structure_mismatch": "errors.backend.presentationStructureMismatch",
  "error.presentation_layout_invalid": "errors.backend.presentationLayoutInvalid",
  "error.uuid_required": "errors.backend.uuidRequired",
  "error.slide_not_found": "errors.backend.slideNotFound",
  "error.slide_mismatch": "errors.backend.slideMismatch",
  "error.content_required": "errors.backend.contentRequired",
  "error.generation_failed": "errors.backend.generationFailed",
  "error.generation_task_not_found": "errors.backend.generationTaskNotFound",
  "error.image.invalid_type": "errors.backend.imageInvalidType",
  "error.image.empty_file": "errors.backend.imageEmptyFile",
  "error.image.unsupported_format": "errors.backend.imageUnsupportedFormat",
  "error.image.invalid_image": "errors.backend.imageInvalidImage",
  "error.image.retrieve_generated_failed": "errors.backend.imageRetrieveGeneratedFailed",
  "error.image.upload_failed": "errors.backend.imageUploadFailed",
  "error.image.list_uploaded_failed": "errors.backend.imageListUploadedFailed",
  "error.image.not_found": "errors.backend.imageNotFound",
  "error.image.delete_failed": "errors.backend.imageDeleteFailed",
  "error.file.documents_required": "errors.backend.documentsRequired",
  "error.file.too_large": "errors.backend.fileTooLarge",
  "error.file.type_not_accepted": "errors.backend.fileTypeNotAccepted",
  "error.file.required": "errors.backend.fileRequired",
  "error.template.not_found": "errors.backend.templateResourceNotFound",
  "error.template.builtin_readonly": "errors.backend.templateBuiltinReadonly",
  "error.template.images_required": "errors.backend.templateImagesRequired",
  "error.template.exactly_one_image": "errors.backend.templateExactlyOneImage",
  "error.template.pptx_not_found": "errors.backend.templatePptxNotFound",
  "error.template.layout_generation_invalid": "errors.backend.templateLayoutGenerationInvalid",
  "error.template.pptx_json_invalid": "errors.backend.templatePptxJsonInvalid",
  "error.template.invalid_slide_index": "errors.backend.templateInvalidSlideIndex",
  "error.template.patched_layouts_invalid": "errors.backend.templatePatchedLayoutsInvalid",
  "error.template.layouts_invalid": "errors.backend.templateLayoutsInvalid",
  "error.template.layouts_unavailable": "errors.backend.templateLayoutsUnavailable",
  "error.template.raw_layouts_unavailable": "errors.backend.templateRawLayoutsUnavailable",
  "error.template.raw_layouts_invalid": "errors.backend.templateRawLayoutsInvalid",
  "error.template.slide_image_unavailable": "errors.backend.templateSlideImageUnavailable",
  "error.template.layout_creation_invalid": "errors.backend.templateLayoutCreationInvalid",
  "error.template.id_mismatch": "errors.backend.templateIdMismatch",
  "error.template.name_required": "errors.backend.templateNameRequired",
  "error.template.merged_components_invalid": "errors.backend.templateMergedComponentsInvalid",
  "error.theme.invalid_logo_id": "errors.backend.themeInvalidLogoId",
  "error.theme.logo_not_found": "errors.backend.themeLogoNotFound",
  "error.theme.not_found": "errors.backend.themeNotFound",
  "error.provider.invalid_api_key": "errors.backend.providerInvalidApiKey",
  "error.provider.safety_blocked": "errors.backend.providerSafetyBlocked",
  "error.provider.image_safety_placeholder": "errors.backend.providerImageSafetyPlaceholder",
  "error.provider.generic": "errors.backend.providerGeneric",
  "error.provider.quota": "errors.backend.providerQuota",
  "error.provider.key_access": "errors.backend.providerKeyAccess",
  "error.provider.rate_limited": "errors.backend.providerRateLimited",
  "error.provider.model_unavailable": "errors.backend.providerModelUnavailable",
  "error.image.generation_failed": "errors.backend.imageGenerationFailed",
  "image_search.disabled": "errors.backend.imageSearchDisabled",
  "image_search.not_configured": "errors.backend.imageSearchNotConfigured",
  "image_search.empty_query": "errors.backend.imageSearchEmptyQuery",
  "image_search.no_results": "errors.backend.imageSearchNoResults",
  "image_search.search_timeout": "errors.backend.imageSearchSearchTimeout",
  "image_search.import_timeout": "errors.backend.imageSearchImportTimeout",
  "image_search.download_failed": "errors.backend.imageSearchDownloadFailed",
  "image_search.candidate_rejected": "errors.backend.imageSearchCandidateRejected",
  "image_search.importer_unavailable": "errors.backend.imageSearchImporterUnavailable",
  "image_search.no_usable_candidate": "errors.backend.imageSearchNoUsableCandidate",
  "image_search.placeholder_fallback": "errors.backend.imageSearchPlaceholderFallback",
} as const satisfies Record<string, AppMessageKey>;

export type BackendErrorCode = keyof typeof BACKEND_ERROR_KEYS;

export interface BackendStatusPayload {
  status?: unknown;
  status_code?: unknown;
  status_params?: BackendMessageParams | null;
  code?: unknown;
  params?: BackendMessageParams | null;
}

export interface BackendErrorPayload {
  detail?: unknown;
  error_code?: unknown;
  error_params?: BackendMessageParams | null;
}

type TranslateLike = (key: AppMessageKey, params?: Params) => string;

function normalizeParams(value: BackendMessageParams | null | undefined): Params | undefined {
  if (!value) return undefined;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      typeof item === "string" || typeof item === "number"
        ? item
        : Array.isArray(item)
          ? item.join(", ")
          : String(item ?? ""),
    ]),
  );
}

export function translateBackendStatus(
  t: TranslateLike,
  payload: BackendStatusPayload,
): string {
  const code = typeof payload.status_code === "string"
    ? payload.status_code
    : typeof payload.code === "string"
      ? payload.code
      : undefined;
  const key = code
    ? BACKEND_STATUS_KEYS[code as BackendStatusCode]
    : undefined;
  if (key) return t(key, normalizeParams(payload.status_params ?? payload.params));
  return typeof payload.status === "string" ? payload.status : "";
}

export function translateBackendError(
  t: TranslateLike,
  payload: BackendErrorPayload,
): string {
  const code = typeof payload.error_code === "string" ? payload.error_code : undefined;
  const key = code ? BACKEND_ERROR_KEYS[code as BackendErrorCode] : undefined;
  if (key) return t(key, normalizeParams(payload.error_params));
  return typeof payload.detail === "string" ? payload.detail : "";
}
