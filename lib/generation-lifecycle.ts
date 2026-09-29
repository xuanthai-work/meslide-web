export const STALL_MS = 45_000;
export const HEARTBEAT_IS_PROGRESS = false;
export const MAX_SILENT_RETRIES = 3;

export type GenerationSurface = "outline" | "presentation";
export type GenerationLifecycleState =
  | "idle" | "connecting" | "generating" | "stalled"
  | "cancelling" | "cancelled" | "failed" | "complete";

export type StreamEventType =
  | "status" | "chunk" | "slide_assets" | "fonts"
  | "complete" | "closing" | "error" | "heartbeat";

const USEFUL_EVENT_TYPES = new Set<StreamEventType>([
  "status", "chunk", "slide_assets", "fonts",
  "complete", "closing", "error",
]);

export function isUsefulStreamEvent(type: string): boolean {
  return USEFUL_EVENT_TYPES.has(type as StreamEventType);
}

export function silentRetryDelayMs(retryCount: number): number {
  return 1_000 * retryCount;
}

export function shouldSilentRetry(args: {
  retryCount: number; hasUsefulEvent?: boolean; closed: boolean;
}): boolean {
  if (args.closed) return false;
  return args.retryCount < MAX_SILENT_RETRIES;
}

export function needsCancelConfirm(draftCount: number): boolean {
  return draftCount > 0;
}

export function isStalled(args: {
  now: number; lastUsefulEventAt: number | null; state: GenerationLifecycleState | string;
}): boolean {
  if (args.state !== "generating" && args.state !== "connecting") return false;
  if (args.lastUsefulEventAt == null) return false;
  return args.now - args.lastUsefulEventAt >= STALL_MS;
}

export type StallCause = "silence" | "socket";

export function shouldShowKeepWaiting(
  cause: StallCause | null | undefined,
): boolean {
  return cause === "silence";
}

export type StreamTraceEvent = {
  type: StreamEventType | "disconnect" | "reconnect" | "unmount";
  at: number;
};

export type StreamTraceState = {
  state: GenerationLifecycleState;
  hasUsefulEvent: boolean;
  lastUsefulEventAt: number | null;
  retryCount: number;
  closed: boolean;
  socketOpen: boolean;
  retryTimer: boolean;
  stallTimer: boolean;
  applied: string[];
};

export function createStreamTraceState(): StreamTraceState {
  return {
    state: "connecting",
    hasUsefulEvent: false,
    lastUsefulEventAt: null,
    retryCount: 0,
    closed: false,
    socketOpen: true,
    retryTimer: false,
    stallTimer: true,
    applied: [],
  };
}

function closeTimers(state: StreamTraceState): StreamTraceState {
  return { ...state, socketOpen: false, retryTimer: false, stallTimer: false };
}

/** Shared socket policy for the outline and presentation streams. */
export function applyStreamTraceEvent(
  state: StreamTraceState,
  event: StreamTraceEvent,
): StreamTraceState {
  if (event.type === "unmount") {
    return { ...closeTimers(state), closed: true, applied: [...state.applied, "unmount"] };
  }
  if (state.closed) return state;

  if (event.type === "disconnect") {
    if (!state.hasUsefulEvent) {
      if (!shouldSilentRetry({
        retryCount: state.retryCount,
        hasUsefulEvent: false,
        closed: false,
      })) {
        return {
          ...closeTimers(state),
          closed: true,
          state: "failed",
          applied: [...state.applied, "disconnect-failed"],
        };
      }
      return {
        ...closeTimers(state),
        state: "connecting",
        retryCount: state.retryCount + 1,
        retryTimer: true,
        applied: [...state.applied, "disconnect-retry"],
      };
    }
    return {
      ...closeTimers(state),
      state: "stalled",
      applied: [...state.applied, "disconnect-stall"],
    };
  }

  if (event.type === "reconnect") {
    if (!state.retryTimer) return state;
    return {
      ...state,
      state: "connecting",
      socketOpen: true,
      retryTimer: false,
      stallTimer: true,
      applied: [...state.applied, "reconnect"],
    };
  }

  if (!isUsefulStreamEvent(event.type)) {
    return { ...state, applied: [...state.applied, event.type] };
  }

  const generating = event.type !== "complete" && event.type !== "closing" && event.type !== "error";
  const finished = event.type === "complete" || event.type === "closing" || event.type === "error";
  const next: StreamTraceState = {
    ...state,
    hasUsefulEvent: true,
    lastUsefulEventAt: event.at,
    state: finished ? (event.type === "error" ? "failed" : "complete") : "generating",
    applied: [...state.applied, event.type],
  };
  if (!generating) {
    return { ...closeTimers(next), closed: true };
  }
  return next;
}

export function replayStreamTrace(events: StreamTraceEvent[]): StreamTraceState {
  return events.reduce(applyStreamTraceEvent, createStreamTraceState());
}
