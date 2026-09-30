import type { ChatStreamTrace } from "../../../services/api/chat";
import type { AssistantActivity } from "./chat-types";
import {
  translateBackendStatus,
  type BackendStatusCode,
} from "@/lib/backend-messages";

const TOOL_LABELS: Record<string, string> = {
  addOutline: "Outline adder",
  updateOutline: "Outline editor",
  deleteOutline: "Outline remover",
  addNewSlide: "Blank slide adder",
  addNewSlideLayout: "Layout slide adder",
  getAvailableLayouts: "Layout finder",
  getTemplateSummary: "Template reader",
  readSourceDocuments: "Source document reader",
  searchSlide: "Slide search",
  getSlideAtIndex: "Slide reader",
  saveSlide: "Slide saver",
  updateSlide: "Slide updater",
  deleteSlide: "Slide remover",
  addElement: "Element adder",
  updateElement: "Element updater",
  deleteElement: "Element remover",
  addComponent: "Component adder",
  createComponent: "Component creator",
  updateComponent: "Component updater",
  deleteComponent: "Component remover",
  getPresentationTheme: "Theme reader",
  setPresentationTheme: "Theme applier",
  generateAssets: "Asset generator",
};

export const MUTATING_TOOLS = new Set([
  "addOutline",
  "updateOutline",
  "deleteOutline",
  "addNewSlide",
  "addNewSlideLayout",
  "saveSlide",
  "updateSlide",
  "deleteSlide",
  "addElement",
  "updateElement",
  "deleteElement",
  "addComponent",
  "createComponent",
  "updateComponent",
  "deleteComponent",
  "setPresentationTheme",
]);

// Read/open traces can happen ahead of edits and would make follow mode jumpy.
export const SLIDE_FOCUS_TOOLS = new Set([
  "addNewSlide",
  "addNewSlideLayout",
  "saveSlide",
  "updateSlide",
  "deleteSlide",
  "addElement",
  "updateElement",
  "deleteElement",
  "addComponent",
  "createComponent",
  "updateComponent",
  "deleteComponent",
]);

export const SLIDE_FOCUS_STATUSES = new Set(["start"]);
export const MIN_SLIDE_FOCUS_DWELL_MS = 700;

const getToolLabel = (tool?: string) => {
  if (!tool) return "";
  return TOOL_LABELS[tool] ?? tool;
};

const humanizeTraceMessage = (message: string, tool?: string) => {
  const trimmed = message.trim();
  if (!trimmed) return "";

  const lower = trimmed.toLowerCase();
  const exactMessages: Record<string, string> = {
    "reading deck context": "Đang xem lại ngữ cảnh bài thuyết trình.",
    "reading the presentation outline": "Đang đọc dàn ý bài thuyết trình.",
    "reading the outline draft": "Đang đọc bản nháp dàn ý.",
    "adding an outline slide": "Đang thêm slide vào dàn ý.",
    "updating the outline slide": "Đang cập nhật slide trong dàn ý.",
    "deleting the outline slide": "Đang xóa slide khỏi dàn ý.",
    "reordering outline slides": "Đang sắp xếp lại các slide trong dàn ý.",
    "searching relevant slides": "Đang tìm slide có nội dung liên quan.",
    "opening the requested slide": "Đang mở slide đã chọn.",
    "checking available themes": "Đang kiểm tra các chủ đề màu có sẵn.",
    "checking available layouts": "Đang kiểm tra các bố cục có sẵn.",
    "checking the layout schema": "Đang kiểm tra cấu trúc bố cục.",
    "generating slide assets": "Đang tạo hình ảnh và biểu tượng.",
    "saving the slide": "Đang lưu thay đổi slide.",
    "deleting the slide": "Đang xóa slide.",
    "applying presentation theme": "Đang áp dụng chủ đề đã chọn.",
    "reading template structure": "Đang đọc cấu trúc mẫu.",
    "reading source documents": "Đang đọc tài liệu nguồn.",
    "opening the requested template slide": "Đang mở slide mẫu đã chọn.",
    "searching template content": "Đang tìm nội dung trong mẫu.",
    "finding editable elements": "Đang tìm các thành phần có thể chỉnh sửa.",
    "updating template content": "Đang cập nhật nội dung mẫu.",
    "deleting the template component": "Đang xóa thành phần đã chọn.",
    "swapping component variant": "Đang đổi biến thể thành phần.",
  };
  if (exactMessages[lower]) return exactMessages[lower];

  if (lower.startsWith("using tools:")) {
    const toolNames = trimmed
      .slice("using tools:".length)
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => getToolLabel(entry));
    return toolNames.length === 0
      ? "Đang lên kế hoạch cho bước tiếp theo."
      : "Đang chọn cách hỗ trợ phù hợp nhất.";
  }
  if (lower.includes("found requested data")) {
    return tool === "getSlideAtIndex"
      ? "Đã tìm thấy thông tin slide được yêu cầu."
      : "Đã tìm thấy thông tin được yêu cầu.";
  }
  return trimmed;
};

export const inferStatusState = (
  status: string,
  code?: string,
): AssistantActivity["state"] => {
  const codedState: Partial<Record<BackendStatusCode, AssistantActivity["state"]>> = {
    "chat.reading_deck_context": "running",
    "chat.finalizing_response": "running",
    "chat.saving_chat": "running",
  };
  if (code && codedState[code as BackendStatusCode]) {
    return codedState[code as BackendStatusCode] ?? "info";
  }
  const normalized = status.trim().toLowerCase();
  if (
    [
      "preparing",
      "thinking",
      "reading",
      "searching",
      "opening",
      "generating",
      "processing",
      "finalizing",
      "saving",
    ].some((term) => normalized.includes(term))
  ) {
    return "running";
  }
  return "info";
};

export { stripBackendContextFromUserMessage } from "./chat-utils";

export const isAbortError = (error: unknown) =>
  (error instanceof DOMException && error.name === "AbortError") ||
  (error instanceof Error &&
    error.message.toLowerCase().includes("aborted") &&
    error.message.toLowerCase().includes("request"));

const humanActivityForTool = (
  tool: string | undefined,
  state: "start" | "success",
) => {
  const isDone = state === "success";
  switch (tool) {
    case "searchSlide":
      return isDone
        ? "Đã hoàn tất bước này."
        : "Đang tìm nội dung liên quan.";
    case "getSlideAtIndex":
      return isDone ? "Đã hoàn tất bước này." : "Đang kiểm tra thông tin.";
    case "addNewSlide":
    case "addNewSlideLayout":
    case "updateElement":
    case "updateComponent":
    case "addElement":
    case "addComponent":
    case "createComponent":
    case "updateSlide":
    case "saveSlide":
      return isDone ? "Đã hoàn tất bước này." : "Đang áp dụng thay đổi.";
    case "deleteComponent":
    case "deleteElement":
    case "deleteSlide":
      return isDone
        ? "Đã hoàn tất bước này."
        : "Đang xóa mục đã chọn.";
    case "generateAssets":
      return isDone
        ? "Đã hoàn tất bước này."
        : "Đang tạo tài nguyên hình ảnh.";
    case "setPresentationTheme":
      return isDone ? "Đã hoàn tất bước này." : "Đang áp dụng thay đổi.";
    default:
      return isDone ? "Đã hoàn tất bước này." : "Đang xử lý…";
  }
};

export const formatTraceActivity = (
  trace: ChatStreamTrace,
): Omit<AssistantActivity, "id"> | null => {
  if (trace.code) {
    const localizedLabel = translateBackendStatus({
      code: trace.code,
      params: trace.params,
      status: trace.message,
    });
    const preservesDynamicMessage =
      trace.code === "chat.trace.model_note" ||
      trace.code === "chat.trace.tool_result";
    const label =
      preservesDynamicMessage && trace.message?.trim()
        ? `${localizedLabel} ${trace.message.trim()}`
        : localizedLabel;
    if (label) {
      return {
        label,
        kind: trace.kind,
        round: trace.round,
        tool: trace.tool,
        state:
          trace.status === "error"
            ? "error"
            : trace.status === "success"
              ? "success"
              : trace.status === "ready" || trace.status === "info"
                ? "info"
                : "running",
      };
    }
  }
  if (typeof trace.message === "string" && trace.message.trim().length > 0) {
    return {
      label: humanizeTraceMessage(trace.message, trace.tool),
      kind: trace.kind,
      round: trace.round,
      tool: trace.tool,
      state:
        trace.status === "error"
          ? "error"
          : trace.status === "success"
            ? "success"
            : trace.status === "ready" || trace.status === "info"
              ? "info"
              : "running",
    };
  }
  if (trace.tool && trace.status === "start") {
    return {
      label: humanActivityForTool(trace.tool, "start"),
      kind: trace.kind,
      round: trace.round,
      tool: trace.tool,
      state: "running",
    };
  }
  if (trace.tool && trace.status === "success") {
    return {
      label: humanActivityForTool(trace.tool, "success"),
      kind: trace.kind,
      round: trace.round,
      tool: trace.tool,
      state: "success",
    };
  }
  if (trace.tool && trace.status === "error") {
    return {
      label: "Không thể hoàn tất bước này.",
      kind: trace.kind,
      round: trace.round,
      tool: trace.tool,
      state: "error",
    };
  }
  if (trace.kind === "tool_plan" && Array.isArray(trace.tools) && trace.tools.length) {
    return {
      label: "Đang lên kế hoạch cho bước tiếp theo.",
      kind: trace.kind,
      round: trace.round,
      state: "info",
    };
  }
  return null;
};

export const readTraceSlideIndex = (trace: ChatStreamTrace) => {
  if (typeof trace.slideIndex === "number" && trace.slideIndex >= 0) {
    return trace.slideIndex;
  }
  if (typeof trace.slideNumber === "number" && trace.slideNumber > 0) {
    return trace.slideNumber - 1;
  }
  return null;
};

export type SlideFollowDecision =
  | { action: "ignore" }
  | { action: "focus-now"; slideIndex: number; signature: string }
  | { action: "defer"; slideIndex: number; signature: string; waitMs: number };

/** Follow mode only jumps on mutating slide tools, and not faster than the dwell. */
export function decideSlideFollow(input: {
  trace: ChatStreamTrace;
  lastSignature: string | null;
  activeSlide: number | null;
  elapsedMs: number;
}): SlideFollowDecision {
  const { trace, lastSignature, activeSlide, elapsedMs } = input;
  if (!trace.tool || !SLIDE_FOCUS_TOOLS.has(trace.tool)) return { action: "ignore" };
  if (!trace.status || !SLIDE_FOCUS_STATUSES.has(trace.status)) return { action: "ignore" };

  const slideIndex = readTraceSlideIndex(trace);
  if (slideIndex === null) return { action: "ignore" };

  const signature = `${trace.round ?? "?"}:${trace.tool}:${trace.status}:${slideIndex}`;
  if (lastSignature === signature) return { action: "ignore" };

  if (
    activeSlide === null ||
    activeSlide === slideIndex ||
    elapsedMs >= MIN_SLIDE_FOCUS_DWELL_MS
  ) {
    return { action: "focus-now", slideIndex, signature };
  }

  return {
    action: "defer",
    slideIndex,
    signature,
    waitMs: Math.max(MIN_SLIDE_FOCUS_DWELL_MS - elapsedMs, 0),
  };
}
