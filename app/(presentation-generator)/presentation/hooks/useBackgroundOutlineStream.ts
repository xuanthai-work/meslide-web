import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { notify } from "@/components/ui/sonner";
import { useT } from "@/i18n/provider";
import {
  translateBackendError,
  translateBackendStatus,
} from "@/i18n/backend-messages";
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
  clearOutlines,
  setOutlines,
} from "@/store/slices/presentationGeneration";
import { store } from "@/store/store";
import { getApiUrl } from "@/utils/api";
import { limitOutlines } from "@/utils/presentationLimits";

const STALL_INTERVAL_MS = 1_000;

export type BackgroundOutlineStream = {
  lifecycle: GenerationLifecycleState;
  statusMessage: string;
  finalOutlineCount: number;
  canKeepWaiting: boolean;
  cancel: () => Promise<void>;
  keepWaiting: () => void;
  retry: () => void;
};

type OutlineStreamPayload = {
  type?: string;
  status?: unknown;
  status_code?: unknown;
  status_params?: Record<string, unknown> | null;
  code?: unknown;
  params?: Record<string, unknown> | null;
  detail?: unknown;
  error_code?: unknown;
  error_params?: Record<string, unknown> | null;
  presentation: {
    outlines: {
      slides?: { content?: unknown }[] | null;
    };
  };
};

function parseOutlineStreamPayload(raw: string): OutlineStreamPayload | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as OutlineStreamPayload;
  } catch {
    return null;
  }
}

export function useBackgroundOutlineStream(
  presentationId: string | null,
  enabled = true,
): BackgroundOutlineStream {
  const dispatch = useDispatch();
  const t = useT();
  const defaultStatus = t("outline.status.preparing");
  const [statusMessage, setStatusMessage] = useState(defaultStatus);
  const [lifecycle, setLifecycle] =
    useState<GenerationLifecycleState>("idle");
  const [stallCause, setStallCause] = useState<StallCause | null>(null);
  const [finalOutlineCount, setFinalOutlineCount] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const isClosedRef = useRef(false);
  const retryCountRef = useRef(0);
  const hasUsefulEventRef = useRef(false);
  const lastUsefulEventAtRef = useRef<number | null>(null);
  const streamStartedAtRef = useRef<number | null>(null);
  const lifecycleRef = useRef<GenerationLifecycleState>("idle");
  const stallCauseRef = useRef<StallCause | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stallIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const openStreamRef = useRef<() => void>(() => {});

  useEffect(() => {
    lifecycleRef.current = lifecycle;
  }, [lifecycle]);

  useEffect(() => {
    stallCauseRef.current = stallCause;
  }, [stallCause]);

  const closeStreamResources = useCallback(() => {
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
  }, []);

  // Stall watcher ticks outside the stream effect so both openStream and
  // keepWaiting can (re)start it. An onerror stall clears the interval, and
  // keepWaiting must be able to resume detection afterwards.
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
        const cause: StallCause = eventSourceRef.current ? "silence" : "socket";
        stallCauseRef.current = cause;
        setStallCause(cause);
        setLifecycle("stalled");
        setStatusMessage(t("outline.status.stalled"));
      }
    }, STALL_INTERVAL_MS);
  }, [t]);

  useEffect(() => {
    if (!enabled || !presentationId) {
      return;
    }
    if (store.getState().presentationGeneration.outlines.length > 0) {
      return;
    }

    let connectCancelled = false;

    const closeEventSourceLocal = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };

    const clearRetryTimerLocal = () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };

    const clearStallIntervalLocal = () => {
      if (stallIntervalRef.current) {
        clearInterval(stallIntervalRef.current);
        stallIntervalRef.current = null;
      }
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
      console.warn(`Outline stream retry ${retryCount}: ${reason}`);

      closeEventSourceLocal();
      clearRetryTimerLocal();
      setStatusMessage(t("outline.status.reconnecting"));
      setLifecycle("connecting");

      retryTimerRef.current = setTimeout(() => {
        if (!isClosedRef.current) {
          openStream();
        }
      }, retryDelay);

      return true;
    };

    const failStream = (message: string, title?: string) => {
      closeStreamResources();
      setLifecycle("failed");
      setStatusMessage(message);
      if (title) {
        notify.error(title, message);
      }
    };

    const openStream = () => {
      closeEventSourceLocal();
      clearStallIntervalLocal();

      // A hung connect must stall. Heartbeat is not useful and must not
      // refresh this clock.
      const now = Date.now();
      lastUsefulEventAtRef.current = now;
      if (streamStartedAtRef.current == null) {
        streamStartedAtRef.current = now;
      }
      lifecycleRef.current = "connecting";

      const eventSource = new EventSource(
        getApiUrl(`/api/v1/ppt/outlines/stream/${presentationId}`),
      );
      eventSourceRef.current = eventSource;

      eventSource.addEventListener("response", (event) => {
        const raw = event instanceof MessageEvent ? event.data : null;
        const data =
          typeof raw === "string" ? parseOutlineStreamPayload(raw) : null;
        if (!data?.type) {
          if (!scheduleRetry("invalid SSE payload")) {
            failStream(
              t("outline.toast.parseFailed.description"),
              t("outline.toast.parseFailed.title"),
            );
          }
          return;
        }

        if (isUsefulStreamEvent(data.type)) {
          if (!hasUsefulEventRef.current) {
            hasUsefulEventRef.current = true;
          }
          lastUsefulEventAtRef.current = Date.now();
        }

        switch (data.type) {
          case "status":
            if (data.status) setStatusMessage(translateBackendStatus(t, data));
            setLifecycle("generating");
            break;

          case "chunk":
            lastUsefulEventAtRef.current = Date.now();
            setLifecycle("generating");
            break;

          case "heartbeat":
            // Socket is alive. Not a useful event: do not refresh
            // lastUsefulEventAt. The stall watcher keeps running.
            break;

          case "complete": {
            let outlinesData: { content: string }[] = [];
            try {
              outlinesData = limitOutlines(
                data.presentation.outlines.slides ?? [],
              );
            } catch {
              outlinesData = [];
            }
            if (outlinesData.length === 0) {
              closeStreamResources();
              setLifecycle("failed");
              setStatusMessage(t("outline.toast.parseFailed.description"));
              break;
            }
            dispatch(setOutlines(outlinesData));
            setFinalOutlineCount(outlinesData.length);
            closeStreamResources();
            setLifecycle("complete");
            break;
          }

          case "closing":
            closeStreamResources();
            setLifecycle("failed");
            setStatusMessage(t("outline.toast.streamingFailed.title"));
            break;

          case "error":
            // The server already failed the job: do not silent-retry.
            closeStreamResources();
            setLifecycle("failed");
            notify.error(
              t("outline.toast.streamingFailed.title"),
              translateBackendError(t, data) ||
                t("outline.toast.connectFailed.description"),
            );
            setStatusMessage(
              translateBackendError(t, data) ||
                t("outline.toast.connectFailed.description"),
            );
            break;
        }
      });

      eventSource.onerror = () => {
        if (isClosedRef.current) {
          return;
        }
        if (!hasUsefulEventRef.current) {
          if (!scheduleRetry("connection lost")) {
            failStream(
              t("outline.toast.connectFailed.description"),
              t("outline.toast.connectionFailed.title"),
            );
          }
          return;
        }
        // After a useful event, a dead socket is a stall — do not reopen.
        closeEventSourceLocal();
        clearStallIntervalLocal();
        stallCauseRef.current = "socket";
        setStallCause("socket");
        setLifecycle("stalled");
        setStatusMessage(t("outline.status.stalled"));
      };

      clearStallIntervalLocal();
      startStallWatcher();
    };

    openStreamRef.current = openStream;
    isClosedRef.current = false;
    hasUsefulEventRef.current = false;
    retryCountRef.current = 0;
    lastUsefulEventAtRef.current = null;
    streamStartedAtRef.current = null;
    openStream();
    queueMicrotask(() => {
      if (connectCancelled || isClosedRef.current) return;
      setStallCause(null);
      setStatusMessage(defaultStatus);
      setLifecycle("connecting");
    });

    return () => {
      connectCancelled = true;
      closeStreamResources();
    };
  }, [
    closeStreamResources,
    defaultStatus,
    dispatch,
    enabled,
    presentationId,
    startStallWatcher,
    t,
  ]);

  const cancel = useCallback(async () => {
    setLifecycle("cancelling");
    closeStreamResources();
    dispatch(clearOutlines());
    setFinalOutlineCount(0);
    setLifecycle("cancelled");
  }, [closeStreamResources, dispatch]);

  const keepWaiting = useCallback(() => {
    if (!eventSourceRef.current) {
      return;
    }
    lastUsefulEventAtRef.current = Date.now();
    stallCauseRef.current = null;
    setStallCause(null);
    setLifecycle("generating");
    // An onerror stall clears the stall interval. Restart it so detection
    // continues if the user keeps waiting. Socket death is recovered by retry;
    // keepWaiting must not leave the watcher dead when the socket is still open.
    if (!stallIntervalRef.current) {
      startStallWatcher();
    }
  }, [startStallWatcher]);

  const retry = useCallback(() => {
    const fromState = lifecycleRef.current;
    if (fromState !== "stalled" && fromState !== "failed") {
      return;
    }
    hasUsefulEventRef.current = false;
    retryCountRef.current = 0;
    isClosedRef.current = false;
    lastUsefulEventAtRef.current = null;
    streamStartedAtRef.current = null;
    stallCauseRef.current = null;
    setStallCause(null);
    setFinalOutlineCount(0);
    setLifecycle("connecting");
    setStatusMessage(defaultStatus);
    openStreamRef.current();
  }, [defaultStatus]);

  const reportedLifecycle: GenerationLifecycleState =
    enabled && presentationId ? lifecycle : "idle";

  return {
    lifecycle: reportedLifecycle,
    statusMessage,
    finalOutlineCount,
    canKeepWaiting: shouldShowKeepWaiting(stallCause),
    cancel,
    keepWaiting,
    retry,
  };
}
