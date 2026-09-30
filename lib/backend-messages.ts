/**
 * Backend status/error code → Vietnamese user-facing message.
 *
 * The backend emits stable codes (`status_code` / `error_code`) plus optional
 * interpolation params. Messages are inlined here directly; {@link translateBackendStatus}
 * and {@link translateBackendError} own the code→message lookup and the
 * `{param}` interpolation so no runtime i18n catalog is needed.
 */

export const BACKEND_STATUS_MESSAGES = {
  "outline.preparing": "Đang chuẩn bị dàn ý bài thuyết trình",
  "outline.analyzing_topic": "Đang phân tích chủ đề để nghiên cứu trên web",
  "outline.searching_provider": "Đang tìm kiếm bằng {provider}: {query}",
  "outline.web_research_complete": "Đã hoàn tất nghiên cứu trên web",
  "outline.native_search_drafting": "Đang dùng kết quả tìm kiếm để soạn dàn ý",
  "outline.drafting": "Đang soạn dàn ý bài thuyết trình",
  "images.searching_web": "Đang tìm hình ảnh trên web cho slide",
  "images.importing": "Đang tải hình ảnh cho slide",
  "chat.reading_deck_context": "Đang đọc ngữ cảnh bài thuyết trình",
  "chat.finalizing_response": "Đang hoàn thiện phản hồi",
  "chat.saving_chat": "Đang lưu cuộc trò chuyện",
  "chat.trace.adding_outline_slide": "Đang thêm slide vào dàn ý.",
  "chat.trace.updating_outline_slide": "Đang cập nhật slide trong dàn ý.",
  "chat.trace.deleting_outline_slide": "Đang xóa slide khỏi dàn ý.",
  "chat.trace.adding_blank_slide": "Đang thêm slide trắng.",
  "chat.trace.adding_slide_from_layout": "Đang thêm slide từ bố cục.",
  "chat.trace.reading_template_summary": "Đang đọc thông tin mẫu.",
  "chat.trace.reading_source_documents": "Đang đọc tài liệu nguồn.",
  "chat.trace.searching_relevant_slides": "Đang tìm các slide liên quan.",
  "chat.trace.opening_requested_slide": "Đang mở slide được yêu cầu.",
  "chat.trace.checking_available_layouts": "Đang kiểm tra các bố cục có sẵn.",
  "chat.trace.checking_layout_schema": "Đang kiểm tra cấu trúc bố cục.",
  "chat.trace.generating_slide_assets": "Đang tạo hình ảnh và biểu tượng.",
  "chat.trace.saving_slide": "Đang lưu slide.",
  "chat.trace.updating_slide": "Đang cập nhật slide.",
  "chat.trace.deleting_slide": "Đang xóa slide.",
  "chat.trace.adding_slide_element": "Đang thêm phần tử vào slide.",
  "chat.trace.updating_slide_element": "Đang cập nhật phần tử trên slide.",
  "chat.trace.removing_slide_element": "Đang xóa phần tử khỏi slide.",
  "chat.trace.adding_slide_component": "Đang thêm thành phần vào slide.",
  "chat.trace.creating_slide_component": "Đang tạo thành phần cho slide.",
  "chat.trace.updating_slide_component": "Đang cập nhật thành phần trên slide.",
  "chat.trace.removing_slide_component": "Đang xóa thành phần khỏi slide.",
  "chat.trace.checking_available_themes": "Đang kiểm tra các chủ đề có sẵn.",
  "chat.trace.applying_presentation_theme": "Đang áp dụng chủ đề bài thuyết trình.",
  "chat.trace.running_tool": "Đang chạy {tool}.",
  "chat.trace.model_note": "AI đang phân tích yêu cầu.",
  "chat.trace.using_tools": "Đang chọn cách xử lý phù hợp.",
  "chat.trace.tool_failed": "Không thể hoàn tất thao tác công cụ.",
  "chat.trace.tool_result": "Đã nhận kết quả từ công cụ.",
  "chat.trace.tool_returned_results": "{tool} đã trả về {count} kết quả.",
  "chat.trace.found_requested_data": "Đã tìm thấy thông tin được yêu cầu.",
  "chat.trace.no_matching_data": "Không tìm thấy thông tin phù hợp.",
  "chat.trace.tool_completed": "Đã hoàn tất thao tác.",
  "chat.trace.tool_limit_reached": "Đã đạt giới hạn thao tác; đang chuẩn bị tóm tắt tốt nhất có thể.",
} as const;

export type BackendStatusCode = keyof typeof BACKEND_STATUS_MESSAGES;

export const BACKEND_ERROR_MESSAGES = {
  "error.outline_parse_failed": "Không thể đọc dàn ý đã tạo. Vui lòng thử lại.",
  "error.outline_slide_count": "Không thể tạo dàn ý với số slide yêu cầu. Vui lòng thử lại.",
  "error.outline_generation_failed": "Tạo dàn ý thất bại. Vui lòng thử lại.",
  "error.slides_generation_failed": "Tạo slide thất bại. Vui lòng thử lại.",
  "error.chat_stream_failed": "Luồng trợ lý bị lỗi. Vui lòng thử lại.",
  "error.template_not_found": "Không tìm thấy mẫu. Vui lòng chọn mẫu hợp lệ.",
  "error.template_layout_not_object": "JSON bố cục mẫu phải là một đối tượng.",
  "error.bundled_template_unavailable": "Mẫu tích hợp “{template_name}” hiện không khả dụng. Hãy khởi động lại dịch vụ để nhập lại mẫu.",
  "error.template_layout_invalid_json": "JSON bố cục mẫu không hợp lệ.",
  "error.template_layout_min_one": "Mẫu phải có ít nhất một bố cục.",
  "error.template_id_required": "Cần có ID mẫu.",
  "error.template_layout_not_found": "Không tìm thấy bố cục mẫu.",
  "error.presentation_not_found": "Không tìm thấy bài thuyết trình.",
  "error.slides_must_be_positive": "Số slide phải lớn hơn 0.",
  "error.slides_too_many": "Số slide không được vượt quá {max}.",
  "error.slides_toc_min": "Cần ít nhất 3 slide khi có mục lục.",
  "error.prompt_required": "Cần có lời nhắc hoặc tài liệu.",
  "error.outlines_required": "Cần có dàn ý.",
  "error.outlines_too_many": "Số dàn ý không được vượt quá {max}.",
  "error.layout_min_one": "Bố cục phải chứa ít nhất một bố cục slide.",
  "error.not_prepared_for_stream": "Bài thuyết trình chưa sẵn sàng để tạo.",
  "error.outlines_empty": "Dàn ý không được để trống.",
  "error.presentation_data_invalid": "Dữ liệu bài thuyết trình đã tạo không hợp lệ.",
  "error.presentation_layout_empty": "Bố cục bài thuyết trình không có slide.",
  "error.presentation_structure_mismatch": "Cấu trúc bài thuyết trình có nhiều slide hơn dàn ý.",
  "error.presentation_layout_invalid": "Cấu trúc bài thuyết trình chứa bố cục slide không hợp lệ.",
  "error.uuid_required": "ID slide và bài thuyết trình phải là UUID hợp lệ.",
  "error.slide_not_found": "Không tìm thấy slide.",
  "error.slide_mismatch": "Slide không thuộc bài thuyết trình đã cung cấp.",
  "error.content_required": "Cần có nội dung, markdown slide hoặc tệp để tạo bài thuyết trình.",
  "error.generation_failed": "Tạo bài thuyết trình thất bại.",
  "error.generation_task_not_found": "Không tìm thấy tác vụ tạo bài thuyết trình.",
  "error.image.invalid_type": "Loại tệp ảnh không hợp lệ. Các loại được chấp nhận: {accepted}.",
  "error.image.empty_file": "Tệp ảnh tải lên đang trống.",
  "error.image.unsupported_format": "Định dạng ảnh tải lên không được hỗ trợ.",
  "error.image.invalid_image": "Tệp tải lên không phải ảnh hợp lệ.",
  "error.image.retrieve_generated_failed": "Không thể tải danh sách ảnh đã tạo.",
  "error.image.upload_failed": "Không thể tải ảnh lên.",
  "error.image.list_uploaded_failed": "Không thể tải danh sách ảnh đã tải lên.",
  "error.image.not_found": "Không tìm thấy ảnh.",
  "error.image.delete_failed": "Không thể xóa ảnh.",
  "error.file.documents_required": "Cần có tài liệu.",
  "error.file.too_large": "Tệp “{filename}” vượt quá giới hạn {max_size} MB.",
  "error.file.type_not_accepted": "Không chấp nhận tệp “{filename}”. Các loại được hỗ trợ: {accepted_types}.",
  "error.file.required": "Cần cung cấp tệp.",
  "error.template.not_found": "Không tìm thấy mẫu.",
  "error.template.builtin_readonly": "Không thể chỉnh sửa mẫu tích hợp.",
  "error.template.images_required": "Cần ít nhất một ảnh slide.",
  "error.template.exactly_one_image": "Mỗi bố cục slide cần đúng một ảnh.",
  "error.template.pptx_not_found": "Không tìm thấy tệp PPTX.",
  "error.template.layout_generation_invalid": "Kết quả tạo bố cục slide không hợp lệ.",
  "error.template.pptx_json_invalid": "JSON bố cục slide xuất từ PPTX không hợp lệ.",
  "error.template.invalid_slide_index": "Chỉ số slide không hợp lệ.",
  "error.template.patched_layouts_invalid": "Các bố cục mẫu sau khi cập nhật không hợp lệ.",
  "error.template.layouts_invalid": "Các bố cục mẫu không hợp lệ.",
  "error.template.layouts_unavailable": "Các bố cục mẫu hiện không khả dụng.",
  "error.template.raw_layouts_unavailable": "Dữ liệu bố cục gốc của mẫu hiện không khả dụng.",
  "error.template.raw_layouts_invalid": "Dữ liệu bố cục gốc của mẫu không hợp lệ.",
  "error.template.slide_image_unavailable": "Ảnh slide không khả dụng cho chỉ số được yêu cầu.",
  "error.template.layout_creation_invalid": "Kết quả tạo bố cục slide không hợp lệ.",
  "error.template.id_mismatch": "ID mẫu trên đường dẫn không khớp với nội dung yêu cầu.",
  "error.template.name_required": "Cần có tên mẫu.",
  "error.template.merged_components_invalid": "Các thành phần mẫu đã gộp không hợp lệ.",
  "error.theme.invalid_logo_id": "ID logo không hợp lệ.",
  "error.theme.logo_not_found": "Không tìm thấy logo.",
  "error.theme.not_found": "Không tìm thấy chủ đề.",
  "error.provider.invalid_api_key": "Khóa API không hợp lệ. Vui lòng kiểm tra và thử lại.",
  "error.provider.safety_blocked": "Yêu cầu bị hệ thống an toàn của nhà cung cấp chặn. Hãy điều chỉnh rồi thử lại.",
  "error.provider.image_safety_placeholder": "Yêu cầu ảnh bị hệ thống an toàn chặn. Ảnh giữ chỗ đã được dùng cho slide này.",
  "error.provider.generic": "Nhà cung cấp AI trả về lỗi. Vui lòng thử lại.",
  "error.provider.quota": "Hạn mức API của {provider} hiện không khả dụng. Hãy kiểm tra thanh toán và giới hạn dự án.",
  "error.provider.key_access": "{provider} từ chối yêu cầu vì khóa API không có quyền truy cập.",
  "error.provider.rate_limited": "Nhà cung cấp AI đang giới hạn tần suất. Vui lòng chờ rồi thử lại.",
  "error.provider.model_unavailable": "Mô hình {provider} đã chọn hiện không khả dụng. Hãy chọn mô hình khác hoặc kiểm tra quyền truy cập.",
  "error.image.generation_failed": "Tạo ảnh thất bại. Hãy thử lại hoặc dùng lời nhắc khác.",
  "image_search.disabled": "Tìm ảnh trên web đang bị tắt trên máy chủ này.",
  "image_search.not_configured": "Máy chủ này chưa cấu hình tìm ảnh trên web, nên một số slide dùng ảnh giữ chỗ. Nội dung chữ của slide không bị ảnh hưởng.",
  "image_search.empty_query": "Không tạo được cụm từ tìm ảnh phù hợp, nên slide dùng ảnh giữ chỗ. Nội dung chữ của slide không bị ảnh hưởng.",
  "image_search.no_results": "Không tìm được ảnh web phù hợp cho một số slide, nên các slide đó dùng ảnh giữ chỗ. Nội dung chữ của slide không bị ảnh hưởng.",
  "image_search.search_timeout": "Tìm ảnh trên web quá thời gian chờ, nên các slide dùng ảnh giữ chỗ. Nội dung chữ của slide không bị ảnh hưởng.",
  "image_search.import_timeout": "Tải ảnh web quá thời gian chờ, nên slide dùng ảnh giữ chỗ. Nội dung chữ của slide không bị ảnh hưởng.",
  "image_search.download_failed": "Không tải được ảnh web, nên slide dùng ảnh giữ chỗ. Nội dung chữ của slide không bị ảnh hưởng.",
  "image_search.candidate_rejected": "Các ảnh web bị từ chối vì lý do an toàn hoặc định dạng, nên các slide dùng ảnh giữ chỗ. Nội dung chữ của slide không bị ảnh hưởng.",
  "image_search.importer_unavailable": "Tính năng tải ảnh web hiện không khả dụng, nên các slide dùng ảnh giữ chỗ. Nội dung chữ của slide không bị ảnh hưởng.",
  "image_search.no_usable_candidate": "Không có ảnh nào trong kết quả web tải được, nên các slide dùng ảnh giữ chỗ. Nội dung chữ của slide không bị ảnh hưởng.",
  "image_search.placeholder_fallback": "Không đặt được ảnh web lên một số slide, nên các slide đó dùng ảnh giữ chỗ. Nội dung chữ của slide không bị ảnh hưởng.",
} as const;

export type BackendErrorCode = keyof typeof BACKEND_ERROR_MESSAGES;

export interface BackendStatusPayload {
  status?: unknown;
  status_code?: unknown;
  status_params?: Record<string, unknown> | null;
  code?: unknown;
  params?: Record<string, unknown> | null;
}

export interface BackendErrorPayload {
  detail?: unknown;
  error_code?: unknown;
  error_params?: Record<string, unknown> | null;
}

function normalizeParam(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.join(", ");
  return String(value ?? "");
}

function interpolate(template: string, params?: Record<string, unknown>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(params, name)
      ? normalizeParam(params[name])
      : match,
  );
}

export function translateBackendStatus(payload: BackendStatusPayload): string {
  const code =
    typeof payload.status_code === "string"
      ? payload.status_code
      : typeof payload.code === "string"
        ? payload.code
        : undefined;
  const message = code
    ? BACKEND_STATUS_MESSAGES[code as BackendStatusCode]
    : undefined;
  if (message) {
    return interpolate(message, (payload.status_params ?? payload.params) ?? undefined);
  }
  return typeof payload.status === "string" ? payload.status : "";
}

export function translateBackendError(payload: BackendErrorPayload): string {
  const code =
    typeof payload.error_code === "string" ? payload.error_code : undefined;
  const message = code
    ? BACKEND_ERROR_MESSAGES[code as BackendErrorCode]
    : undefined;
  if (message) return interpolate(message, payload.error_params ?? undefined);
  return typeof payload.detail === "string" ? payload.detail : "";
}
