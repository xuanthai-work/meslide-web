"use client";

import React, { useEffect } from "react";
import { X, AlertCircle } from "lucide-react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";

export interface PresentationPreparingModalProps {
  isOpen: boolean;
  currentStep: 1 | 2 | 3 | 4 | 5;
  hasAttachedDocs?: boolean;
  onCancel?: () => void;
  error?: string | null;
  onRetry?: () => void;
}

export function computePreparingStep({
  isCreating,
  phase,
  statusCode,
}: {
  isCreating: boolean;
  phase?: string;
  statusCode?: string | null;
}): 1 | 2 | 3 | 4 | 5 {
  if (isCreating) return 1;
  if (phase === "complete") return 5;
  if (phase === "preparing") return 4;
  if (phase === "outlining") {
    if (
      statusCode === "outline.drafting" ||
      statusCode === "outline.native_search_drafting"
    ) {
      return 3;
    }
    return 2;
  }
  return 1;
}

export const PresentationPreparingModal: React.FC<PresentationPreparingModalProps> = ({
  isOpen,
  currentStep,
  hasAttachedDocs = false,
  onCancel,
  error = null,
  onRetry,
}) => {
  const t = useT();

  // Handle ESC key to cancel/close
  useEffect(() => {
    if (!isOpen || !onCancel) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const steps = [
    {
      id: 1,
      label: hasAttachedDocs
        ? t("upload.preparingModal.stepAnalyzeWithDocs")
        : t("upload.preparingModal.stepAnalyze"),
    },
    {
      id: 2,
      label: t("upload.preparingModal.stepSearch"),
    },
    {
      id: 3,
      label: t("upload.preparingModal.stepOutline"),
    },
    {
      id: 4,
      label: t("upload.preparingModal.stepPrepare"),
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preparing-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[3px] p-4 transition-all duration-300"
    >
      <style>{`
        @keyframes miniProgressSlide {
          0% {
            left: -35%;
            width: 35%;
          }
          50% {
            left: 25%;
            width: 50%;
          }
          100% {
            left: 100%;
            width: 35%;
          }
        }
      `}</style>

      <div
        className={cn(
          "relative w-full max-w-[480px] bg-white rounded-[24px] px-8 py-9 sm:px-10 sm:py-10",
          "shadow-[0_20px_50px_-10px_rgba(0,0,0,0.18)] border border-gray-100/90",
          "animate-in fade-in zoom-in-95 duration-200"
        )}
      >
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-full hover:bg-gray-100"
            aria-label={t("upload.preparingModal.cancel")}
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <h2
          id="preparing-modal-title"
          className="text-2xl sm:text-[26px] font-bold text-gray-900 tracking-tight leading-snug"
        >
          {t("upload.preparingModal.title")}
        </h2>

        <p className="text-[14px] sm:text-[15px] text-gray-500 mt-2.5 mb-8 leading-relaxed font-normal">
          {t("upload.preparingModal.subtitle")}
        </p>

        <div className="space-y-4 sm:space-y-5">
          {steps.map((step) => {
            const isCompleted = currentStep > step.id;
            const isActive = currentStep === step.id && !error;
            const isPending = currentStep < step.id || (currentStep === step.id && !!error);

            return (
              <div key={step.id} className="flex items-center justify-between py-0.5">
                <span
                  className={cn(
                    "text-[15px] sm:text-[15.5px] transition-colors duration-200",
                    isCompleted || isActive
                      ? "font-medium text-gray-900"
                      : "font-normal text-gray-400"
                  )}
                >
                  {step.label}
                </span>

                <div className="flex items-center justify-end w-12 shrink-0">
                  {isCompleted && (
                    <svg
                      className="w-5 h-5 text-[#00A3FF] animate-in zoom-in-50 duration-200"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}

                  {isActive && (
                    <div className="w-11 h-1 bg-gray-100 rounded-full overflow-hidden relative">
                      <div
                        className="absolute inset-y-0 bg-[#00A3FF] rounded-full"
                        style={{
                          animation: "miniProgressSlide 1.5s ease-in-out infinite",
                        }}
                      />
                    </div>
                  )}

                  {isPending && <div className="w-5 h-5" />}
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mt-7 p-4 rounded-xl bg-red-50 border border-red-100 flex flex-col gap-3 animate-in fade-in duration-200">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">
                  {t("upload.preparingModal.failedTitle")}
                </p>
                <p className="text-xs text-red-600 mt-0.5 leading-snug">
                  {error || t("upload.preparingModal.failedDescription")}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-1">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-200/70 transition-colors"
                >
                  {t("upload.preparingModal.cancel")}
                </button>
              )}
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
                >
                  {t("upload.preparingModal.retry")}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PresentationPreparingModal;
