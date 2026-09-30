"use client";

import {
  ArrowUp,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Plus,
  Square,
  X,
} from "lucide-react";
import React, {
  type ChangeEvent,
  type ClipboardEvent,
  type Dispatch,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
  type SetStateAction,
} from "react";
import Image from "next/image";
import MarkdownRenderer from "@/components/MarkDownRender";
import ToolTip from "@/components/ToolTip";
import { cn } from "@/lib/utils";
import { TemplateV2HtmlSlidePreview } from "../../../components/TemplateV2HtmlSlidePreview";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  editorQuickPrompts,
  quickPromptGroups,
} from "./chat-prompts";
import type {
  ChatDocumentAttachment,
  ChatEditPreview,
  ChatLink,
  ChatMessage,
  PastedChatImage,
} from "./chat-types";
import { createChatLayoutPreviewSlide } from "./chat-utils";
import {
  localizeActivityLabelText,
  localizeQuickPromptText,
} from "./chat-i18n";
import { MUTATING_TOOLS, stripBackendContextFromUserMessage } from "./chat-activity";
import { ActivityStatusIcon, EditComparisonPreview, QuickPromptsPanel } from "./chat-widgets";

export type ChatEditorLayoutProps = {
  messages: ChatMessage[];
  isSending: boolean;
  isHistoryLoading: boolean;
  chatInputDisabled: boolean;
  isTemplateV2Variant: boolean;
  input: string;
  errorMessage: string | null;
  pastedImages: PastedChatImage[];
  attachedDocuments: ChatDocumentAttachment[];
  chatLinks: ChatLink[];
  isUploadingPastedImage: boolean;
  isDraggingAttachment: boolean;
  isFollowAgentEnabled: boolean;
  isQuickPromptsOpen: boolean;
  chatSlideReference: string;
  chatTargetReference: string;
  previewFonts: unknown;
  activeAssistantMessageId: string | null;
  expandedEditPreviewByMessage: Record<string, boolean>;
  selectedEditVersionByMessage: Record<string, "original" | "modified">;
  applyingEditPreviewMessageId: string | null;
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
  onClearChatSlideReference?: () => void;
  clearChatTargetReference?: () => void;
  setChatLinks: Dispatch<SetStateAction<ChatLink[]>>;
  setPastedImages: Dispatch<SetStateAction<PastedChatImage[]>>;
  setAttachedDocuments: Dispatch<SetStateAction<ChatDocumentAttachment[]>>;
  setIsFollowAgentEnabled: Dispatch<SetStateAction<boolean>>;
  setIsQuickPromptsOpen: Dispatch<SetStateAction<boolean>>;
  setExpandedEditPreviewByMessage: Dispatch<SetStateAction<Record<string, boolean>>>;
  applyEditPreviewVersion: (
    messageId: string,
    preview: ChatEditPreview,
    version: "original" | "modified",
  ) => void | Promise<void>;
};

export function ChatEditorLayout({
  messages,
  isSending,
  isHistoryLoading,
  chatInputDisabled,
  isTemplateV2Variant,
  input,
  errorMessage,
  pastedImages,
  attachedDocuments,
  chatLinks,
  isUploadingPastedImage,
  isDraggingAttachment,
  isFollowAgentEnabled,
  isQuickPromptsOpen,
  chatSlideReference,
  chatTargetReference,
  previewFonts,
  activeAssistantMessageId,
  expandedEditPreviewByMessage,
  selectedEditVersionByMessage,
  applyingEditPreviewMessageId,
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
  onClearChatSlideReference,
  clearChatTargetReference,
  setChatLinks,
  setPastedImages,
  setAttachedDocuments,
  setIsFollowAgentEnabled,
  setIsQuickPromptsOpen,
  setExpandedEditPreviewByMessage,
  applyEditPreviewVersion,
}: ChatEditorLayoutProps) {
  const localizeQuickPrompt = (value: string) =>
    localizeQuickPromptText(value);
  const localizeActivityLabel = (value: string) =>
    localizeActivityLabelText(value);

  return (
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-[var(--gslide-bg)]">
        <Image
          src="/bg_chat.svg"
          alt=""
          width={294}
          height={458}
          loading="eager"
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 h-[457.951px] w-[293.611px] max-w-none object-cover opacity-40"
        />

        <div className="sticky top-0 z-20 flex shrink-0 items-center justify-end border-b border-[#F1F1F3] bg-white/90 px-3 py-2 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => void resetChat()}
            disabled={isSending || isHistoryLoading}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#E5E5E8] bg-white px-3 font-manrope text-xs font-medium text-[#55555F] shadow-sm transition-colors hover:border-[#D7D7DC] hover:bg-[#F7F7F8] hover:text-[#252529] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={"Xóa cuộc trò chuyện"}
            title={"Xóa cuộc trò chuyện"}
          >
            <Plus className="h-3.5 w-3.5" />
            {"Xóa cuộc trò chuyện"}
          </button>
        </div>

        <div className="relative z-10 min-h-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-color:#D7D9DF_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#D7D9DF] [&::-webkit-scrollbar-track]:bg-transparent">
          {isHistoryLoading && messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-[#999999]">
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              {"Đang tải cuộc trò chuyện…"}
            </div>
          ) : messages.length > 0 ? (
            <div className="flex flex-col gap-0">
              {messages.map((message) => {
                if (message.role === "user") {
                  return (
                    <div key={message.id} className="flex justify-end p-4">
                      <div className="flex max-w-[92%] flex-col items-end gap-2">
                        {message.layoutPreview && (
                          <div className="w-[220px] overflow-hidden rounded-lg border border-[var(--gslide-border)] bg-white p-1.5">
                            <TemplateV2HtmlSlidePreview
                              slide={createChatLayoutPreviewSlide(
                                message.layoutPreview,
                              )}
                              fonts={previewFonts}
                              className="rounded-[4px]"
                            />
                          </div>
                        )}
                        <div className="flex min-h-[30px] w-fit max-w-full items-center gap-2.5 rounded-[8px] bg-[#F3F4F7] px-3 py-1.5 font-manrope text-[13px] font-medium leading-[normal] text-[#333333] [overflow-wrap:anywhere] [word-break:break-word]">
                          <p className="min-w-0 whitespace-pre-wrap">
                            {stripBackendContextFromUserMessage(message.content)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }

                const normalizedMessageContent = message.content
                  .trim()
                  .replace(/\s+/g, " ")
                  .toLowerCase();
                const visibleActivity = (message.activity ?? [])
                  .filter((activity) => {
                    const normalizedLabel = activity.label
                      .trim()
                      .replace(/\s+/g, " ")
                      .toLowerCase();
                    if (!normalizedMessageContent || normalizedLabel.length < 12) {
                      return true;
                    }
                    return !(
                      normalizedMessageContent.startsWith(normalizedLabel) ||
                      normalizedLabel.startsWith(normalizedMessageContent)
                    );
                  })
                  .slice(-2);
                const showFallbackActivity =
                  isSending &&
                  message.id === activeAssistantMessageId &&
                  visibleActivity.length === 0 &&
                  !message.content;
                const isEditPreviewExpanded =
                  expandedEditPreviewByMessage[message.id] !== false;

                return (
                  <div
                    key={message.id}
                    className="flex flex-col gap-[10px] px-3 py-4 font-manrope [overflow-wrap:anywhere] [word-break:break-word]"
                  >
                    <div className="flex min-h-[17px] items-center">
                      <p
                        className="min-w-0 max-w-full truncate text-xs font-bold leading-[normal] text-[#333333]"
                        title={"Trợ lý"}
                      >
                        {"Trợ lý"}
                      </p>
                    </div>

                    <div className="flex w-full flex-col gap-1">
                      {(visibleActivity.length > 0 || showFallbackActivity) && (
                        <div className="flex flex-col gap-1">
                          {visibleActivity.map((activity, index) => {
                            const useSparkle =
                              Boolean(
                                activity.tool && MUTATING_TOOLS.has(activity.tool),
                              ) ||
                              /edit|updat|sav|chang|creat|add/i.test(
                                activity.label,
                              );
                            return (
                              <React.Fragment key={activity.id}>
                                <div className="flex min-w-0 items-start gap-1 text-[13px] font-medium leading-[18px] text-[#808080]">
                                  <span className="flex h-[14px] w-[14px] shrink-0 items-start justify-center pt-0.5">
                                    {useSparkle ? (
                                      <Image
                                        src="/vector.svg"
                                        alt=""
                                        width={12}
                                        height={12}
                                        className="h-[12px] w-[12px]"
                                      />
                                    ) : (
                                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#E6E6E6]" />
                                    )}
                                  </span>
                                  <span className="min-w-0 truncate">
                                    {localizeActivityLabel(activity.label)}
                                  </span>
                                  {activity.state === "running" && (
                                    <ActivityStatusIcon activity={activity} />
                                  )}
                                </div>
                                {(index < visibleActivity.length - 1 ||
                                  Boolean(message.content) ||
                                  Boolean(message.editPreview)) && (
                                    <span className="ml-[6.5px] h-[13px] w-px bg-[#E6E6E6]" />
                                  )}
                              </React.Fragment>
                            );
                          })}
                          {showFallbackActivity && (
                            <div className="flex items-start gap-1 text-[13px] font-medium leading-[18px] text-[#808080]">
                              <span className="flex h-[14px] w-[14px] items-start justify-center pt-0.5">
                                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#E6E6E6]" />
                              </span>
                              <span>{"Đang tìm hiểu"}</span>
                              <ActivityStatusIcon
                                activity={{
                                  id: "fallback",
                                  label: "Đang tìm hiểu",
                                  state: "running",
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {message.content && (
                        <>
                          <div
                            className={cn(
                              "flex min-w-0 items-start gap-1 font-manrope text-[13px] font-medium leading-none",
                              message.role === "error"
                                ? "text-[#B42318]"
                                : "text-[#808080]",
                            )}
                          >
                            <span className="mt-1 flex h-[14px] w-[14px] shrink-0 items-start justify-center pt-0.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#E6E6E6]" />
                            </span>
                            <MarkdownRenderer
                              content={message.content}
                              className="chat-markdown mb-0 min-w-0 flex-1 font-manrope text-[13px] font-medium leading-[18px] text-inherit [&_*]:text-[13px] [&_*]:font-medium [&_*]:leading-[18px] [&_*]:text-inherit"
                            />
                            {message.editPreview?.modifiedSlides?.length ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedEditPreviewByMessage((previous) => ({
                                    ...previous,
                                    [message.id]: !isEditPreviewExpanded,
                                  }))
                                }
                                className="flex h-[14px] w-[14px] shrink-0 items-center justify-center text-[#808080] transition-colors hover:text-[#333333]"
                                aria-label={
                                  isEditPreviewExpanded
                                    ? "Ẩn so sánh chỉnh sửa"
                                    : "Hiện so sánh chỉnh sửa"
                                }
                                aria-expanded={isEditPreviewExpanded}
                              >
                                <ChevronDown
                                  className={cn(
                                    "h-[14px] w-[14px] transition-transform duration-200",
                                    !isEditPreviewExpanded && "-rotate-90",
                                  )}
                                />
                              </button>
                            ) : null}
                          </div>
                          {message.editPreview && isEditPreviewExpanded && (
                            <span className="ml-[6.5px] h-[13px] w-px bg-[#E6E6E6]" />
                          )}
                        </>
                      )}

                      {message.editPreview && isEditPreviewExpanded && (
                        <EditComparisonPreview
                          preview={message.editPreview}
                          fonts={previewFonts}
                          selectedVersion={
                            selectedEditVersionByMessage[message.id] ?? "modified"
                          }
                          isApplying={
                            applyingEditPreviewMessageId === message.id
                          }
                          onSelectVersion={(version) =>
                            void applyEditPreviewVersion(
                              message.id,
                              message.editPreview!,
                              version,
                            )
                          }
                        />
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center px-6 pb-4">
              <h3 className="-translate-y-2 text-center text-[22px] font-normal leading-[1.12] tracking-[-0.66px] text-[#4A4A4A]">
                {"Tôi có thể giúp gì"}
                <br />
                for your deck today?
              </h3>
            </div>
          )}
        </div>
        <div className="relative z-20 flex shrink-0 flex-col gap-[10px] bg-[#FFFEFF] px-3 py-[14px]">
          <form
            onSubmit={handleSubmit}
            onDragEnterCapture={handleDragOver}
            onDragOverCapture={handleDragOver}
            onDragLeave={handleDragLeave}
            onDropCapture={handleDrop}
            className={cn(
              "rounded-[8px] border bg-white px-[10px] py-3 transition-colors",
              isDraggingAttachment
                ? "border-[var(--gslide-accent)] bg-[var(--gslide-accent-soft)]"
                : "border-[#DBDBDB]/60",
            )}
            style={{ boxShadow: "0 4px 7px rgba(0, 0, 0, 0.04)" }}
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
                      className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-lg border border-[var(--gslide-border)] bg-[var(--gslide-accent-soft)] px-2 py-1 text-[10px] font-medium text-[var(--gslide-accent)]"
                    >
                      <LinkIcon className="h-3 w-3 shrink-0" />
                      <span className="truncate">{link.url}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setChatLinks((previous) =>
                            previous.filter((item) => item.id !== link.id),
                          )
                        }
                        aria-label={"Xóa liên kết"}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {pastedImages.map((image) => (
                    <span
                      key={image.id}
                      className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-lg border border-[var(--gslide-border)] bg-white px-2 py-1 text-[10px] font-medium text-[var(--gslide-ink)]"
                    >
                      <ImageIcon className="h-3 w-3 shrink-0" />
                      <span className="truncate">{image.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setPastedImages((previous) =>
                            previous.filter((item) => item.id !== image.id),
                          )
                        }
                        aria-label={"Xóa hình ảnh đã dán"}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {attachedDocuments.map((document) => (
                    <span
                      key={document.id}
                      className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-lg border border-[var(--gslide-border)] bg-white px-2 py-1 text-[10px] font-medium text-[var(--gslide-ink)]"
                    >
                      <FileText className="h-3 w-3 shrink-0" />
                      <span className="truncate">{document.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setAttachedDocuments((previous) =>
                            previous.filter((item) => item.id !== document.id),
                          )
                        }
                        aria-label={"Xóa tài liệu đính kèm"}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {isUploadingPastedImage && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-[#808080]">
                      <Loader2 className="h-3 w-3 animate-spin" /> Processing
                    </span>
                  )}
                </div>
              )}

            <textarea
              ref={inputRef}
              name="chat-input"
              id="chat-input"
              className="h-[79px] min-h-[79px] w-full resize-none overflow-x-hidden bg-transparent text-sm font-normal leading-[normal] text-[var(--gslide-ink)] placeholder:text-[var(--gslide-muted)] focus:outline-none focus:ring-0 [overflow-wrap:anywhere] [word-break:break-word]"
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
              placeholder={"Hỏi bất kỳ điều gì.\nGõ / để xem lời nhắc nhanh."}
              aria-invalid={Boolean(errorMessage)}
            />

            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <div className="flex h-[28px] items-center gap-[10px] rounded-full border border-[var(--gslide-border)] bg-white px-[11px]">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!isTemplateV2Variant || chatInputDisabled}
                    className="inline-flex h-[14px] w-[14px] items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={"Đính kèm tệp"}
                  >
                    <Plus className="h-[14px] w-[14px] text-black" />
                  </button>
                  <span className="h-[17px] w-px bg-[#EDECEC]" />
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
                      className="inline-flex h-[14px] w-[14px] items-center justify-center disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={
                        isFollowAgentEnabled
                          ? "Tắt chế độ theo dõi AI"
                          : "Bật chế độ theo dõi AI"
                      }
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                        aria-hidden="true"
                      >
                        <circle
                          cx="7"
                          cy="7"
                          r="4.7"
                          stroke={isFollowAgentEnabled ? "#1D6FE8" : "#191919"}
                          strokeWidth="1.15"
                        />
                        <path
                          d="M7 0.8v2.3M7 10.9v2.3M.8 7h2.3M10.9 7h2.3"
                          stroke={isFollowAgentEnabled ? "#1D6FE8" : "#191919"}
                          strokeWidth="1.15"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </ToolTip>
                </div>

                <Popover
                  open={isQuickPromptsOpen}
                  onOpenChange={setIsQuickPromptsOpen}
                >
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      disabled={chatInputDisabled}
                    className="inline-flex h-[28px] items-center gap-1.5 rounded-full border border-[var(--gslide-border)] bg-white px-[11px] text-xs font-medium tracking-[0.16px] text-[var(--gslide-ink)] transition-colors hover:bg-[var(--gslide-accent-soft)] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={"Mở lời nhắc nhanh"}
                    >
                      <Image
                        src="/ai-star.svg"
                        alt=""
                        width={13}
                        height={14}
                        className="h-[14px] w-[13px] shrink-0"
                      />
                      {"Lời nhắc"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    align="end"
                    sideOffset={14}
                    className="z-[120] w-[328px] rounded-xl border border-[var(--gslide-border)] bg-white px-5 pb-[30px] pt-5 shadow-[0_0_14px_rgba(0,0,0,0.08)]"
                  >
                    <QuickPromptsPanel
                      onPromptSelect={applyPrompt}
                      localizeText={localizeQuickPrompt}
                      groups={quickPromptGroups}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {isSending ? (
                <button
                  type="button"
                  onClick={stopStreaming}
                  className="flex h-8 w-10 shrink-0 items-center justify-center rounded-full bg-[#EDEEEF] text-[#191919]"
                  aria-label={"Dừng phản hồi"}
                >
                  <Square className="h-3 w-3 fill-current" />
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
                  className={`flex h-8 w-10 shrink-0 items-center justify-center rounded-full transition-opacity disabled:cursor-not-allowed ${input.trim()
                    ? "bg-[var(--gslide-accent)] text-white hover:bg-[var(--gslide-accent-hover)]"
                    : "bg-[#EDEEEF] text-[#9B9BA1]"
                    }`}
                  aria-label={"Gửi lời nhắc"}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </div>
          </form>

          <div className="flex h-[28px] w-full gap-2 overflow-hidden">
            {editorQuickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => applyPrompt(prompt)}
                className="h-[28px] shrink-0 rounded-full border border-[var(--gslide-border)] bg-white px-3 text-xs font-medium leading-5 tracking-[0.16px] text-[var(--gslide-muted)] transition-colors hover:bg-[var(--gslide-accent-soft)]"
              >
                {localizeQuickPrompt(prompt)}
              </button>
            ))}
          </div>
        </div>
      </div>
  );
}
