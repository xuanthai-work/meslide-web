"use client";

import React, { useEffect, useRef } from "react";

import { notify } from "@/components/ui/sonner";
import {
  needsCancelConfirm,
  type GenerationLifecycleState,
} from "@/lib/generation-lifecycle";
import { useT } from "@/i18n/provider";

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
  const t = useT();
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
          {t("common.generation.keepWaiting")}
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
          {t("common.generation.retry")}
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
          {t("common.generation.stop")}
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
  const t = useT();
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
      const message = t("common.generation.stopOutlineConfirm", {
        count: draftCount,
      });
      if (!window.confirm(message)) return;
    } else if (surface !== "outline" && needsCancelConfirm(draftCount)) {
      const message = t("common.generation.stopSlidesConfirm", {
        draft: draftCount,
        total: totalCount ?? draftCount,
      });
      if (!window.confirm(message)) return;
    }
    void onCancelRef.current();
    if (surface === "outline") {
      notify.success(
        draftCount > 0
          ? t("presentation.status.stoppedWithDraft")
          : t("presentation.status.stopped"),
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
            statusMessage || t("presentation.status.creating"),
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
            t("presentation.status.stopping"),
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
              ? t("outline.toast.streamingFailed.title")
              : t("presentation.status.streamingFailed");
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
                ? t("presentation.status.stoppedWithDraft")
                : t("presentation.status.stopped"),
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
