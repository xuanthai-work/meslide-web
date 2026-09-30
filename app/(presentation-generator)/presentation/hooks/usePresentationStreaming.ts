import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  clearPresentationData,
  setPresentationData,
  setStreaming,
  type PresentationData,
} from "@/store/slices/presentationGeneration";
import { jsonrepair } from "jsonrepair";
import { notify } from "@/components/ui/sonner";
import { getApiUrl, normalizeBackendAssetUrls } from "@/utils/api";
import { store, type RootState } from "@/store/store";
import {
  mergeSingleSlidePreservingResolvedAssets,
  mergeSlidesPreservingResolvedAssets,
} from "../utils/streamAssetMerge";
import { isTemplateV2Slide } from "../../_shared/blank-slide";
import { PresentationGenerationApi } from "../../services/api/presentation-generation";
import {
  isStalled,
  isUsefulStreamEvent,
  shouldShowKeepWaiting,
  shouldSilentRetry,
  silentRetryDelayMs,
  type GenerationLifecycleState,
  type StallCause,
} from "@/lib/generation-lifecycle";
import {
  translateBackendError,
  translateBackendStatus,
} from "@/lib/backend-messages";

const MAX_STREAM_RETRIES = 3;
const STALL_INTERVAL_MS = 1_000;

const STREAMING_STATES: ReadonlySet<GenerationLifecycleState> = new Set([
  "connecting",
  "generating",
  "stalled",
  "cancelling",
]);

function mergePresentationPreservingTemplateData(
  incoming: PresentationData
): PresentationData {
  const prev = store.getState().presentationGeneration.presentationData;
  if (!prev) return incoming;

  return {
    ...prev,
    ...incoming,
    layout: incoming.layout ?? prev.layout,
    version: incoming.version ?? prev.version,
    theme: incoming.theme ?? prev.theme,
    structure: (incoming as any).structure ?? (prev as any).structure,
    slides: Array.isArray(incoming.slides)
      ? mergeSlidesPreservingResolvedAssets(prev.slides, incoming.slides)
      : prev.slides,
  } as PresentationData;
}

function parseStreamedSlideChunk(chunk: unknown): any | null {
  if (typeof chunk !== "string" || !chunk.trim()) return null;
  try {
    const parsed = JSON.parse(chunk);
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      typeof parsed.layout === "string" &&
      typeof parsed.index === "number" &&
      parsed.content &&
      typeof parsed.content === "object"
    ) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

function hasTemplateV2LayoutPayload(layout: unknown): boolean {
  if (!layout || typeof layout !== "object") return false;
  const layouts = (layout as any).layouts;
  if (Array.isArray(layouts)) return true;
  return Boolean(
    layouts &&
      typeof layouts === "object" &&
      Array.isArray((layouts as any).layouts)
  );
}

function isTemplateV2SlidePayload(slide: unknown): boolean {
  return isTemplateV2Slide(slide);
}

function isTemplateV2PresentationPayload(presentation: unknown): boolean {
  if (!presentation || typeof presentation !== "object") return false;
  const record = presentation as Record<string, unknown>;
  return (
    hasTemplateV2LayoutPayload(record.layout) ||
    (Array.isArray(record.slides) && record.slides.some(isTemplateV2SlidePayload))
  );
}

export const usePresentationStreaming = (
  presentationId: string,
  stream: string | null,
  setLoading: (loading: boolean) => void,
  setError: (error: boolean) => void,
  fetchUserSlides: (options?: {
    clearHistory?: boolean;
  }) => void | Promise<unknown>,
  options: {
    preloadPresentationData?: boolean;
    skipSlideFetch?: boolean;
  } = {}
) => {
  const dispatch = useDispatch();
  const presentationData = useSelector(
    (state: RootState) => state.presentationGeneration.presentationData
  );
  const previousSlidesLength = useRef(0);
  const preloadPresentationData = Boolean(options.preloadPresentationData);
  const skipSlideFetch = Boolean(options.skipSlideFetch);
  const defaultStatusMessage = "Đang tạo bài thuyết trình của bạn";

  const [lifecycle, setLifecycle] =
    useState<GenerationLifecycleState>("idle");
  const [stallCause, setStallCause] = useState<StallCause | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>(
    defaultStatusMessage
  );

  const eventSourceRef = useRef<EventSource | null>(null);
  const isClosedRef = useRef(false);
  const retryCountRef = useRef(0);
  const hasUsefulEventRef = useRef(false);
  const lastUsefulEventAtRef = useRef<number | null>(null);
  const streamStartedAtRef = useRef<number | null>(null);
  const lifecycleRef = useRef<GenerationLifecycleState>("idle");
  const stallCauseRef = useRef<StallCause | null>(null);
  const statusMessageRef = useRef<string>(defaultStatusMessage);
  const accumulatedChunksRef = useRef<string>("");
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stallIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const openStreamRef = useRef<() => void>(() => {});
  // Epoch of the latest openStream(). A retry while `stream` is still set
  // supersedes the effect's epoch so the effect teardown does not close the
  // replacement socket. Unmount still closes via presentationStreamMountedRef.
  const streamEpochRef = useRef(0);
  const supersedeStreamEpochRef = useRef(false);
  const presentationStreamMountedRef = useRef(false);
  // Assigned inside the stream effect so the hook-body stall watcher can
  // trigger an automatic retry instead of surfacing a stalled popup.
  const scheduleRetryRef = useRef<((reason: string) => boolean) | null>(null);
  const finalizeFailureRef = useRef<((description: string) => void) | null>(
    null
  );

  useEffect(() => {
    presentationStreamMountedRef.current = true;
    return () => {
      presentationStreamMountedRef.current = false;
    };
  }, []);

  // Keep lifecycle ref in sync so the stall watcher can read the latest state.
  useEffect(() => {
    lifecycleRef.current = lifecycle;
  }, [lifecycle]);

  useEffect(() => {
    stallCauseRef.current = stallCause;
  }, [stallCause]);

  // Keep statusMessage ref in sync so stall detection reads the latest value.
  useEffect(() => {
    statusMessageRef.current = statusMessage;
  }, [statusMessage]);

  // Stall watcher: ticks every STALL_INTERVAL_MS and flips lifecycle to
  // "stalled" when no useful event has arrived for STALL_MS. Defined in the
  // hook body (not the effect) so both openStream and keepWaiting can (re)start
  // it — important because an onerror-stall clears the interval, and
  // keepWaiting must be able to resume stall detection afterwards.
  const startStallWatcher = useCallback(() => {
    if (stallIntervalRef.current) {
      return;
    }
    stallIntervalRef.current = setInterval(() => {
      const now = Date.now();
      if (
        isStalled({
          now,
          lastUsefulEventAt: lastUsefulEventAtRef.current,
          state: lifecycleRef.current,
        })
      ) {
        // Auto-retry on stall (up to MAX_SILENT_RETRIES) while keeping the
        // loading UI. Only surface a failure once retries are exhausted.
        const retry = scheduleRetryRef.current;
        if (retry && retry("stream stalled")) {
          return;
        }
        const cause: StallCause = eventSourceRef.current ? "silence" : "socket";
        stallCauseRef.current = cause;
        setStallCause(cause);
        finalizeFailureRef.current?.("Luồng tạo bài thuyết trình đang tạm dừng — đang chờ máy chủ.");
      }
    }, STALL_INTERVAL_MS);
  }, []);

  useEffect(() => {
    if (!stream) {
      const lifecycleState = lifecycleRef.current;
      // Cancelled stays stopped. An in-flight retry (connecting / generating /
      // stalled) must also survive the later stream → null commit; resetting
      // those to idle dismisses the toast and may fetch slides under a live socket.
      const preserveLifecycle =
        lifecycleState === "cancelled" ||
        lifecycleState === "connecting" ||
        lifecycleState === "generating" ||
        lifecycleState === "stalled";
      if (!preserveLifecycle) {
        setLifecycle("idle");
        if (!skipSlideFetch) {
          fetchUserSlides();
        }
      }
      // retry() can reopen the leftover controller while stream is null.
      // Close that socket and its timers on the next run or unmount so a
      // later idle reset cannot fetch slides against a live EventSource.
      return () => {
        isClosedRef.current = true;
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
        if (stallIntervalRef.current) {
          clearInterval(stallIntervalRef.current);
          stallIntervalRef.current = null;
        }
      };
    }

    let accumulatedChunks = "";
    const shownAssetWarnings = new Set<string>();
    let preloadAttempted = false;
    let preloadRequest: Promise<void> | null = null;
    const streamStartedAt = Date.now();
    let streamIsTemplateV2 = preloadPresentationData;
    const localizeBackendStatus = (status: string) => {
      const known: Record<string, string> = {
        "Reading source documents": "Đang đọc tài liệu nguồn",
        "Searching the web": "Đang tìm kiếm trên web",
        "Designing the complete presentation": "Đang thiết kế toàn bộ bài thuyết trình",
      };
      return known[status] ?? status;
    };

    streamStartedAtRef.current = streamStartedAt;
    isClosedRef.current = false;
    supersedeStreamEpochRef.current = false;
    hasUsefulEventRef.current = false;
    retryCountRef.current = 0;
    accumulatedChunksRef.current = "";
    lastUsefulEventAtRef.current = null;

    const closeEventSource = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };

    const clearRetryTimer = () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };

    const clearStallInterval = () => {
      if (stallIntervalRef.current) {
        clearInterval(stallIntervalRef.current);
        stallIntervalRef.current = null;
      }
    };

    const finalizeFailure = (description: string) => {
      console.error("Presentation streaming failed", description);
      closeEventSource();
      clearRetryTimer();
      clearStallInterval();
      setLoading(false);
      dispatch(setStreaming(false));
      setError(true);
      setStatusMessage(description);
      setLifecycle("failed");
      removeStreamParamFromUrl();
    };

    const scheduleRetry = (reason: string): boolean => {
      const shouldRetry = shouldSilentRetry({
        retryCount: retryCountRef.current,
        hasUsefulEvent: hasUsefulEventRef.current,
        closed: isClosedRef.current,
      });
      if (!shouldRetry) {
        return false;
      }

      const retryCount = (retryCountRef.current += 1);
      const retryDelay = silentRetryDelayMs(retryCount);
      console.warn(
        `Presentation stream retry ${retryCount}/${MAX_STREAM_RETRIES}: ${reason}`
      );

      closeEventSource();
      clearRetryTimer();
      clearStallInterval();
      accumulatedChunks = "";
      accumulatedChunksRef.current = "";
      previousSlidesLength.current = 0;
      setStatusMessage("Đang kết nối lại luồng tạo bài thuyết trình");
      setLifecycle("connecting");

      retryTimerRef.current = setTimeout(() => {
        if (!isClosedRef.current) {
          openStream();
        }
      }, retryDelay);

      return true;
    };

    // Expose the retry/failure helpers to the hook-body stall watcher so a
    // stall auto-retries (keeping the loading UI) instead of showing a popup.
    scheduleRetryRef.current = scheduleRetry;
    finalizeFailureRef.current = finalizeFailure;

    const preloadPreparedPresentation = async (force = false) => {
      if ((!preloadPresentationData && !force) || preloadAttempted) return;
      if (preloadRequest) return preloadRequest;

      preloadAttempted = true;
      preloadRequest = (async () => {
        try {
          const response = await fetch(
            getApiUrl(`/api/v1/ppt/presentation/${presentationId}`),
            {
              credentials: "include",
            }
          );
          if (!response.ok) {
            throw new Error("Failed to preload prepared presentation.");
          }
          const preparedPresentation = normalizeBackendAssetUrls(
            await response.json()
          );
          if (!isClosedRef.current) {
            const prev = store.getState().presentationGeneration.presentationData;
            streamIsTemplateV2 =
              streamIsTemplateV2 ||
              isTemplateV2PresentationPayload(preparedPresentation);
            dispatch(
              setPresentationData({
                ...(prev ?? {}),
                ...(preparedPresentation as PresentationData),
                slides: prev?.slides ?? (preparedPresentation as any).slides,
              } as PresentationData)
            );
          }
        } catch (error) {
          console.warn("Could not preload prepared presentation:", error);
        } finally {
          preloadRequest = null;
        }
      })();

      return preloadRequest;
    };

    const trackTemplateV2StreamCompleted = (presentation: unknown) => {
      if (!streamIsTemplateV2 && !isTemplateV2PresentationPayload(presentation)) {
        return;
      }
      streamIsTemplateV2 = true;
    };

    const updateGeneratingStatus = (slidesLength: number) => {
      const total =
        store.getState().presentationGeneration.presentationData?.structure
          ?.slides?.length ?? 0;
      setStatusMessage(
        total
          ? `Đang tạo slide ${slidesLength}/${total}…`
          : `Đang tạo slide ${slidesLength}…`
      );
    };

    const removeStreamParamFromUrl = () => {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("stream");
      window.history.replaceState({}, "", newUrl.toString());
    };

    // Epoch this effect is allowed to close. Later non-superseding opens
    // (silent retry) move it forward. A user retry detaches instead.
    let ownedStreamEpoch = streamEpochRef.current;
    let streamCloseDetached = false;

    const openStream = () => {
      const epoch = ++streamEpochRef.current;
      if (supersedeStreamEpochRef.current) {
        supersedeStreamEpochRef.current = false;
        streamCloseDetached = true;
      } else if (!streamCloseDetached) {
        ownedStreamEpoch = epoch;
      }

      closeEventSource();
      clearStallInterval();

      // Start each (re)open from a clean buffer so a new job (e.g. after retry)
      // does not append to stale partial JSON. Also reset the slide-diff ref
      // so the new job's slides are not diffed against the previous job's.
      accumulatedChunks = "";
      accumulatedChunksRef.current = "";
      previousSlidesLength.current = 0;

      // Stream just (re)opened: reset stall clock so a hung CONNECT also stalls
      // after STALL_MS. Heartbeat is NOT useful, so it must not refresh this.
      const now = Date.now();
      lastUsefulEventAtRef.current = now;
      if (streamStartedAtRef.current == null) {
        streamStartedAtRef.current = now;
      }
      setLifecycle("connecting");

      const eventSource = new EventSource(
        getApiUrl(`/api/v1/ppt/presentation/stream/${presentationId}`)
      );
      eventSourceRef.current = eventSource;

      eventSource.addEventListener("response", async (event) => {
        let data: any;
        try {
          data = JSON.parse(event.data);
        } catch {
          if (!scheduleRetry("invalid SSE payload")) {
            finalizeFailure("Failed to parse stream response.");
          }
          return;
        }

        if (isUsefulStreamEvent(data.type)) {
          if (!hasUsefulEventRef.current) {
            hasUsefulEventRef.current = true;
          }
          lastUsefulEventAtRef.current = Date.now();
          // A useful event recovers stalled → generating. Do NOT guard with
          // !== "stalled": isStalled already returns false for stalled state,
          // so this organic recovery matches the Task 5 fix.
          if (
            data.type !== "complete" &&
            data.type !== "closing" &&
            data.type !== "error"
          ) {
            setLifecycle("generating");
          }
        }

        switch (data.type) {
          case "fonts": {
            if (data.fonts && typeof data.fonts === "object") {
              const prev = store.getState().presentationGeneration.presentationData;
              dispatch(
                setPresentationData({
                  ...(prev ?? {}),
                  fonts: data.fonts,
                  slides: prev?.slides ?? [],
                } as PresentationData)
              );
            }
            break;
          }

          case "chunk":
            accumulatedChunks += data.chunk;
            accumulatedChunksRef.current = accumulatedChunks;
            const streamedSlide = parseStreamedSlideChunk(data.chunk);
            if (streamedSlide) {
              const prev = store.getState().presentationGeneration.presentationData;
              const normalizedSlide = normalizeBackendAssetUrls(streamedSlide);
              const mergedSlides = mergeSingleSlidePreservingResolvedAssets(
                prev?.slides,
                normalizedSlide
              );
              dispatch(
                setPresentationData({
                  ...(prev ?? {}),
                  slides: mergedSlides,
                } as PresentationData)
              );
              previousSlidesLength.current = mergedSlides.length;
              updateGeneratingStatus(mergedSlides.length);
              setLoading(false);
              if (
                isTemplateV2SlidePayload(normalizedSlide) &&
                !hasTemplateV2LayoutPayload(prev?.layout)
              ) {
                streamIsTemplateV2 = true;
                void preloadPreparedPresentation(true);
              }
            }

            try {
              const repairedJson = jsonrepair(accumulatedChunks);
              const partialData = JSON.parse(repairedJson);
              const normalizedPartialData = normalizeBackendAssetUrls(partialData);

              if (
                normalizedPartialData.slides &&
                normalizedPartialData.slides.length > 0
              ) {
                const prev =
                  store.getState().presentationGeneration.presentationData;
                const mergedSlides = normalizedPartialData.slides.reduce(
                  (slides: any[], slide: any) =>
                    mergeSingleSlidePreservingResolvedAssets(slides, slide),
                  prev?.slides ?? []
                );
                dispatch(
                  setPresentationData({
                    ...(prev ?? {}),
                    ...normalizedPartialData,
                    slides: mergedSlides,
                  } as PresentationData)
                );
                previousSlidesLength.current = mergedSlides.length;
                updateGeneratingStatus(mergedSlides.length);
                setLoading(false);
              }
            } catch {
              // JSON isn't complete yet, continue accumulating
            }
            break;

          case "slide_assets": {
            if (
              data.slide &&
              typeof data.slide === "object"
            ) {
              const prev = store.getState().presentationGeneration.presentationData;
              const normalizedSlide = normalizeBackendAssetUrls(data.slide);
              const mergedSlides = mergeSingleSlidePreservingResolvedAssets(
                prev?.slides,
                normalizedSlide
              );
              dispatch(
                setPresentationData({
                  ...(prev ?? {}),
                  slides: mergedSlides,
                } as PresentationData)
              );
              if (
                isTemplateV2SlidePayload(normalizedSlide) &&
                !hasTemplateV2LayoutPayload(prev?.layout)
              ) {
                streamIsTemplateV2 = true;
                void preloadPreparedPresentation(true);
              }
            }
            if (Array.isArray(data.warnings)) {
              for (const warning of data.warnings) {
                if (!warning || typeof warning !== "object") {
                  continue;
                }
                const errorCode =
                  typeof warning.error_code === "string" ? warning.error_code : null;
                const legacyDetail =
                  typeof warning.detail === "string" && warning.detail.length > 0
                    ? warning.detail
                    : null;
                if (!errorCode && !legacyDetail) {
                  continue;
                }
                // Coded warnings (image search / generation) localize through
                // the catalog; legacy plain-text warnings stay verbatim.
                const detail = errorCode
                  ? translateBackendError({
                      detail: legacyDetail,
                      error_code: errorCode,
                    })
                  : legacyDetail;
                if (!detail) {
                  continue;
                }
                const dedupeKey = errorCode ?? detail;
                if (shownAssetWarnings.has(dedupeKey)) {
                  continue;
                }
                shownAssetWarnings.add(dedupeKey);
                const title = errorCode?.startsWith("image_search.")
                  ? "Một số ảnh slide dùng ảnh giữ chỗ"
                  : "Không thể tạo một số hình ảnh";
                notify.warning(title, detail, {
                  duration: 12_000,
                });
              }
            }
            break;
          }

          case "complete":
            try {
              const hasCompletePresentation =
                data.presentation &&
                typeof data.presentation === "object" &&
                !Array.isArray(data.presentation);
              const completedPresentation: unknown = hasCompletePresentation
                ? data.presentation
                : null;

              if (hasCompletePresentation) {
                dispatch(
                  setPresentationData(
                    mergePresentationPreservingTemplateData(
                      normalizeBackendAssetUrls(
                        data.presentation
                      ) as PresentationData
                    )
                  )
                );
              } else {
                throw new Error("Completion event did not contain a presentation");
              }

              if (!completedPresentation) {
                throw new Error("Completed presentation could not be loaded");
              }

              trackTemplateV2StreamCompleted(completedPresentation);
              dispatch(setStreaming(false));
              setLoading(false);
              isClosedRef.current = true;
              closeEventSource();
              clearRetryTimer();
              clearStallInterval();
              retryCountRef.current = 0;
              setStatusMessage("Bài thuyết trình đã sẵn sàng");
              setLifecycle("complete");

              // Remove stream parameter from URL
              removeStreamParamFromUrl();
            } catch (error) {
              console.error("Could not finalize presentation stream:", error);
              if (!scheduleRetry("failed to parse complete payload")) {
                finalizeFailure("Không thể tải bài thuyết trình đã hoàn tất.");
              }
            }
            accumulatedChunks = "";
            accumulatedChunksRef.current = "";
            break;

          case "closing":
            dispatch(
              setPresentationData(
                mergePresentationPreservingTemplateData(
                  normalizeBackendAssetUrls(data.presentation) as PresentationData
                )
              )
            );
            trackTemplateV2StreamCompleted(data.presentation);
            setLoading(false);
            dispatch(setStreaming(false));
            isClosedRef.current = true;
            closeEventSource();
            clearRetryTimer();
            clearStallInterval();
            retryCountRef.current = 0;
            setStatusMessage("Bài thuyết trình đã sẵn sàng");
            setLifecycle("complete");

            // Remove stream parameter from URL
            removeStreamParamFromUrl();
            break;

          case "error":
            // Do not surface the failure immediately: try to auto-retry
            // (reconnect and resume from the saved prefix) first.
            if (scheduleRetry("backend error: " + (data.detail || ""))) {
              break;
            }
            finalizeFailure(
              translateBackendError(data) ||
                "Không thể kết nối với máy chủ. Vui lòng thử lại."
            );
            break;

          case "status":
            if (data.status) {
              setStatusMessage(translateBackendStatus({
                ...data,
                status: localizeBackendStatus(data.status),
              }));
            }
            break;

          case "heartbeat":
            // Socket is alive. NOT a useful event: do NOT refresh
            // lastUsefulEventAt. No-op so the stall watcher keeps running.
            break;
        }
      });

      eventSource.onerror = () => {
        if (isClosedRef.current) {
          return;
        }
        // Socket error/disconnect: auto-retry (up to MAX_SILENT_RETRIES) while
        // keeping the loading UI, regardless of whether slides were already
        // streamed. Only report failure once retries are exhausted.
        if (scheduleRetry("socket error/disconnect")) {
          return;
        }
        finalizeFailure("Không thể kết nối với máy chủ. Vui lòng thử lại.");
      };

      // Stall watcher: ticks every STALL_INTERVAL_MS and flips to "stalled"
      // when no useful event has arrived for STALL_MS. Uses the shared
      // startStallWatcher so keepWaiting can resume detection after an
      // onerror-stall cleared the interval.
      clearStallInterval();
      startStallWatcher();
    };

    openStreamRef.current = openStream;

    const startStream = async () => {
      dispatch(setStreaming(true));
      dispatch(clearPresentationData());
      setStatusMessage(defaultStatusMessage);
      setLifecycle("connecting");
      await preloadPreparedPresentation();
      if (!isClosedRef.current) {
        openStream();
      }
    };

    void startStream();

    return () => {
      const epochStillCurrent =
        !streamCloseDetached && streamEpochRef.current === ownedStreamEpoch;
      // A superseded retry owns the replacement EventSource. Leave it open
      // when `stream` flips to null. Unmount still closes the socket.
      if (presentationStreamMountedRef.current && !epochStillCurrent) {
        return;
      }
      isClosedRef.current = true;
      closeEventSource();
      clearRetryTimer();
      clearStallInterval();
    };
  }, [
    presentationId,
    stream,
    dispatch,
    setLoading,
    setError,
    fetchUserSlides,
    skipSlideFetch,
    preloadPresentationData,
    defaultStatusMessage,
    startStallWatcher,
  ]);

  // isStreaming is derived from lifecycle so it always agrees.
  const isStreaming = STREAMING_STATES.has(lifecycle);

  // draftCount read from the store reactively (slides length).
  const draftCount = presentationData?.slides?.length ?? 0;

  const cancel = useCallback(async () => {
    setLifecycle("cancelling");
    isClosedRef.current = true;
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (stallIntervalRef.current) {
      clearInterval(stallIntervalRef.current);
      stallIntervalRef.current = null;
    }
    dispatch(setStreaming(false));
    setLoading(false);
    lifecycleRef.current = "cancelled";
    setLifecycle("cancelled");

    if (typeof window !== "undefined") {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("stream");
      window.history.replaceState({}, "", newUrl.toString());
    }
    // Cancelled is set before URL synchronization so the stopped state and
    // retry action survive, while draft persistence remains best-effort and
    // unchanged. Do NOT clearPresentationData: cancel keeps the current Redux
    // slides as the draft.
    const presentationData = store.getState().presentationGeneration.presentationData;
    const slides = presentationData?.slides;
    if (Array.isArray(slides) && slides.length > 0) {
      try {
        await PresentationGenerationApi.updatePresentationContent(
          JSON.stringify(presentationData)
        );
      } catch {
        notify.error(
          "Bản nháp chưa được lưu",
          "Việc tải lại có thể làm mất các slide đã dừng."
        );
      }
    }
  }, [dispatch, setLoading]);

  const keepWaiting = useCallback(() => {
    if (!eventSourceRef.current) {
      return;
    }
    lastUsefulEventAtRef.current = Date.now();
    stallCauseRef.current = null;
    setStallCause(null);
    setLifecycle("generating");
    // An onerror-stall clears the stall interval. Restart it here so stall
    // detection continues if the user opts to keep waiting after a socket
    // death (intended recovery after socket death is retry, but keepWaiting
    // must not leave the watcher dead).
    if (!stallIntervalRef.current) {
      startStallWatcher();
    }
  }, [startStallWatcher]);

  const retry = useCallback(() => {
    const fromState = lifecycleRef.current;
    if (
      fromState !== "stalled" &&
      fromState !== "failed" &&
      fromState !== "cancelled"
    ) {
      return;
    }
    hasUsefulEventRef.current = false;
    retryCountRef.current = 0;
    isClosedRef.current = false;
    accumulatedChunksRef.current = "";
    previousSlidesLength.current = 0;
    lastUsefulEventAtRef.current = null;
    streamStartedAtRef.current = null;
    stallCauseRef.current = null;
    setStallCause(null);
    dispatch(setStreaming(true));
    setError(false);
    lifecycleRef.current = "connecting";
    setLifecycle("connecting");
    setStatusMessage(defaultStatusMessage);
    // Detach this open from the active stream effect so a later stream → null
    // cleanup does not close the replacement EventSource.
    supersedeStreamEpochRef.current = true;
    openStreamRef.current();
  }, [defaultStatusMessage, dispatch, setError]);

  return {
    lifecycle,
    isStreaming,
    statusMessage,
    draftCount,
    canKeepWaiting: shouldShowKeepWaiting(stallCause),
    cancel,
    keepWaiting,
    retry,
  };
};
