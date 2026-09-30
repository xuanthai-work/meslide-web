"use client";

import {
  ArrowUp,
  ChevronDown,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Plus,
  RefreshCw,
  Square,
  X,
  UserRound,
} from "lucide-react";
import {
  type ChangeEvent,
  type ClipboardEvent,
  type Dispatch,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import MarkdownRenderer from "@/components/MarkDownRender";
import ToolTip from "@/components/ToolTip";
import { cn } from "@/lib/utils";
import { TemplateV2HtmlSlidePreview } from "../../../components/TemplateV2HtmlSlidePreview";
import {
  editorQuickPrompts,
  presentationQuickPrompts,
  suggestions,
  templateV2QuickPrompts,
} from "./chat-prompts";
import type {
  ChatDocumentAttachment,
  ChatLink,
  ChatMessage,
  PastedChatImage,
} from "./chat-types";
import { createChatLayoutPreviewSlide } from "./chat-utils";
import {
  localizeActivityLabelText,
  localizeQuickPromptText,
} from "./chat-i18n";
import { stripBackendContextFromUserMessage } from "./chat-activity";
import { AssistantMarker } from "./chat-widgets";

export type ChatPresentationLayoutProps = {
  messages: ChatMessage[];
  isSending: boolean;
  isHistoryLoading: boolean;
  chatInputDisabled: boolean;
  isTemplateV2Variant: boolean;
  showEditorEmptyState: boolean;
  input: string;
  errorMessage: string | null;
  pastedImages: PastedChatImage[];
  attachedDocuments: ChatDocumentAttachment[];
  chatLinks: ChatLink[];
  isUploadingPastedImage: boolean;
  isDraggingAttachment: boolean;
  isFollowAgentEnabled: boolean;
  chatSlideReference: string;
  chatTargetReference: string;
  activeAssistantMessageId: string | null;
  expandedActivityByMessage: Record<string, boolean>;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  resetChat: () => void | Promise<void>;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
  handleDragOver: (event: DragEvent<HTMLElement>) => void;
  handleDragLeave: (event: DragEvent<HTMLElement>) => void;
  handleDrop: (event: DragEvent<HTMLElement>) => void;
  handleAttachmentInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleInputChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  handlePaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  handleKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  applyPrompt: (prompt: string) => void;
  stopStreaming: () => void;
  toggleActivityExpanded: (messageId: string) => void;
  onClearChatSlideReference?: () => void;
  clearChatTargetReference?: () => void;
  setChatLinks: Dispatch<SetStateAction<ChatLink[]>>;
  setPastedImages: Dispatch<SetStateAction<PastedChatImage[]>>;
  setAttachedDocuments: Dispatch<SetStateAction<ChatDocumentAttachment[]>>;
  setIsFollowAgentEnabled: Dispatch<SetStateAction<boolean>>;
};

export function ChatPresentationLayout({
  messages,
  isSending,
  isHistoryLoading,
  chatInputDisabled,
  isTemplateV2Variant,
  showEditorEmptyState,
  input,
  errorMessage,
  pastedImages,
  attachedDocuments,
  chatLinks,
  isUploadingPastedImage,
  isDraggingAttachment,
  isFollowAgentEnabled,
  chatSlideReference,
  chatTargetReference,
  activeAssistantMessageId,
  expandedActivityByMessage,
  inputRef,
  fileInputRef,
  messagesEndRef,
  resetChat,
  handleSubmit,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleAttachmentInputChange,
  handleInputChange,
  handlePaste,
  handleKeyDown,
  applyPrompt,
  stopStreaming,
  toggleActivityExpanded,
  onClearChatSlideReference,
  clearChatTargetReference,
  setChatLinks,
  setPastedImages,
  setAttachedDocuments,
  setIsFollowAgentEnabled,
}: ChatPresentationLayoutProps) {
  const localizeQuickPrompt = (value: string) =>
    localizeQuickPromptText(value);
  const localizeActivityLabel = (value: string) =>
    localizeActivityLabelText(value);

  return (
    <div
      className="flex h-full w-full flex-col bg-white"
      style={
        showEditorEmptyState
          ? {
            background:
              "radial-gradient(ellipse 90% 42% at 66% 18%, rgba(218, 243, 255, 0.78) 0, rgba(230, 242, 255, 0.42) 35%, transparent 72%), radial-gradient(ellipse 85% 38% at 35% 47%, rgba(244, 226, 255, 0.72) 0, rgba(249, 237, 255, 0.34) 40%, transparent 75%), #fff",
          }
          : undefined
      }
    >
      {!showEditorEmptyState && (
        <div className="flex items-center justify-between px-4 pt-8">
          <div className="flex items-center gap-2">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-[#101828]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M19.1407 9.46542C16.5537 9.21616 14.5067 7.17009 14.2577 4.58528L13.8376 0.220703L13.4175 4.58528C13.1685 7.17053 11.1215 9.2166 8.53451 9.46542L4.1731 9.88521L8.53451 10.305C11.1215 10.5543 13.1685 12.6003 13.4175 15.1852L13.8376 19.5497L14.2577 15.1852C14.5067 12.5999 16.5537 10.5538 19.1407 10.305L23.5021 9.88521L19.1407 9.46542Z"
                  fill="#1D6FE8"
                />
                <path
                  d="M9.07681 16.8431C7.62808 16.7035 6.48175 15.5577 6.34232 14.1102L6.10707 11.666L5.87183 14.1102C5.7324 15.5579 4.58606 16.7037 3.13734 16.8431L0.694946 17.0781L3.13734 17.3132C4.58606 17.4528 5.7324 18.5986 5.87183 20.0461L6.10707 22.4903L6.34232 20.0461C6.48175 18.5984 7.62808 17.4526 9.07681 17.3132L11.5192 17.0781L9.07681 16.8431Z"
                  fill="#1D6FE8"
                />
              </svg>
              {"Trợ lý AI"}
            </h4>
            {isSending && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--gslide-accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--gslide-accent)]">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                {"Trực tiếp"}
              </span>
            )}
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => void resetChat()}
              disabled={isSending || isHistoryLoading}
              className="rounded-full p-1 text-[#8C8C8C] transition-colors hover:bg-[#F7F7F7] hover:text-[#191919] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={"Đặt lại cuộc trò chuyện"}
              title={"Đặt lại cuộc trò chuyện"}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      <div
        className={cn(
          "min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-4 [scrollbar-color:#C7CBD6_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#C7CBD6] [&::-webkit-scrollbar-track]:bg-transparent",
          showEditorEmptyState ? "flex items-center justify-center" : "pt-9",
        )}
      >
        {isHistoryLoading && messages.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-[#99A1AF]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {"Đang tải cuộc trò chuyện…"}
          </div>
        ) : showEditorEmptyState ? (
          <h3 className="-translate-y-7 text-center text-[clamp(20px,1.55vw,24px)] font-normal leading-[1.08] tracking-[-0.72px] text-[#4A4A4A]">
            {"Hôm nay tôi có thể giúp gì cho bài thuyết trình của bạn?"}
          </h3>
        ) : messages.length === 0 ? (
          <>
            {isTemplateV2Variant ? (
              <div>
                <h4 className="mb-2 text-[10px] font-normal leading-[15px] tracking-[0.367px] text-[#99A1AF]">
                  {"LỜI NHẮC NHANH"}
                </h4>
                <div className="flex flex-wrap gap-2">
                  {templateV2QuickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => applyPrompt(prompt)}
                      className="cursor-pointer rounded-lg border border-[var(--gslide-border)] bg-white px-2.5 py-1 text-left transition-colors hover:bg-[var(--gslide-accent-soft)]"
                    >
                      <span className="text-[11px] font-normal leading-[15px] tracking-[0.367px] text-[#364153]">
                        {localizeQuickPrompt(prompt)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div>
                  <h4 className="mb-2 text-[10px] font-normal leading-[15px] tracking-[0.367px] text-[#99A1AF]">
                    {"GỢI Ý"}
                  </h4>
                  <div className="flex flex-col gap-1.5">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        onClick={() => applyPrompt(suggestion.suggestion)}
                        className="group flex min-h-[34px] cursor-pointer items-center justify-between gap-3 rounded-lg border border-[var(--gslide-border)] bg-white px-3 py-2 text-left transition-colors hover:bg-[var(--gslide-accent-soft)]"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span className="shrink-0">{suggestion.icon}</span>
                          <span className="text-xs font-normal leading-[15px] tracking-[0.367px] text-[#364153]">
                            {localizeQuickPrompt(suggestion.suggestion)}
                          </span>
                        </span>
                        <ChevronRight className="h-3 w-3 shrink-0 text-[#D6D9E0] transition-colors group-hover:text-[#99A1AF]" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-10">
                  <h4 className="mb-2 text-[10px] font-normal leading-[15px] tracking-[0.367px] text-[#99A1AF]">
                    {"LỜI NHẮC NHANH"}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {presentationQuickPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => applyPrompt(prompt)}
                        className="cursor-pointer rounded-lg border border-[var(--gslide-border)] bg-white px-2.5 py-1 transition-colors hover:bg-[var(--gslide-accent-soft)]"
                      >
                        <span className="text-xs font-normal leading-[15px] tracking-[0.367px] text-[#364153]">
                          {localizeQuickPrompt(prompt)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-7">
            {messages.map((message) =>
              message.role === "user" ? (
                <div
                  key={message.id}
                  className="flex items-start justify-end gap-2.5"
                >
                  <div
                    className={cn(
                      "flex min-w-0 max-w-[80%] flex-col items-end gap-2",
                      message.layoutPreview && "w-[220px]",
                    )}
                  >
                    {message.layoutPreview && (
                      <div className="w-full overflow-hidden rounded-[12px] border border-[#EDE7FF] bg-white p-1.5 shadow-sm">
                        <TemplateV2HtmlSlidePreview
                          slide={createChatLayoutPreviewSlide(
                            message.layoutPreview,
                          )}
                          className="rounded-[8px]"
                        />
                        <p className="px-1 pb-0.5 pt-1.5 text-[10px] font-medium text-[#667085]">
                          Selected layout
                        </p>
                      </div>
                    )}
                    <div className="w-fit max-w-full rounded-[18px] bg-[var(--gslide-accent)] px-4 py-3 text-[13px] font-medium leading-5 text-white shadow-sm [overflow-wrap:anywhere] [word-break:break-word]">
                      <p className="whitespace-pre-wrap">
                        {stripBackendContextFromUserMessage(message.content)}
                      </p>
                    </div>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FF8617] text-white">
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                  </div>
                </div>
              ) : (
                <div
                  key={message.id}
                  className="min-w-0 max-w-[92%] [overflow-wrap:anywhere] [word-break:break-word]"
                >
                  <AssistantMarker />
                  {message.content ? (
                    message.role === "error" ? (
                      <div className="whitespace-pre-wrap rounded-[12px] bg-red-50 px-3 py-2 text-[13px] font-normal leading-5 text-red-700 [overflow-wrap:anywhere] [word-break:break-word]">
                        {message.content}
                      </div>
                    ) : (
                      <div className="chat-markdown mb-0 text-[13px] font-normal leading-6 text-[#3F4652]">
                        <MarkdownRenderer
                          content={message.content}
                          className="chat-markdown mb-0 text-[13px] font-normal leading-6 text-[#3F4652]"
                        />
                        {isSending &&
                          message.id === activeAssistantMessageId && (
                            <span
                              aria-hidden="true"
                              className="ml-1 inline-block h-4 w-0.5 animate-pulse rounded-full bg-[#98A2B3] align-middle"
                            />
                          )}
                      </div>
                    )
                  ) : (
                    <div className="text-[13px] font-normal leading-6 text-[#667085]">
                      {isSending && message.role === "assistant"
                        ? message.activity?.[message.activity.length - 1]
                          ?.label
                          ? localizeActivityLabel(
                              message.activity[message.activity.length - 1].label,
                            )
                          : "Đang xử lý…"
                        : ""}
                    </div>
                  )}
                  {message.activity && message.activity.length > 0 && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => toggleActivityExpanded(message.id)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#F8FAFC] px-2.5 py-1 text-left text-[11px] font-medium text-[#667085] transition-colors hover:bg-[#F1F5F9] hover:text-[#475467]"
                      >
                        {expandedActivityByMessage[message.id] ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        <span>{"Đang suy nghĩ"}</span>
                        {message.activity.some(
                          (item) => item.state === "running"
                        ) && (
                            <Loader2 className="h-3 w-3 animate-spin text-[#98A2B3]" />
                          )}
                      </button>

                      {expandedActivityByMessage[message.id] && (
                        <div className="mt-2 space-y-1 rounded-[12px] bg-[#F8FAFC] px-3 py-2">
                          {message.activity.map((activityItem) => (
                            <div
                              key={activityItem.id}
                              className="flex items-start gap-2 text-[12px] leading-5 text-[#667085]"
                            >
                              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#CBD5E1]" />
                              <span>{localizeActivityLabel(activityItem.label)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        onDragEnterCapture={handleDragOver}
        onDragOverCapture={handleDragOver}
        onDragLeave={handleDragLeave}
        onDropCapture={handleDrop}
        className={cn(
          "overflow-x-hidden rounded-[8px] border bg-white px-2.5 py-3 transition-colors",
          showEditorEmptyState ? "ml-[18px] mr-1" : "mx-4",
          showEditorEmptyState ? "mb-2" : "mb-4",
          isDraggingAttachment
            ? "border-[var(--gslide-accent)] bg-[var(--gslide-accent-soft)]"
            : "border-[#F4F4F4]"
        )}
        style={{
          boxShadow: "0 4px 14px 0 rgba(0, 0, 0, 0.04)",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          disabled={chatInputDisabled}
          accept="image/*,.pdf,.txt,.docx,.docm,.odt,.pptx,.pptm,.odp,.xlsx,.xlsm,.ods,.csv,.tsv,.tif,.tiff"
          className="hidden"
          onChange={handleAttachmentInputChange}
          aria-hidden="true"
          tabIndex={-1}
        />
        {(chatSlideReference || chatTargetReference) && (
          <div
            className="mb-2 flex max-w-full items-center gap-1.5 overflow-hidden"
            aria-label={"Đối tượng đang chọn trong trình chỉnh sửa"}
          >
            {chatSlideReference && (
              <span
                className="inline-flex h-7 max-w-[86px] shrink-0 items-center gap-1 rounded-full border border-[var(--gslide-border)] bg-[var(--gslide-accent-soft)] pl-2.5 pr-1 font-manrope text-[11px] font-semibold text-[var(--gslide-accent)]"
                title={chatSlideReference}
              >
                <span className="truncate">{chatSlideReference}</span>
                {onClearChatSlideReference && (
                  <button
                    type="button"
                    onClick={onClearChatSlideReference}
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[var(--gslide-muted)] transition-colors hover:bg-[var(--gslide-accent-soft)] hover:text-[var(--gslide-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gslide-accent)]/40"
                    aria-label={`Remove ${chatSlideReference} from context`}
                    title={`Remove ${chatSlideReference} from context`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            )}
            {chatTargetReference && (
              <span
                className="inline-flex h-7 min-w-0 max-w-[138px] items-center gap-1 rounded-full border border-[var(--gslide-border)] bg-[var(--gslide-accent-soft)] pl-2.5 pr-1 font-manrope text-[11px] font-semibold text-[var(--gslide-accent)]"
                title={chatTargetReference}
              >
                <span className="truncate">{chatTargetReference}</span>
                {clearChatTargetReference && (
                  <button
                    type="button"
                    onClick={clearChatTargetReference}
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[var(--gslide-muted)] transition-colors hover:bg-[var(--gslide-accent-soft)] hover:text-[var(--gslide-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gslide-accent)]/40"
                    aria-label={"Bỏ đối tượng đã chọn khỏi ngữ cảnh"}
                    title={"Bỏ đối tượng đã chọn khỏi ngữ cảnh"}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            )}
          </div>
        )}
        {(pastedImages.length > 0 ||
          attachedDocuments.length > 0 ||
          chatLinks.length > 0 ||
          isUploadingPastedImage) && (
            <div className="mb-2 flex max-w-full flex-wrap items-center gap-1.5">
              {chatLinks.map((link) => (
                <span
                  key={link.id}
                  className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-[var(--gslide-border)] bg-[var(--gslide-accent-soft)] px-2 py-1 text-xs font-medium text-[var(--gslide-accent)]"
                >
                  <LinkIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{link.url}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setChatLinks((previous) =>
                        previous.filter((item) => item.id !== link.id)
                      )
                    }
                    className="rounded-full p-0.5 text-[var(--gslide-accent)] transition-colors hover:bg-[var(--gslide-accent-soft)]"
                    aria-label={"Xóa liên kết"}
                    title={"Xóa liên kết"}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {pastedImages.map((image) => (
                <span
                  key={image.id}
                  className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-[var(--gslide-border)] bg-white px-2 py-1 text-xs font-medium text-[var(--gslide-ink)]"
                >
                  <ImageIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{image.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setPastedImages((previous) =>
                        previous.filter((item) => item.id !== image.id)
                      )
                    }
                    className="rounded-full p-0.5 text-[#667085] transition-colors hover:bg-[#E4E7EC]"
                    aria-label={"Xóa hình ảnh đã dán"}
                    title={"Xóa hình ảnh đã dán"}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {attachedDocuments.map((document) => (
                <span
                  key={document.id}
                  className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-[var(--gslide-border)] bg-white px-2 py-1 text-xs font-medium text-[var(--gslide-ink)]"
                >
                  <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">{document.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAttachedDocuments((previous) =>
                        previous.filter((item) => item.id !== document.id)
                      )
                    }
                    className="rounded-full p-0.5 text-[#667085] transition-colors hover:bg-[#E4E7EC]"
                    aria-label={"Xóa tài liệu đính kèm"}
                    title={"Xóa tài liệu đính kèm"}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {isUploadingPastedImage && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--gslide-border)] bg-white px-2 py-1 text-xs font-medium text-[var(--gslide-muted)]">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  Processing attachment
                </span>
              )}
            </div>
          )}
        <textarea
          ref={inputRef}
          name="chat-input"
          id="chat-input"
          className={cn(
            "w-full resize-none overflow-x-hidden bg-transparent text-sm text-[var(--gslide-ink)] placeholder:text-[var(--gslide-muted)] focus:outline-none focus:ring-0 [overflow-wrap:anywhere] [word-break:break-word]",
            showEditorEmptyState ? "min-h-[57px]" : "min-h-[92px]",
          )}
          rows={3}
          wrap="soft"
          value={input}
          disabled={chatInputDisabled}
          onChange={handleInputChange}
          onPaste={handlePaste}
          onDragEnterCapture={handleDragOver}
          onDragOverCapture={handleDragOver}
          onDropCapture={handleDrop}
          onKeyDown={handleKeyDown}
          placeholder={
            showEditorEmptyState
              ? "Hỏi bất kỳ điều gì.\nGõ / để xem lời nhắc nhanh."
              : isTemplateV2Variant
                ? "Đổi tiêu đề slide 2"
                : "Cải thiện thiết kế slide"
          }
          aria-invalid={Boolean(errorMessage)}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-[var(--gslide-border)] bg-white px-3 py-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!isTemplateV2Variant || chatInputDisabled}
                className="inline-flex h-[28px] items-center rounded-[64px] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={"Đính kèm tệp"}
                title={
                  isTemplateV2Variant
                    ? "Đính kèm tệp"
                    : "Tệp đính kèm chỉ dùng được trong chat Template V2."
                }
              >
                <Plus className="h-3 w-3 text-black" />
              </button>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="2"
                height="17"
                viewBox="0 0 2 17"
                fill="none"
              >
                <path d="M1 0V16.5" stroke="#EDECEC" strokeWidth="2" />
              </svg>
              <ToolTip
                content={
                  isFollowAgentEnabled
                    ? "Tắt chế độ theo dõi AI"
                    : "Bật chế độ theo dõi AI"
                }
              >
                <button
                  type="button"
                  onClick={() =>
                    setIsFollowAgentEnabled((previous) => !previous)
                  }
                  disabled={isHistoryLoading || isSending}
                  className="inline-flex h-[28px] items-center gap-1 rounded-[64px] text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={
                    isFollowAgentEnabled
                      ? "Tắt chế độ theo dõi AI"
                      : "Bật chế độ theo dõi AI"
                  }
                  title={
                    isFollowAgentEnabled
                      ? "Theo dõi AI đang bật: tự động chuyển đến slide đang xử lý"
                      : "Theo dõi AI đang tắt"
                  }
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 11 11"
                    fill="none"
                  >
                    <g clipPath="url(#clip0_6216_326)">
                      <path
                        d="M5.50008 10.0837C8.03139 10.0837 10.0834 8.03163 10.0834 5.50033C10.0834 2.96902 8.03139 0.916992 5.50008 0.916992C2.96878 0.916992 0.916748 2.96902 0.916748 5.50033C0.916748 8.03163 2.96878 10.0837 5.50008 10.0837Z"
                        stroke={isFollowAgentEnabled ? "#1D6FE8" : "#000000"}
                        strokeWidth="0.938667"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M10.0833 5.5H8.25"
                        stroke={isFollowAgentEnabled ? "#1D6FE8" : "#000000"}
                        strokeWidth="0.938667"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M2.75008 5.5H0.916748"
                        stroke={isFollowAgentEnabled ? "#1D6FE8" : "#000000"}
                        strokeWidth="0.938667"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M5.5 2.75033V0.916992"
                        stroke={isFollowAgentEnabled ? "#1D6FE8" : "#000000"}
                        strokeWidth="0.938667"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M5.5 10.0833V8.25"
                        stroke={isFollowAgentEnabled ? "#1D6FE8" : "#000000"}
                        strokeWidth="0.938667"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </g>
                    <defs>
                      <clipPath id="clip0_6216_326">
                        <rect width="11" height="11" fill="white" />
                      </clipPath>
                    </defs>
                  </svg>

                </button>
              </ToolTip>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.focus()}
              disabled={chatInputDisabled}
              className="inline-flex h-[30px] items-center gap-1.5 rounded-full border border-[var(--gslide-border)] bg-white px-3 text-[12px] font-medium text-[var(--gslide-muted)] transition-colors hover:bg-[var(--gslide-accent-soft)] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={"Đưa con trỏ vào ô nhập lời nhắc"}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 13 13"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M6.5 1.25c.22 2.93 1.32 4.03 4.25 4.25-2.93.22-4.03 1.32-4.25 4.25-.22-2.93-1.32-4.03-4.25-4.25 2.93-.22 4.03-1.32 4.25-4.25Z"
                  fill="#1D6FE8"
                />
                <path
                  d="M10.5 9.25c.1 1.3.6 1.8 1.9 1.9-1.3.1-1.8.6-1.9 1.9-.1-1.3-.6-1.8-1.9-1.9 1.3-.1 1.8-.6 1.9-1.9Z"
                  fill="#1D6FE8"
                />
              </svg>
              Prompt
            </button>
          </div>
          <div className="ml-auto mr-2 flex items-center gap-2">
            {isSending ? (
              <button
                type="button"
                onClick={stopStreaming}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-[34px] border border-[#E4E7EC] bg-white px-3 py-2 text-sm font-medium text-[#344054] transition-colors hover:bg-[#F9FAFB]"
                aria-label={"Dừng phản hồi"}
              >
                <Loader2
                  className="h-3 w-3 animate-spin text-[#667085]"
                  aria-hidden="true"
                />
                <Square className="h-3 w-3 fill-current" aria-hidden="true" />
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={
                  (!input.trim() &&
                    pastedImages.length === 0 &&
                    attachedDocuments.length === 0 &&
                    chatLinks.length === 0) ||
                  chatInputDisabled ||
                  isUploadingPastedImage
                }
                className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[var(--gslide-accent)] text-white transition hover:bg-[var(--gslide-accent-hover)] transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={"Gửi lời nhắc"}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </form>
      {showEditorEmptyState && (
        <div className="mb-[109px] ml-[18px] mr-1 flex shrink-0 gap-2 overflow-x-auto hide-scrollbar">
          {editorQuickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => applyPrompt(prompt)}
              className="shrink-0 rounded-full border border-[var(--gslide-border)] bg-white px-3 py-1.5 text-[11px] font-normal leading-4 text-[var(--gslide-muted)] transition-colors hover:bg-[var(--gslide-accent-soft)]"
            >
              {localizeQuickPrompt(prompt)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
