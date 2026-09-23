"use client";

import React, { useEffect } from "react";

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
    <div className="generation-toast-actions">
      {actions.includes("keepWaiting") && (
        <button type="button" data-button onClick={onKeepWaiting}>
          {t("common.generation.keepWaiting")}
        </button>
      )}
      {actions.includes("retry") && (
        <button type="button" data-button onClick={onRetry}>
          {t("common.generation.retry")}
        </button>
      )}
      {actions.includes("stop") && (
        <button type="button" data-button onClick={onStop}>
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
  canKeepWaiting = false,
  onCancel,
  onKeepWaiting,
  onRetry,
}) => {
  const t = useT();

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
    void onCancel();
    notify.success(
      draftCount > 0
        ? t("presentation.status.stoppedWithDraft")
        : t("presentation.status.stopped"),
    );
  };

  useEffect(() => {
    if (
      lifecycle === "idle" ||
      lifecycle === "complete" ||
      lifecycle === "cancelled"
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

      const withActions = (actions: ActionKey[]) => ({
        ...baseOptions,
        action: (
          <GenerationToastActions
            actions={actions}
            onKeepWaiting={() => void onKeepWaiting()}
            onRetry={() => void onRetry()}
            onStop={handleStop}
          />
        ),
      });

      switch (lifecycle) {
        case "connecting":
        case "generating":
          notify.loading(statusMessage, undefined, withActions(["stop"]));
          break;
        case "stalled": {
          const description =
            statusMessage || t("presentation.status.noContent");
          const actions: ActionKey[] = ["retry", "stop"];
          if (canKeepWaiting) {
            actions.unshift("keepWaiting");
          }
          notify.warning(
            t("common.generation.takingLonger"),
            description,
            withActions(actions),
          );
          break;
        }
        case "cancelling":
          notify.loading(
            t("presentation.status.stopping"),
            undefined,
            baseOptions,
          );
          break;
        case "failed": {
          const title =
            surface === "outline"
              ? t("outline.toast.streamingFailed.title")
              : t("presentation.status.streamingFailed");
          notify.error(title, statusMessage, withActions(["retry", "stop"]));
          break;
        }
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
    canKeepWaiting,
    onCancel,
    onKeepWaiting,
    onRetry,
    t,
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
