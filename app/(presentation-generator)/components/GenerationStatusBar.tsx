"use client";

import React from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
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

type ActionKey = "keepWaiting" | "retry" | "stop";

function PillActionButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-[0_1px_2px_rgba(16,24,40,0.06)] transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D6FE8] focus-visible:ring-offset-1"
    >
      {children}
    </button>
  );
}

const GenerationStatusBar: React.FC<Props> = ({
  surface,
  lifecycle,
  statusMessage,
  draftCount,
  totalCount,
  canKeepWaiting,
  onCancel,
  onKeepWaiting,
  onRetry,
  className,
}) => {
  const handleStop = () => {
    const outlineDraftVisible = surface === "outline" && draftCount > 0;
    if (outlineDraftVisible) {
      const message = `Dừng tạo dàn ý? ${draftCount} mục đã tạo sẽ được giữ lại.`;
      if (!window.confirm(message)) return;
    } else if (surface !== "outline" && needsCancelConfirm(draftCount)) {
      const message = `Dừng tạo slide? ${draftCount}/${(totalCount ?? draftCount)} slide đã tạo sẽ được giữ lại.`;
      if (!window.confirm(message)) return;
    }
    void onCancel();
  };

  if (
    lifecycle === "idle" ||
    lifecycle === "complete" ||
    (lifecycle === "cancelled" && surface !== "presentation")
  ) {
    return null;
  }

  const isLoadingState =
    lifecycle === "connecting" ||
    lifecycle === "generating" ||
    lifecycle === "stalled" ||
    lifecycle === "cancelling";

  const actions: ActionKey[] = [];
  if (lifecycle === "generating" || lifecycle === "connecting") {
    actions.push("stop");
  } else if (lifecycle === "stalled") {
    if (canKeepWaiting) actions.push("keepWaiting");
    actions.push("stop");
  } else if (lifecycle === "failed") {
    actions.push("retry");
  } else if (lifecycle === "cancelled") {
    actions.push("retry");
  }

  let message = statusMessage;
  let icon: React.ReactNode;
  if (isLoadingState) {
    icon = (
      <Loader2
        aria-hidden="true"
        className="h-4 w-4 shrink-0 animate-spin text-[#1D6FE8]"
      />
    );
    if (lifecycle === "cancelling") {
      message = "Đang dừng…";
    } else if (lifecycle === "stalled") {
      message = statusMessage || "Kết nối chậm, đang tiếp tục chờ…";
    } else {
      message = statusMessage || "Đang tạo bài thuyết trình...";
    }
  } else if (lifecycle === "failed") {
    icon = (
      <AlertCircle
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-red-500"
      />
    );
    message =
      statusMessage ||
      (surface === "outline"
        ? "Tạo luồng dàn ý thất bại"
        : "Tạo bài thuyết trình thất bại");
  } else {
    icon = (
      <CheckCircle2
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-slate-500"
      />
    );
    message =
      draftCount > 0
        ? "Đã dừng tạo. Bản nháp hiện tại đã được giữ lại."
        : "Đã dừng tạo.";
  }

  return (
    <div
      data-testid="generation-status-widget"
      className={cn(
        "generation-status-widget pointer-events-auto flex w-fit items-center gap-2.5 rounded-full border border-slate-200/90 bg-white/95 px-3.5 py-1.5 font-syne text-xs font-medium text-slate-800 shadow-[0_4px_16px_rgba(16,24,40,0.10)] backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-top-2",
        className
      )}
      role="status"
      aria-live="polite"
    >
      {icon}
      <span className="truncate max-w-[260px]">{message}</span>
      <div className="flex items-center gap-1.5">
        {actions.includes("keepWaiting") && (
          <PillActionButton onClick={() => void onKeepWaiting()}>
            {"Tiếp tục chờ"}
          </PillActionButton>
        )}
        {actions.includes("retry") && (
          <PillActionButton onClick={() => void onRetry()}>
            {"Thử lại"}
          </PillActionButton>
        )}
        {actions.includes("stop") && (
          <PillActionButton onClick={handleStop}>{"Dừng"}</PillActionButton>
        )}
      </div>
    </div>
  );
};

export default GenerationStatusBar;
