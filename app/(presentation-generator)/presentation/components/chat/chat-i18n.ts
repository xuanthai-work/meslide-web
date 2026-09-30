/**
 * Vietnamese copy for chat quick prompts and activity labels. Quick prompts
 * arrive from the backend as English strings; this map renders the known
 * prompts in Vietnamese while passing unknown values through untouched.
 */

const QUICK_PROMPT_LABELS: Record<string, string> = {
  Popular: "Phổ biến",
  "Add Data": "Thêm dữ liệu",
  "Add Visuals": "Thêm hình ảnh",
  Structure: "Cấu trúc",
  "Refine Content": "Tinh chỉnh nội dung",
  "Generate a full presentation from my topic":
    "Tạo bài thuyết trình hoàn chỉnh từ chủ đề của tôi",
  "Improve this slide content": "Cải thiện nội dung slide này",
  "Rewrite this content professionally":
    "Viết lại nội dung này theo phong cách chuyên nghiệp",
  "Add speaker notes to this slide": "Thêm ghi chú thuyết trình cho slide này",
  "Expand outline": "Mở rộng dàn ý",
  "Expand the outline": "Mở rộng dàn ý",
  "Shorten outline": "Rút gọn dàn ý",
  "Make the outline shorter": "Rút gọn dàn ý",
  "Reorder sections": "Sắp xếp lại các phần",
  "Reorder the sections": "Sắp xếp lại các phần",
  "Merge similar slides": "Gộp các slide tương tự",
  "Split large sections": "Chia nhỏ các phần dài",
  "Improve conclusion": "Cải thiện phần kết luận",
  "Improve the conclusion": "Cải thiện phần kết luận",
  "Improve introduction": "Cải thiện phần mở đầu",
  "Improve the introduction": "Cải thiện phần mở đầu",
  "Create an executive summary": "Tạo bản tóm tắt điều hành",
  "Strengthen the story flow": "Làm mạch kể chuyện chặt chẽ hơn",
  "Add data and citations": "Thêm dữ liệu và trích dẫn",
  "Create speaker notes": "Tạo ghi chú thuyết trình",
  "Improve this slide's layout": "Cải thiện bố cục slide",
  "Improve slide layout": "Cải thiện bố cục slide",
  "Rewrite this slide for executives": "Viết lại cho đối tượng lãnh đạo",
  "Rewrite for executives": "Viết lại cho đối tượng lãnh đạo",
  "Add a supporting visual": "Thêm hình ảnh minh họa",
  "Make the deck visually consistent":
    "Đồng bộ hình ảnh toàn bộ bài thuyết trình",
  "Make the deck consistent": "Đồng bộ hình ảnh toàn bộ bài thuyết trình",
  "Add data and source citations": "Thêm dữ liệu và trích dẫn nguồn",
  "Create speaker notes for this slide": "Tạo ghi chú cho slide này",
  "Make it shorter": "Viết ngắn gọn hơn",
  "Make this smaller": "Thu nhỏ đối tượng này",
  "Generate a new image and replace this one":
    "Tạo hình ảnh mới và thay hình hiện tại",
  "Add a chart": "Thêm biểu đồ",
  "Add a table": "Thêm bảng",
  "Make the outline concise": "Làm dàn ý súc tích hơn",
};

export function localizeQuickPromptText(value: string) {
  return QUICK_PROMPT_LABELS[value] ?? value;
}

export function localizeActivityLabelText(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("could not") || normalized.includes("failed"))
    return "Không thể hoàn tất bước này.";
  if (normalized.includes("planning") || normalized.includes("choosing"))
    return "Đang lên kế hoạch cho bước tiếp theo.";
  if (normalized.includes("reading") || normalized.includes("reviewing"))
    return "Đang đọc nội dung liên quan.";
  if (normalized.includes("searching") || normalized.includes("looking"))
    return "Đang tìm nội dung liên quan.";
  if (normalized.includes("opening")) return "Đang mở nội dung đã chọn.";
  if (normalized.includes("checking") || normalized.includes("validating"))
    return "Đang kiểm tra thông tin.";
  if (
    normalized.includes("generating") ||
    normalized.includes("preparing visual")
  )
    return "Đang tạo tài nguyên hình ảnh.";
  if (normalized.includes("saving")) return "Đang lưu thay đổi.";
  if (normalized.includes("applying") || normalized.includes("updating"))
    return "Đang áp dụng thay đổi.";
  if (normalized.includes("deleting") || normalized.includes("removing"))
    return "Đang xóa mục đã chọn.";
  if (
    normalized.includes("finished") ||
    normalized.includes("found") ||
    normalized.includes("applied") ||
    normalized.includes("updated") ||
    normalized.includes("prepared") ||
    normalized.includes("checked")
  )
    return "Đã hoàn tất bước này.";
  return value;
}
