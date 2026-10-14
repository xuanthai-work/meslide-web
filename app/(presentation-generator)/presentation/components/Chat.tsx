"use client";

import {
  ChangeEvent,
  ClipboardEvent,
  DragEvent,
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { notify } from "@/components/ui/sonner";
import { useDispatch } from "react-redux";
import { ImagesApi } from "../../services/api/images";
import { PresentationGenerationApi } from "../../services/api/presentation-generation";
import {
  GSLIDE_BLANK_SLIDE_PROMPT_EVENT,
  type BlankSlidePromptEventDetail,
} from "../../_shared/blank-slide-prompt-event";
import type {
  ChatStreamTrace,
} from "../../services/api/chat";
import type { AppDispatch } from "@/store/store";
import {
  setPresentationData,
  type PresentationData,
} from "@/store/slices/presentationGeneration";

import { presentationChatAdapter } from "./chat/chat-adapter";
import { ChatEditorLayout } from "./chat/ChatEditorLayout";
import { ChatPresentationLayout } from "./chat/ChatPresentationLayout";
import type {
  AssistantActivity,
  ChatDocumentAttachment,
  ChatEditPreview,
  ChatLink,
  ChatMessage,
  ChatProps,
  PastedChatImage,
  SubmitMessageOptions,
} from "./chat/chat-types";
import {
  appendInputText,
  buildChatDocumentAttachments,
  clonePreviewSlide,
  conversationStorageKey,
  createMessageId,
  getDroppedFileUri,
  getPresentationFonts,
  getPresentationSlide,
  hasDraggedFiles,
  isImageFile,
  pullLinksFromText,
  readDecomposedFile,
  removeStoredConversationId,
  shouldReadAttachedImages,
  storeConversationId,
  trimAttachmentContent,
} from "./chat/chat-utils";
import {
  formatTraceActivity,
  inferStatusState,
  isAbortError,
  decideSlideFollow,
  MIN_SLIDE_FOCUS_DWELL_MS,
  MUTATING_TOOLS,
  readTraceSlideIndex,
} from "./chat/chat-activity";
import { useChatSession } from "./chat/useChatSession";
import { translateBackendStatus } from "@/lib/backend-messages";

export type { ChatApiAdapter } from "./chat/chat-types";

export const MAX_CHAT_MESSAGE_LENGTH = 16000;

const Chat = ({
  presentationId,
  presentationData,
  resourceId,
  chatAdapter = presentationChatAdapter,
  conversationStorageScope = "presentation",
  resourceLabel = "presentation",
  variant = "presentation",
  inputDisabled = false,
  currentSlide,
  selectedTemplateV2Target,
  onClearChatSlideReference,
  onClearChatTargetReference,
  onOpenAiPanel,
  onBeforeSend,
  onPresentationChanged,
  onChatMutationStateChange,
  onAgentSlideFocus,
  onChatSendingStateChange,
  onFollowModeChange,
  isPanelMaximized,
  onTogglePanelMaximize,
}: ChatProps) => {
  const dispatch = useDispatch<AppDispatch>();
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isFollowAgentEnabled, setIsFollowAgentEnabled] = useState(true);
  const [hasChatMutationStarted, setHasChatMutationStarted] = useState(false);
  const [activeAssistantMessageId, setActiveAssistantMessageId] = useState<
    string | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pastedImages, setPastedImages] = useState<PastedChatImage[]>([]);
  const [attachedDocuments, setAttachedDocuments] = useState<
    ChatDocumentAttachment[]
  >([]);
  const [chatLinks, setChatLinks] = useState<ChatLink[]>([]);
  const [isUploadingPastedImage, setIsUploadingPastedImage] = useState(false);
  const [isDraggingAttachment, setIsDraggingAttachment] = useState(false);
  const [isQuickPromptsOpen, setIsQuickPromptsOpen] = useState(false);
  const [expandedEditPreviewByMessage, setExpandedEditPreviewByMessage] =
    useState<Record<string, boolean>>({});
  const [selectedEditVersionByMessage, setSelectedEditVersionByMessage] =
    useState<Record<string, "original" | "modified">>({});
  const [applyingEditPreviewMessageId, setApplyingEditPreviewMessageId] =
    useState<string | null>(null);
  const [expandedActivityByMessage, setExpandedActivityByMessage] = useState<
    Record<string, boolean>
  >({});
  const [hiddenOverlaySlideReference, setHiddenOverlaySlideReference] = useState<
    number | null
  >(null);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const submitMessageRef = useRef<
    (message: string, options?: SubmitMessageOptions) => Promise<void>
  >(
    async () => undefined,
  );
  const lastFollowedTraceRef = useRef<string | null>(null);
  const focusEventSequenceRef = useRef(0);
  const activeFocusedSlideRef = useRef<number | null>(null);
  const pendingFocusTraceRef = useRef<ChatStreamTrace | null>(null);
  const lastFocusDispatchAtRef = useRef<number>(0);
  const focusDispatchTimerRef = useRef<number | null>(null);
  const refreshInFlightRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  const activeEditPreviewRef = useRef<{
    assistantMessageId: string;
    originalSlidesByIndex: Record<number, unknown>;
    mutatedSlideIndices: number[];
    mutationObserved: boolean;
    changeCount: number;
  } | null>(null);
  const activeResourceId = resourceId ?? presentationId;
  const {
    messages,
    setMessages,
    conversationId,
    setConversationId,
    isHistoryLoading,
  } = useChatSession({
    activeResourceId,
    chatAdapter,
    conversationStorageScope,
    onSessionReset: () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setInput("");
      setIsSending(false);
      setHasChatMutationStarted(false);
      setActiveAssistantMessageId(null);
      setErrorMessage(null);
      setPastedImages([]);
      setAttachedDocuments([]);
      setChatLinks([]);
      setIsUploadingPastedImage(false);
      setIsDraggingAttachment(false);
      setIsQuickPromptsOpen(false);
      setExpandedEditPreviewByMessage({});
      setSelectedEditVersionByMessage({});
      setApplyingEditPreviewMessageId(null);
      setExpandedActivityByMessage({});
      setHiddenOverlaySlideReference(null);
      activeEditPreviewRef.current = null;
    },
  });
  const chatInputDisabled = inputDisabled || isSending || isHistoryLoading;

  useEffect(() => {
    const activePreview = activeEditPreviewRef.current;
    if (!activePreview?.mutationObserved) return;
    const modifiedSlides = activePreview.mutatedSlideIndices
      .map((slideIndex) =>
        clonePreviewSlide(getPresentationSlide(presentationData, slideIndex)),
      )
      .filter(Boolean);
    if (modifiedSlides.length === 0) return;

    setMessages((previous) =>
      previous.map((message) =>
        message.id === activePreview.assistantMessageId
          ? {
            ...message,
            editPreview: {
              originalSlides: activePreview.mutatedSlideIndices
                .map(
                  (slideIndex) =>
                    activePreview.originalSlidesByIndex[slideIndex],
                )
                .filter(Boolean),
              modifiedSlides,
              slideIndices: activePreview.mutatedSlideIndices,
              changeCount: Math.max(1, activePreview.changeCount),
            },
          }
          : message,
      ),
    );
    setSelectedEditVersionByMessage((previous) => ({
      ...previous,
      [activePreview.assistantMessageId]:
        previous[activePreview.assistantMessageId] ?? "modified",
    }));
    setExpandedEditPreviewByMessage((previous) => ({
      ...previous,
      [activePreview.assistantMessageId]:
        previous[activePreview.assistantMessageId] ?? true,
    }));
  }, [presentationData, setMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isSending]);

  useEffect(() => {
    setHiddenOverlaySlideReference(null);
  }, [currentSlide]);

  useEffect(() => {
    onChatMutationStateChange?.(hasChatMutationStarted);
  }, [hasChatMutationStarted, onChatMutationStateChange]);

  useEffect(() => {
    onFollowModeChange?.(isFollowAgentEnabled);
  }, [isFollowAgentEnabled, onFollowModeChange]);

  useEffect(() => {
    onChatSendingStateChange?.(isSending);
    if (!isSending) {
      lastFollowedTraceRef.current = null;
      activeFocusedSlideRef.current = null;
      pendingFocusTraceRef.current = null;
      lastFocusDispatchAtRef.current = 0;
      if (focusDispatchTimerRef.current !== null) {
        window.clearTimeout(focusDispatchTimerRef.current);
        focusDispatchTimerRef.current = null;
      }
    }
  }, [isSending, onChatSendingStateChange]);

  useEffect(
    () => () => {
      if (focusDispatchTimerRef.current !== null) {
        window.clearTimeout(focusDispatchTimerRef.current);
      }
    },
    []
  );

  const markChatMutationStarted = (tool: string | undefined) => {
    if (!tool || !MUTATING_TOOLS.has(tool)) {
      return;
    }
    setHasChatMutationStarted(true);
  };

  const emitAgentSlideFocus = useCallback(
    (trace: ChatStreamTrace, targetSlideIndex: number) => {
      if (!onAgentSlideFocus) {
        return;
      }
      focusEventSequenceRef.current += 1;
      onAgentSlideFocus({
        slideIndex: targetSlideIndex,
        eventId: `${Date.now()}-${focusEventSequenceRef.current}`,
        tool: trace.tool,
        status: trace.status,
        isMutatingTool: Boolean(trace.tool && MUTATING_TOOLS.has(trace.tool)),
      });
      activeFocusedSlideRef.current = targetSlideIndex;
      lastFocusDispatchAtRef.current = Date.now();
    },
    [onAgentSlideFocus]
  );

  const flushPendingSlideFocus = useCallback(() => {
    focusDispatchTimerRef.current = null;
    const pendingTrace = pendingFocusTraceRef.current;
    pendingFocusTraceRef.current = null;
    if (!pendingTrace) {
      return;
    }
    const targetSlideIndex = readTraceSlideIndex(pendingTrace);
    if (targetSlideIndex === null) {
      return;
    }
    emitAgentSlideFocus(pendingTrace, targetSlideIndex);
  }, [emitAgentSlideFocus]);

  const schedulePendingSlideFocus = useCallback(() => {
    if (focusDispatchTimerRef.current !== null) {
      return;
    }
    const elapsed = Date.now() - lastFocusDispatchAtRef.current;
    const waitMs = Math.max(MIN_SLIDE_FOCUS_DWELL_MS - elapsed, 0);
    focusDispatchTimerRef.current = window.setTimeout(
      flushPendingSlideFocus,
      waitMs
    );
  }, [flushPendingSlideFocus]);

  const maybeFollowAgentSlide = useCallback(
    (trace: ChatStreamTrace) => {
      const decision = decideSlideFollow({
        trace,
        lastSignature: lastFollowedTraceRef.current,
        activeSlide: activeFocusedSlideRef.current,
        elapsedMs: Date.now() - lastFocusDispatchAtRef.current,
      });
      if (decision.action === "ignore") {
        return;
      }
      lastFollowedTraceRef.current = decision.signature;
      const targetSlideIndex = decision.slideIndex;

      if (decision.action === "focus-now") {
        pendingFocusTraceRef.current = null;
        if (focusDispatchTimerRef.current !== null) {
          window.clearTimeout(focusDispatchTimerRef.current);
          focusDispatchTimerRef.current = null;
        }
        emitAgentSlideFocus(trace, targetSlideIndex);
        return;
      }

      pendingFocusTraceRef.current = trace;
      schedulePendingSlideFocus();
    },
    [emitAgentSlideFocus, schedulePendingSlideFocus]
  );

  const buildBackendMessage = (
    message: string,
    images = pastedImages,
    additionalContext?: string,
  ) => {
    const contextLines: string[] = [];

    if (variant === "template-v2") {
      contextLines.push(
        "UI context: the user is editing a rendered TemplateV2 presentation with the v2 assistant. Use getTemplateSummary, getAvailableLayouts, getAvailableBlocks, searchSlide, getSlideAtIndex, getContentSchemaFromLayoutId, addNewSlide, addNewSlideLayout, saveSlide, updateSlide, deleteSlide, addElement, updateElement, deleteElement, addComponent, createComponent, updateComponent, deleteComponent, getPresentationTheme, setPresentationTheme, readSourceDocuments, and generateAssets. For visible edits inside an existing slide, inspect with getSlideAtIndex and use the returned componentId/elementPath exactly. Use updateElement for element toolbar-style properties and updateComponent for component move, resize, duplicate, layer order, group, and ungroup actions. When adding or creating rendered elements/components, prefer reusable template blocks over primitives: for custom new slides, search getAvailableBlocks for a title/header text block first, then requested chart/table/content blocks, adapt their component JSON, and include the final requested content instead of placeholder blocks. Keep new rendered elements/components strictly inside the 1280x720 visible slide window."
      );
    }
    if (typeof currentSlide === "number") {
      contextLines.push(
        `UI context: the currently selected slide is slide ${currentSlide + 1
        } (zero-based index ${currentSlide}).`
      );
    }

    const trimmedAdditionalContext = additionalContext?.trim();
    if (trimmedAdditionalContext) {
      contextLines.push(
        trimmedAdditionalContext.startsWith("UI context:")
          ? trimmedAdditionalContext
          : `UI context: ${trimmedAdditionalContext}`,
      );
    }

    if (selectedTemplateV2Target?.kind === "multi-component") {
      const target = selectedTemplateV2Target;
      const componentIds = target.componentIds?.filter(Boolean) ?? [];
      const labels =
        target.componentLabels?.filter(Boolean) ??
        target.components.map((component) => component.componentLabel).filter(Boolean);
      contextLines.push(
        `UI context: the user has selected ${target.components.length} TemplateV2 components${labels.length ? ` (${labels.join(", ")})` : ""
        }${componentIds.length ? ` with componentIds=${componentIds.join(",")}` : ""
        }. These selected components are the primary target for short edits like "these", "group these", "remove these", "move them", or "resize them"; do not apply those requests to the whole slide unless the user explicitly says slide. For grouping selected components, inspect the selected slide with getSlideAtIndex, then call updateComponent with action=group, componentId set to one selected component id, and componentIds set to all selected component ids exactly.`
      );
    } else if (selectedTemplateV2Target) {
      const target = selectedTemplateV2Target;
      const targetParts = [
        `kind=${target.kind}`,
        typeof target.slideIndex === "number"
          ? `slideIndex=${target.slideIndex}`
          : "",
        typeof target.componentIndex === "number"
          ? `componentIndex=${target.componentIndex}`
          : "",
        target.componentId ? `componentId=${target.componentId}` : "",
        target.componentLabel ? `componentLabel=${target.componentLabel}` : "",
        target.elementPath ? `elementPath=${target.elementPath}` : "",
        target.elementType ? `elementType=${target.elementType}` : "",
        target.elementName ? `elementName=${target.elementName}` : "",
        target.targetLabel ? `targetLabel=${target.targetLabel}` : "",
      ].filter(Boolean);
      contextLines.push(
        `UI context: the user has selected this TemplateV2 ${target.kind}: ${targetParts.join(
          ", "
        )}. This selected ${target.kind} is the primary target for short edits like "this", "it", "make it smaller", "rewrite it", or "remove it"; do not apply those requests to the whole slide unless the user explicitly says slide. For visible slide edits, inspect the selected slide with getSlideAtIndex and use matching componentId/elementPath exactly. If the selected element is content_editable:false, use position/size for that element or target a content_editable descendant for text/content changes.`
      );
    }

    if (images.length > 0) {
      contextLines.push(
        [
          "UI context: the user attached image(s) to chat for this request. If they ask to add or replace an image, use addElement/updateElement with the exact image URL. If extracted text is provided, use it only for requests that ask to read or analyze the image.",
          ...images.map(
            (image, index) =>
              [
                `Image ${index + 1} (${image.name}): ${image.url}`,
                image.extractedText
                  ? `Extracted image text ${index + 1}:\n${trimAttachmentContent(
                    image.extractedText
                  )}`
                  : "",
              ]
                .filter(Boolean)
                .join("\n")
          ),
        ].join("\n")
      );
    }

    if (chatLinks.length > 0) {
      contextLines.push(
        [
          "UI context: the user added link(s) to chat for this request. Use the exact URL when the user refers to the link.",
          ...chatLinks.map((link, index) => `Link ${index + 1}: ${link.url}`),
        ].join("\n")
      );
    }

    if (contextLines.length === 0) {
      return message;
    }

    return [...contextLines, `User message: ${message}`].join("\n");
  };

  const clearChatUi = () => {
    setMessages([]);
    setInput("");
    setPastedImages([]);
    setAttachedDocuments([]);
    setChatLinks([]);
    setConversationId(null);
    setHasChatMutationStarted(false);
    setErrorMessage(null);
    setExpandedActivityByMessage({});
    setHiddenOverlaySlideReference(null);
    setExpandedEditPreviewByMessage({});
    setSelectedEditVersionByMessage({});
    setApplyingEditPreviewMessageId(null);
    if (activeResourceId) {
      removeStoredConversationId(
        conversationStorageKey(
          conversationStorageScope,
          activeResourceId,
        ),
      );
    }
    inputRef.current?.focus();
  };

  const resetChat = async () => {
    const conversationIdToDelete = conversationId;
    clearChatUi();

    if (activeResourceId) {
      const conversationIdsToDelete = new Set<string>();
      if (conversationIdToDelete) {
        conversationIdsToDelete.add(conversationIdToDelete);
      }

      try {
        const savedConversations =
          await chatAdapter.listConversations(activeResourceId);
        savedConversations.forEach((savedConversation) => {
          conversationIdsToDelete.add(savedConversation.conversation_id);
        });
        await Promise.all(
          Array.from(conversationIdsToDelete, (savedConversationId) =>
            chatAdapter.deleteConversation(
              activeResourceId,
              savedConversationId,
            )
          )
        );
      } catch (error) {
        console.error("Failed to delete chat conversations:", error);
        const detail =
          error instanceof Error
            ? error.message
            : "Không thể xóa các cuộc trò chuyện đã lưu";
        notify.error("Không thể xóa cuộc trò chuyện", detail);
      }
    }
  };

  const applyEditPreviewVersion = async (
    messageId: string,
    preview: ChatEditPreview,
    version: "original" | "modified",
  ) => {
    if (applyingEditPreviewMessageId) return;
    if (!presentationData || typeof presentationData !== "object") {
      notify.error(
        "Không thể xem trước",
        "Bài thuyết trình chưa sẵn sàng."
      );
      return;
    }

    const currentPresentation = presentationData as Record<string, unknown>;
    if (!Array.isArray(currentPresentation.slides)) {
      notify.error("Không thể xem trước", "Chưa có dữ liệu slide.");
      return;
    }

    const selectedSlides =
      version === "original" ? preview.originalSlides : preview.modifiedSlides;
    if (!selectedSlides?.length) return;

    const previousVersion =
      selectedEditVersionByMessage[messageId] ?? "modified";
    const nextSlides = [...currentPresentation.slides];
    preview.slideIndices.forEach((slideIndex, index) => {
      if (selectedSlides[index]) {
        nextSlides[slideIndex] = clonePreviewSlide(selectedSlides[index]);
      }
    });
    const nextPresentation = {
      ...currentPresentation,
      slides: nextSlides,
    } as unknown as PresentationData;

    if (activeEditPreviewRef.current?.assistantMessageId === messageId) {
      activeEditPreviewRef.current = null;
    }

    setApplyingEditPreviewMessageId(messageId);
    setSelectedEditVersionByMessage((previous) => ({
      ...previous,
      [messageId]: version,
    }));
    onChatMutationStateChange?.(true);
    dispatch(setPresentationData(nextPresentation));

    try {
      for (const slideIndex of preview.slideIndices) {
        const slide = nextSlides[slideIndex];
        if (slide) {
          await PresentationGenerationApi.updatePresentationSlide(slide);
        }
      }
      await onPresentationChanged?.();
      notify.success(
        version === "original"
          ? "Đã khôi phục bản gốc"
          : "Đã khôi phục thay đổi",
        `${preview.slideIndices.length} slide đã được cập nhật.`,
      );
    } catch (error) {
      dispatch(setPresentationData(presentationData as PresentationData));
      setSelectedEditVersionByMessage((previous) => ({
        ...previous,
        [messageId]: previousVersion,
      }));
      notify.error(
        "Không thể khôi phục slide",
        error instanceof Error ? error.message : "Vui lòng thử lại.",
      );
    } finally {
      onChatMutationStateChange?.(false);
      setApplyingEditPreviewMessageId(null);
    }
  };

  const refreshPresentationIncrementally = useCallback(async () => {
    const runRefresh = async () => {
      if (!onPresentationChanged) {
        return;
      }
      if (refreshInFlightRef.current) {
        refreshQueuedRef.current = true;
        return;
      }

      refreshInFlightRef.current = true;
      try {
        await onPresentationChanged();
      } catch (error) {
        console.error(
          "Failed to refresh presentation after tool mutation:",
          error
        );
        notify.error(
          "Làm mới thất bại",
          "Đã lưu thay đổi nhưng không thể làm mới."
        );
      } finally {
        refreshInFlightRef.current = false;
        if (refreshQueuedRef.current) {
          refreshQueuedRef.current = false;
          await runRefresh();
        }
      }
    };
    await runRefresh();
  }, [onPresentationChanged]);

  const refreshPresentationIfNeeded = async (toolCalls: string[]) => {
    const hasMutation = toolCalls.some((tool) => MUTATING_TOOLS.has(tool));
    if (!hasMutation || !onPresentationChanged) {
      return;
    }

    try {
      await onPresentationChanged();
    } catch (error) {
      console.error("Failed to refresh presentation after chat update:", error);
      notify.error(
        "Làm mới thất bại",
        "Chat đã hoàn tất nhưng không thể làm mới."
      );
    }
  };

  const appendAssistantActivity = (
    assistantMessageId: string,
    activity: Omit<AssistantActivity, "id">
  ) => {
    const normalizedLabel = activity.label.trim();
    if (!normalizedLabel) {
      return;
    }

    setMessages((previous) =>
      previous.map((message) => {
        if (message.id !== assistantMessageId) {
          return message;
        }

        const currentActivity = message.activity ?? [];
        const lastActivity = currentActivity[currentActivity.length - 1];
        if (
          lastActivity &&
          lastActivity.label === normalizedLabel &&
          lastActivity.state === activity.state
        ) {
          return message;
        }

        const settledActivity: AssistantActivity[] =
          lastActivity && lastActivity.state === "running"
            ? [
              ...currentActivity.slice(0, -1),
              {
                ...lastActivity,
                state:
                  activity.state === "error"
                    ? "error"
                    : ("success" as AssistantActivity["state"]),
              },
            ]
            : currentActivity;

        const lastSettledActivity = settledActivity[settledActivity.length - 1];
        if (
          lastSettledActivity &&
          lastSettledActivity.label === normalizedLabel &&
          lastSettledActivity.state !== activity.state
        ) {
          return {
            ...message,
            activity: [
              ...settledActivity.slice(0, -1),
              {
                ...lastSettledActivity,
                ...activity,
                label: normalizedLabel,
                state: activity.state,
              },
            ],
          };
        }

        return {
          ...message,
          activity: [
            ...settledActivity,
            {
              id: createMessageId(),
              ...activity,
              label: normalizedLabel,
              state: activity.state,
            },
          ],
        };
      })
    );
  };

  const toggleActivityExpanded = (messageId: string) => {
    setExpandedActivityByMessage((previous) => ({
      ...previous,
      [messageId]: !previous[messageId],
    }));
  };

  const stopStreaming = () => {
    abortControllerRef.current?.abort();
  };

  const processTemplateV2Files = async (
    files: File[],
  ) => {
    if (files.length === 0 || chatInputDisabled) {
      return;
    }
    if (variant !== "template-v2") {
      notify.info("Tệp đính kèm chỉ dùng được trong chat Template V2.");
      return;
    }

    const imageFiles = files.filter(isImageFile);
    const documentFiles = files.filter((file) => !isImageFile(file));

    setIsUploadingPastedImage(true);
    try {
      if (imageFiles.length > 0) {
        const uploads = await Promise.all(
          imageFiles.map((file) => ImagesApi.uploadImage(file))
        );
        const nextImages = uploads.flatMap((upload, index) => {
          const file = imageFiles[index];
          const url = upload.file_url || upload.path;
          if (!file || !url) return [];
          return [
            {
              id: upload.id || createMessageId(),
              name: file.name || `Image ${index + 1}`,
              url,
              file,
            },
          ];
        });
        if (nextImages.length === 0) {
          throw new Error("Image upload did not return a URL.");
        }
        setPastedImages((previous) => [...previous, ...nextImages]);
      }

      if (documentFiles.length > 0) {
        const paths = (await PresentationGenerationApi.uploadDoc(
          documentFiles
        )) as string[];
        const documents = paths.flatMap((filePath, index) => {
          const file = documentFiles[index];
          if (!file || !filePath) return [];
          return [
            {
              id: createMessageId(),
              name: file.name || `Document ${index + 1}`,
              filePath,
              mimeType: file.type || undefined,
            },
          ];
        });
        if (documents.length === 0) {
          throw new Error("Document upload did not return a file path.");
        }
        setAttachedDocuments((previous) => [...previous, ...documents]);
      }

      notify.success(
        "Tệp đính kèm đã sẵn sàng",
        `Đã đính kèm ${files.length} tệp.`
      );
    } catch (error) {
      notify.error(
        "Không thể đính kèm tệp",
        error instanceof Error ? error.message : "Tải lên thất bại."
      );
    } finally {
      setIsUploadingPastedImage(false);
    }
  };

  const extractImageTextContext = async (images: PastedChatImage[]) => {
    const imagesToRead = images.filter(
      (image) => image.file && !image.extractedText
    );
    if (imagesToRead.length === 0) {
      return images;
    }

    setIsUploadingPastedImage(true);
    try {
      const paths = (await PresentationGenerationApi.uploadDoc(
        imagesToRead.map((image) => image.file!)
      )) as string[];
      const decomposed = (await PresentationGenerationApi.decomposeDocuments(
        paths,
        null
      )) as { name: string; file_path: string }[];
      const extracted = await Promise.all(
        decomposed.map((item) => readDecomposedFile(item.file_path))
      );
      const extractedById = new Map(
        imagesToRead.map((image, index) => [image.id, extracted[index] || ""])
      );
      const nextImages = images.map((image) => ({
        ...image,
        extractedText: extractedById.get(image.id) || image.extractedText,
      }));
      setPastedImages(nextImages);
      return nextImages;
    } finally {
      setIsUploadingPastedImage(false);
    }
  };

  const submitMessage = async (
    rawMessage: string,
    options: SubmitMessageOptions = {},
  ) => {
    const trimmedMessage = rawMessage.trim();
    const hasAttachedContext =
      pastedImages.length > 0 ||
      attachedDocuments.length > 0 ||
      chatLinks.length > 0;
    const outboundMessage =
      trimmedMessage ||
      (attachedDocuments.length > 0
        ? "Use the attached document."
        : chatLinks.length > 0
          ? "Use the provided link."
          : "Use the pasted image.");

    if (
      (!trimmedMessage && !hasAttachedContext) ||
      chatInputDisabled ||
      isUploadingPastedImage
    ) {
      return;
    }

    if (
      trimmedMessage.length > MAX_CHAT_MESSAGE_LENGTH ||
      buildBackendMessage(outboundMessage).length > MAX_CHAT_MESSAGE_LENGTH
    ) {
      notify.error(
        "Tin nhắn quá dài",
        "Tin nhắn không được vượt quá 16.000 ký tự. Vui lòng rút ngắn nội dung."
      );
      return;
    }

    if (!activeResourceId) {
      notify.error(
        `${resourceLabel.charAt(0).toUpperCase()}${resourceLabel.slice(1)} not ready`,
        `The ${resourceLabel} is not ready yet.`
      );
      return;
    }

    let imagesForMessage = pastedImages;
    if (
      variant === "template-v2" &&
      pastedImages.length > 0 &&
      shouldReadAttachedImages(outboundMessage)
    ) {
      // ponytail: keyword heuristic, replace with explicit user-controlled "read image" mode if it misclassifies.
      try {
        imagesForMessage = await extractImageTextContext(pastedImages);
      } catch (error) {
        notify.error(
          "Không thể đọc hình ảnh",
          error instanceof Error
            ? error.message
            : "Xử lý hình ảnh thất bại."
        );
        return;
      }
    }

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: outboundMessage,
      layoutPreview: options.layoutPreview,
    };

    const assistantMessageId = createMessageId();
    const previewSlideIndex = typeof currentSlide === "number" ? currentSlide : 0;
    const originalPreviewSlide = clonePreviewSlide(
      getPresentationSlide(presentationData, previewSlideIndex),
    );
    activeEditPreviewRef.current = originalPreviewSlide
      ? {
        assistantMessageId,
        originalSlidesByIndex: { [previewSlideIndex]: originalPreviewSlide },
        mutatedSlideIndices: [],
        mutationObserved: false,
        changeCount: 0,
      }
      : null;
    setMessages((previous) => [
      ...previous,
      userMessage,
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        toolCalls: [],
        activity: [],
      },
    ]);
    setExpandedActivityByMessage((previous) => ({
      ...previous,
      [assistantMessageId]: false,
    }));
    setInput("");
    setErrorMessage(null);
    setHasChatMutationStarted(false);
    setIsSending(true);
    setActiveAssistantMessageId(assistantMessageId);
    refreshQueuedRef.current = false;
    refreshInFlightRef.current = false;
    const streamAbortController = new AbortController();
    abortControllerRef.current = streamAbortController;

    try {
      await onBeforeSend?.();
      const response = await chatAdapter.streamMessage(
        {
          resourceId: activeResourceId,
          message: buildBackendMessage(
            outboundMessage,
            imagesForMessage,
            options.backendContext,
          ),
          conversation_id: conversationId ?? undefined,
          attachments: buildChatDocumentAttachments(attachedDocuments),
        },
        {
          onChunk: (chunk) => {
            setMessages((previous) =>
              previous.map((message) =>
                message.id === assistantMessageId
                  ? {
                    ...message,
                    content: `${message.content}${chunk}`,
                  }
                  : message
              )
            );
          },
          onStatus: (status, statusPayload) => {
            appendAssistantActivity(assistantMessageId, {
              label: translateBackendStatus(statusPayload),
              state: inferStatusState(status, statusPayload.status_code),
            });
          },
          onTrace: (trace) => {
            if (
              trace.tool &&
              trace.status === "start" &&
              MUTATING_TOOLS.has(trace.tool) &&
              activeEditPreviewRef.current?.assistantMessageId ===
              assistantMessageId
            ) {
              const activePreview = activeEditPreviewRef.current;
              const tracedSlideIndex = readTraceSlideIndex(trace);
              const effectiveSlideIndex =
                tracedSlideIndex ??
                (typeof currentSlide === "number" ? currentSlide : 0);
              if (!activePreview.originalSlidesByIndex[effectiveSlideIndex]) {
                const tracedOriginalSlide = clonePreviewSlide(
                  getPresentationSlide(presentationData, effectiveSlideIndex),
                );
                if (tracedOriginalSlide) {
                  activePreview.originalSlidesByIndex[effectiveSlideIndex] =
                    tracedOriginalSlide;
                }
              }
              if (!activePreview.mutatedSlideIndices.includes(effectiveSlideIndex)) {
                activePreview.mutatedSlideIndices.push(effectiveSlideIndex);
              }
              activePreview.mutationObserved = true;
              activePreview.changeCount += 1;
              setMessages((previous) =>
                previous.map((message) =>
                  message.id === assistantMessageId
                    ? {
                      ...message,
                      editPreview: {
                        originalSlides: activePreview.mutatedSlideIndices
                          .map(
                            (slideIndex) =>
                              activePreview.originalSlidesByIndex[slideIndex],
                          )
                          .filter(Boolean),
                        slideIndices: activePreview.mutatedSlideIndices,
                        changeCount: activePreview.changeCount,
                      },
                    }
                    : message,
                ),
              );
            }
            maybeFollowAgentSlide(trace);
            if (
              trace.status === "success" &&
              trace.tool &&
              MUTATING_TOOLS.has(trace.tool)
            ) {
              void refreshPresentationIncrementally();
            }
            if (trace.status === "start") {
              markChatMutationStarted(trace.tool);
            }
            const traceActivity = formatTraceActivity(trace);
            if (!traceActivity) {
              return;
            }
            appendAssistantActivity(assistantMessageId, traceActivity);
          },
        },
        { signal: streamAbortController.signal }
      );

      setMessages((previous) =>
        previous.map((message) =>
          message.id === assistantMessageId
            ? {
              ...message,
              content: response.response,
              toolCalls: [],
              activity: (message.activity ?? []).map((activity) => ({
                ...activity,
                state:
                  activity.state === "running" ? "success" : activity.state,
              })),
            }
            : message
        )
      );
      setExpandedActivityByMessage((previous) => {
        const next = { ...previous };
        delete next[assistantMessageId];
        return next;
      });
      setConversationId((previous) => {
        const next =
          typeof response.conversation_id === "string"
            ? response.conversation_id
            : previous;
        if (next && activeResourceId) {
          storeConversationId(
            conversationStorageKey(
              conversationStorageScope,
              activeResourceId,
            ),
            next
          );
        }
        return next;
      });

      await refreshPresentationIfNeeded(
        Array.isArray(response.tool_calls) ? response.tool_calls : []
      );
      setPastedImages([]);
      setAttachedDocuments([]);
      setChatLinks([]);
    } catch (error) {
      if (isAbortError(error)) {
        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistantMessageId
              ? {
                ...message,
                toolCalls: [],
                activity: [],
              }
              : message
          )
        );
        setExpandedActivityByMessage((previous) => {
          const next = { ...previous };
          delete next[assistantMessageId];
          return next;
        });
        return;
      }

      const message =
        error instanceof Error ? error.message : "Không thể gửi tin nhắn";

      setMessages((previous) =>
        previous.map((entry) =>
          entry.id === assistantMessageId
            ? {
              ...entry,
              toolCalls: [],
              activity: [],
            }
            : entry
        )
      );
      setExpandedActivityByMessage((previous) => {
        const next = { ...previous };
        delete next[assistantMessageId];
        return next;
      });
      setErrorMessage(message);
      setMessages((previous) => [
        ...previous,
        {
          id: createMessageId(),
          role: "error",
          content: message,
        },
      ]);
      notify.error("Lỗi trò chuyện", message);
    } finally {
      setHasChatMutationStarted(false);
      if (abortControllerRef.current === streamAbortController) {
        abortControllerRef.current = null;
      }
      setActiveAssistantMessageId((current) =>
        current === assistantMessageId ? null : current
      );
      setIsSending(false);
    }
  };

  useEffect(() => {
    submitMessageRef.current = submitMessage;
  });

  useEffect(() => {
    if (variant !== "template-v2" || typeof window === "undefined") return;

    const handleBlankSlidePrompt = (event: Event) => {
      const detail = (event as CustomEvent<BlankSlidePromptEventDetail>).detail;
      const prompt = typeof detail?.prompt === "string" ? detail.prompt.trim() : "";
      if (!prompt) return;

      const target =
        typeof detail.slideIndex === "number"
          ? `slide ${detail.slideIndex + 1}`
          : "the current blank slide";
      const layoutReference =
        typeof detail.layoutId === "string" && detail.layoutId.trim()
          ? ` (layout id: ${detail.layoutId.trim()})`
          : "";
      const instruction =
        detail.promptKind === "layout"
          ? `Fill the existing selected ${target} using its selected layout${layoutReference} as the layout reference. Preserve the layout structure and update this slide; do not add another slide.`
          : `The user wants to create content for this slide with request: "${prompt}".
Inspect the available layouts for this presentation template using getAvailableLayouts.
Choose the layout that best fits the user request (e.g., closing/thank-you, cards, metrics, team, or title).
Then fill the existing selected ${target} with rich, styled content matching that layout using updateSlide, addComponent, or element tools.
Do not leave the slide blank. Do not add another slide. Ensure all text matches the requested language (Vietnamese by default).`;
      if (typeof detail.slideIndex === "number") {
        setHiddenOverlaySlideReference(detail.slideIndex);
      }
      onOpenAiPanel?.();
      void submitMessageRef.current(prompt, {
        backendContext: instruction,
        layoutPreview:
          detail.promptKind === "layout" && detail.layout
            ? {
              layout: detail.layout,
              layoutId: detail.layoutId,
              slideIndex: detail.slideIndex,
            }
            : undefined,
      });
    };

    window.addEventListener(
      GSLIDE_BLANK_SLIDE_PROMPT_EVENT,
      handleBlankSlidePrompt,
    );
    return () => {
      window.removeEventListener(
        GSLIDE_BLANK_SLIDE_PROMPT_EVENT,
        handleBlankSlidePrompt,
      );
    };
  }, [onOpenAiPanel, variant]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitMessage(input);
  };

  const addChatLinks = (links: ChatLink[]) => {
    if (links.length === 0) return;
    setChatLinks((previous) => {
      const seen = new Set(previous.map((link) => link.url));
      return [
        ...previous,
        ...links.filter((link) => {
          if (seen.has(link.url)) return false;
          seen.add(link.url);
          return true;
        }),
      ];
    });
  };

  const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const { cleanText, links } = pullLinksFromText(event.target.value);
    if (cleanText === "/") {
      setInput("");
      setIsQuickPromptsOpen(true);
      return;
    }
    setInput(cleanText);
    addChatLinks(links);
  };

  const handleAttachmentInputChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void processTemplateV2Files(files);
  };

  const handlePaste = async (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files);
    if (chatInputDisabled) {
      return;
    }

    const pastedText = event.clipboardData.getData("text");
    const { cleanText, links } = pullLinksFromText(pastedText);

    if (variant === "template-v2" && files.length > 0) {
      event.preventDefault();
      addChatLinks(links);
      if (cleanText) {
        setInput((previous) => appendInputText(previous, cleanText));
      }
      void processTemplateV2Files(files);
      return;
    }

    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    if (imageFiles.length === 0 && links.length > 0) {
      event.preventDefault();
      setInput((previous) => appendInputText(previous, cleanText));
      addChatLinks(links);
      return;
    }

    if (imageFiles.length === 0) {
      return;
    }

    event.preventDefault();
    addChatLinks(links);
    if (cleanText) {
      setInput((previous) => appendInputText(previous, cleanText));
    }
    setIsUploadingPastedImage(true);
    try {
      const uploads = await Promise.all(
        imageFiles.map((file) => ImagesApi.uploadImage(file))
      );
      const nextImages = uploads
        .map((upload, index) => ({
          id: upload.id || createMessageId(),
          name: imageFiles[index]?.name || `Pasted image ${index + 1}`,
          url: upload.file_url || upload.path,
          file: imageFiles[index],
        }))
        .filter((image) => image.url);
      if (nextImages.length === 0) {
        throw new Error("Image upload did not return a URL.");
      }
      setPastedImages((previous) => [...previous, ...nextImages]);
      notify.success(
        "Đã dán hình ảnh",
        `${nextImages.length} hình ảnh đã sẵn sàng để dùng.`
      );
    } catch (error) {
      notify.error(
        "Không thể dán hình ảnh",
        error instanceof Error
          ? error.message
          : "Tải hình ảnh lên thất bại."
      );
    } finally {
      setIsUploadingPastedImage(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (chatInputDisabled) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage(input);
    }
  };

  const applyPrompt = (prompt: string) => {
    setInput(prompt);
    setIsQuickPromptsOpen(false);
    setErrorMessage(null);
    inputRef.current?.focus();
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (chatInputDisabled) return;
    if (variant !== "template-v2") return;
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    setIsDraggingAttachment(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    if (variant !== "template-v2") return;
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDraggingAttachment(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    if (chatInputDisabled) return;
    if (variant !== "template-v2") return;
    const files = Array.from(event.dataTransfer.files);
    const fileUri = getDroppedFileUri(event);
    if (files.length === 0 && !hasDraggedFiles(event) && !fileUri.startsWith("file:")) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingAttachment(false);
    if (files.length === 0) {
      notify.warning(
        "Không thể đính kèm tệp",
        "Hãy dùng nút đính kèm cho tệp này."
      );
      return;
    }
    void processTemplateV2Files(files);
  };

  const isTemplateV2Variant = variant === "template-v2";
  const showEditorEmptyState = !isHistoryLoading && messages.length === 0;
  const chatSlideReference =
    typeof currentSlide === "number" &&
      hiddenOverlaySlideReference !== currentSlide
      ? `Slide ${currentSlide + 1}`
      : "";
  const chatTargetReference = selectedTemplateV2Target
    ? selectedTemplateV2Target.kind === "multi-component"
      ? selectedTemplateV2Target.targetLabel ||
      `${selectedTemplateV2Target.components.length} components selected`
      : selectedTemplateV2Target.targetLabel ||
      selectedTemplateV2Target.componentLabel ||
      selectedTemplateV2Target.elementName ||
      selectedTemplateV2Target.elementType ||
      selectedTemplateV2Target.componentId ||
      selectedTemplateV2Target.kind
    : "";
  const clearChatTargetReference = onClearChatTargetReference;

  if (variant === "presentation" || isTemplateV2Variant) {
    return (
      <ChatEditorLayout
        messages={messages}
        isSending={isSending}
        isHistoryLoading={isHistoryLoading}
        chatInputDisabled={chatInputDisabled}
        isTemplateV2Variant={isTemplateV2Variant}
        input={input}
        errorMessage={errorMessage}
        pastedImages={pastedImages}
        attachedDocuments={attachedDocuments}
        chatLinks={chatLinks}
        isUploadingPastedImage={isUploadingPastedImage}
        isDraggingAttachment={isDraggingAttachment}
        isFollowAgentEnabled={isFollowAgentEnabled}
        isQuickPromptsOpen={isQuickPromptsOpen}
        chatSlideReference={chatSlideReference}
        chatTargetReference={chatTargetReference}
        previewFonts={getPresentationFonts(presentationData)}
        activeAssistantMessageId={activeAssistantMessageId}
        expandedEditPreviewByMessage={expandedEditPreviewByMessage}
        selectedEditVersionByMessage={selectedEditVersionByMessage}
        applyingEditPreviewMessageId={applyingEditPreviewMessageId}
        inputRef={inputRef}
        fileInputRef={fileInputRef}
        messagesEndRef={messagesEndRef}
        resetChat={resetChat}
        handleSubmit={handleSubmit}
        handleDragOver={handleDragOver}
        handleDragLeave={handleDragLeave}
        handleDrop={handleDrop}
        handleAttachmentInputChange={handleAttachmentInputChange}
        handleInputChange={handleInputChange}
        handlePaste={handlePaste}
        handleKeyDown={handleKeyDown}
        applyPrompt={applyPrompt}
        stopStreaming={stopStreaming}
        onClearChatSlideReference={onClearChatSlideReference}
        clearChatTargetReference={clearChatTargetReference}
        setChatLinks={setChatLinks}
        setPastedImages={setPastedImages}
        setAttachedDocuments={setAttachedDocuments}
        setIsFollowAgentEnabled={setIsFollowAgentEnabled}
        setIsQuickPromptsOpen={setIsQuickPromptsOpen}
        setExpandedEditPreviewByMessage={setExpandedEditPreviewByMessage}
        applyEditPreviewVersion={applyEditPreviewVersion}
        isPanelMaximized={isPanelMaximized}
        onTogglePanelMaximize={onTogglePanelMaximize}
      />
    );
  }

  return (
    <ChatPresentationLayout
      messages={messages}
      isSending={isSending}
      isHistoryLoading={isHistoryLoading}
      chatInputDisabled={chatInputDisabled}
      isTemplateV2Variant={isTemplateV2Variant}
      showEditorEmptyState={showEditorEmptyState}
      input={input}
      errorMessage={errorMessage}
      pastedImages={pastedImages}
      attachedDocuments={attachedDocuments}
      chatLinks={chatLinks}
      isUploadingPastedImage={isUploadingPastedImage}
      isDraggingAttachment={isDraggingAttachment}
      isFollowAgentEnabled={isFollowAgentEnabled}
      chatSlideReference={chatSlideReference}
      chatTargetReference={chatTargetReference}
      activeAssistantMessageId={activeAssistantMessageId}
      expandedActivityByMessage={expandedActivityByMessage}
      inputRef={inputRef}
      fileInputRef={fileInputRef}
      messagesEndRef={messagesEndRef}
      resetChat={resetChat}
      handleSubmit={handleSubmit}
      handleDragOver={handleDragOver}
      handleDragLeave={handleDragLeave}
      handleDrop={handleDrop}
      handleAttachmentInputChange={handleAttachmentInputChange}
      handleInputChange={handleInputChange}
      handlePaste={handlePaste}
      handleKeyDown={handleKeyDown}
      applyPrompt={applyPrompt}
      stopStreaming={stopStreaming}
      toggleActivityExpanded={toggleActivityExpanded}
      onClearChatSlideReference={onClearChatSlideReference}
      clearChatTargetReference={clearChatTargetReference}
      setChatLinks={setChatLinks}
      setPastedImages={setPastedImages}
      setAttachedDocuments={setAttachedDocuments}
      setIsFollowAgentEnabled={setIsFollowAgentEnabled}
    />
  );
};

export default Chat;
