"use client";

import React, { useEffect, useRef } from "react";

import { notify } from "@/components/ui/sonner";
import {
  needsCancelConfirm,
  type GenerationLifecycleState,
} from "@/lib/generation-lifecycle";

type Props = {
  surface: "outline" | "presentation";
  lifecycle: GenerationLifecycleState;
  statusMessage: string;
  draftCount: number;
  totalCount?: number | null;
  canKeepWaiting?: boolean;
  onCancel: () => void;
  onKeepWaiting: () => void;
  onRetry: () => void;
  className?: string;
};

const GENERATION_TOAST_ID = "generation-status";

type ActionKey = "keepWaiting" | "retry" | "stop";

function GenerationToastActions({
  actions,
  onKeepWaiting,
  onRetry,
  onStop,
}: {
  actions: ActionKey[];
  onKeepWaiting: () => void;
  onRetry: () => void;
  onStop: () => void;
}) {
  return (
    <div className="generation-toast-actions" data-dismissible="false">
      {actions.includes("keepWaiting") && (
        <button
          type="button"
          data-button
          data-dismissible="false"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onKeepWaiting}
        >
          {"Tiếp tục chờ"}
        </button>
      )}
      {actions.includes("retry") && (
        <button
          type="button"
          data-button
          data-dismissible="false"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onRetry}
        >
          {"Thử lại"}
        </button>
      )}
      {actions.includes("stop") && (
        <button
          type="button"
          data-button
          data-dismissible="false"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onStop}
        >
          {"Dừng"}
        </button>
      )}
    </div>
  );
}

const GenerationStatusBar: React.FC<Props> = ({
  surface,
  lifecycle,
  statusMessage,
  draftCount,
  totalCount,
  onCancel,
  onKeepWaiting,
  onRetry,
}) => {
  const onCancelRef = useRef(onCancel);
  const onKeepWaitingRef = useRef(onKeepWaiting);
  const onRetryRef = useRef(onRetry);

  useEffect(() => {
    onCancelRef.current = onCancel;
    onKeepWaitingRef.current = onKeepWaiting;
    onRetryRef.current = onRetry;
  }, [onCancel, onKeepWaiting, onRetry]);

  const handleStop = () => {
    const outlineDraftVisible = surface === "outline" && draftCount > 0;
    if (outlineDraftVisible) {
      const message = `Dừng tạo dàn ý? ${draftCount} mục đã tạo sẽ được giữ lại.`;
      if (!window.confirm(message)) return;
    } else if (surface !== "outline" && needsCancelConfirm(draftCount)) {
      const message = `Dừng tạo slide? ${draftCount}/${(totalCount ?? draftCount)} slide đã tạo sẽ được giữ lại.`;
      if (!window.confirm(message)) return;
    }
    void onCancelRef.current();
    if (surface === "outline") {
      notify.success(
        draftCount > 0
          ? "Đã dừng tạo. Bản nháp hiện tại đã được giữ lại."
          : "Đã dừng tạo.",
      );
    }
  };

  useEffect(() => {
    if (
      lifecycle === "idle" ||
      lifecycle === "complete" ||
      (lifecycle === "cancelled" && surface !== "presentation")
    ) {
      notify.dismiss(GENERATION_TOAST_ID);
      return;
    }

    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      const baseOptions = {
        id: GENERATION_TOAST_ID,
        duration: Infinity,
        closeButton: false,
        dismissible: false,
        testId: "generation-status-toast",
        className: "generation-status-toast",
      } as const;

      const toastActions = (actions: ActionKey[]) => (
        <GenerationToastActions
          actions={actions}
          onKeepWaiting={() => void onKeepWaitingRef.current()}
          onRetry={() => void onRetryRef.current()}
          onStop={handleStop}
        />
      );

      const publishOptions = (options: {
        description: string | undefined;
        action: React.ReactNode | undefined;
      }) => ({
        ...baseOptions,
        description: options.description,
        action: options.action,
      });

      switch (lifecycle) {
        case "connecting":
        case "generating":
          notify.loading(
            statusMessage,
            undefined,
            publishOptions({
              description: undefined,
              action: toastActions(["stop"]),
            }),
          );
          break;
        case "stalled": {
          // Auto-retry is handled by the stream hook. Keep the loading UI
          // visible and never show action buttons (keep waiting / retry / stop).
          notify.loading(
            statusMessage || "Đang tạo bài thuyết trình của bạn",
            undefined,
            publishOptions({
              description: undefined,
              action: undefined,
            }),
          );
          break;
        }
        case "cancelling":
          notify.loading(
            "Đang dừng…",
            undefined,
            publishOptions({
              description: undefined,
              action: undefined,
            }),
          );
          break;
        case "failed": {
          const title =
            surface === "outline"
              ? "Tạo luồng dàn ý thất bại"
              : "Tạo bài thuyết trình thất bại";
          notify.error(
            title,
            undefined,
            publishOptions({
              description: statusMessage,
              action: toastActions(["retry", "stop"]),
            }),
          );
          break;
        }
        case "cancelled":
          if (surface === "presentation") {
            notify.success(
              draftCount > 0
                ? "Đã dừng tạo. Bản nháp hiện tại đã được giữ lại."
                : "Đã dừng tạo.",
              undefined,
              publishOptions({
                description: undefined,
                action: toastActions(["retry"]),
              }),
            );
          }
          break;
        default:
          break;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    lifecycle,
    statusMessage,
    surface,
    draftCount,
    totalCount,
  ]);

  useEffect(
    () => () => {
      notify.dismiss(GENERATION_TOAST_ID);
    },
    [],
  );

  return null;
};

export default GenerationStatusBar;
