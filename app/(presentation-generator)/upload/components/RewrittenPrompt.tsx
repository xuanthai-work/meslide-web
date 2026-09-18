"use client";

import { AlertTriangle, Loader2, RotateCcw, Sparkles } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/i18n/provider";

/**
 * Progress phases of a document-aware rewrite, in execution order: the
 * selected documents are uploaded, then read (decomposed/extracted), then the
 * prompt itself is rewritten.
 */
export type RewritePhase =
  | "uploading_documents"
  | "reading_documents"
  | "rewriting";

/**
 * Presents the AI-rewritten prompt. UploadPage owns the rewrite orchestration;
 * this component is purely presentational. It renders a compact empty state
 * before the first rewrite so the panel does not dominate the composer, and
 * grows the output area once a result, loading state, stale result, or error
 * needs more space. The output textarea is `readOnly` — never `disabled` — so
 * it stays selectable and copyable.
 */
export interface RewrittenPromptProps {
  /** Latest AI-rewritten prompt; "" means no rewrite result yet. */
  value: string;
  /** True while a rewrite request is in flight. */
  isLoading: boolean;
  /** Active preparation phase while loading; null when idle. */
  phase: RewritePhase | null;
  /** True when the source prompt changed after this result was produced. */
  isStale: boolean;
  /** Message from the last failed rewrite attempt; null when there is no error. */
  error: string | null;
  /** Invoked when the user asks to retry after a failed rewrite. */
  onRetry?: () => void;
  /**
   * Number of documents that grounded a fresh document-aware rewrite. When
   * this is provided together with a non-stale, non-error result, the panel
   * renders a concise helper such as "Đã tối ưu từ ý tưởng và 2 tài liệu".
   * Omit (or set to 0) for prompt-only rewrites or whenever the stored
   * result is stale — those states must not show a grounding claim.
   */
  groundedDocumentCount?: number;
}

export function RewrittenPrompt({
  value,
  isLoading,
  phase,
  isStale,
  error,
  onRetry,
  groundedDocumentCount = 0,
}: RewrittenPromptProps) {
  const t = useT();
  const outputLabel = t("upload.prompt.rewrite.outputLabel");
  const hasResult = value.trim().length > 0;
  // Rewrite status announced politely; empty string keeps the live region
  // present without spamming announcements. While loading, the announcement
  // follows the active preparation phase.
  const statusText = isLoading
    ? phase === "uploading_documents"
      ? t("upload.prompt.rewrite.aria.uploading")
      : phase === "reading_documents"
        ? t("upload.prompt.rewrite.aria.reading")
        : t("upload.prompt.rewrite.aria.loading")
    : error
      ? t("upload.prompt.rewrite.aria.error")
      : isStale
        ? t("upload.prompt.rewrite.aria.stale")
        : hasResult
          ? t("upload.prompt.rewrite.aria.success")
          : "";

  // The compact empty state is shown only when there is nothing to expand
  // for: no result, not loading, no error, and a non-stale panel. Once any
  // of those flips the panel grows so the rewrite can be read comfortably.
  const isCompactEmpty =
    !hasResult && !isLoading && !error && !isStale;
  const showGroundedHelper =
    hasResult && !isStale && !error && groundedDocumentCount > 0;

  return (
    <div
      data-testid="rewritten-prompt"
      data-compact-empty={isCompactEmpty ? "true" : undefined}
      className={
        isCompactEmpty
          ? "relative flex items-center gap-2 rounded-[18px] border border-dashed border-[var(--gslide-border)] bg-[var(--gslide-accent-soft)] px-[10px] py-2.5"
          : "relative flex flex-col gap-2.5 rounded-[18px] border border-[var(--gslide-border)] bg-[var(--gslide-accent-soft)] px-[10px] py-3"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-[21px] shrink-0 items-center">
            {isLoading ? (
              <Loader2
                className="h-3.5 w-3.5 animate-spin text-[var(--gslide-accent)]"
                aria-hidden="true"
              />
            ) : (
              <Sparkles
                className="h-3.5 w-3.5 text-[var(--gslide-accent)]"
                aria-hidden="true"
              />
            )}
          </span>
          <p className="text-sm font-normal leading-normal text-[#333333]">
            {isCompactEmpty
              ? t("upload.prompt.rewrite.emptyTitle")
              : outputLabel}
          </p>
        </div>
        {isStale && !error && (
          <span
            data-testid="rewritten-prompt-stale-badge"
            className="inline-flex h-[22px] shrink-0 items-center rounded-full bg-[#FFF4E5] px-2.5 font-manrope text-[10px] font-medium leading-none text-[#8A5300]"
          >
            {t("upload.prompt.rewrite.staleBadge")}
          </span>
        )}
      </div>

      {!isCompactEmpty && error && (
        <div
          role="alert"
          data-testid="rewritten-prompt-error"
          className="flex flex-col gap-2 rounded-lg bg-white p-2.5"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#B45309]"
              aria-hidden="true"
            />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium leading-normal text-[var(--gslide-ink)]">
                {t("upload.prompt.rewrite.errorTitle")}
              </p>
              <p className="text-sm font-normal leading-normal text-[var(--gslide-muted)]">
                {error.trim() ? error : t("upload.prompt.rewrite.errorFallback")}
              </p>
            </div>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              data-testid="rewrite-retry-button"
              className="inline-flex h-8 w-max items-center gap-1.5 rounded-full border border-[var(--gslide-border)] bg-white px-3 font-manrope text-xs font-medium text-[var(--gslide-ink)] transition hover:bg-[#F6F6F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--gslide-accent)_15%,transparent)]"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              {t("upload.prompt.rewrite.retryAction")}
            </button>
          )}
        </div>
      )}

      {!isCompactEmpty && (
        <div className="flex min-h-0 flex-1 items-start gap-2">
          <Textarea
            value={value}
            readOnly
            rows={6}
            aria-label={outputLabel}
            placeholder={t("upload.prompt.rewrite.emptyHint")}
            data-testid="rewritten-prompt-output"
            className="custom_scrollbar max-h-[400px] min-h-[57px] resize-none overflow-y-auto rounded-none border-none bg-transparent p-0 text-base font-normal leading-normal text-[var(--gslide-ink)] shadow-none placeholder:text-[var(--gslide-muted)] focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
      )}

      {!isCompactEmpty && isStale && !error && (
        <p
          data-testid="rewritten-prompt-stale-helper"
          className="text-xs font-normal leading-normal text-[var(--gslide-muted)]"
        >
          {t("upload.prompt.rewrite.staleHelper")}
        </p>
      )}

      {showGroundedHelper && (
        <p
          data-testid="rewritten-prompt-grounded-helper"
          className="font-manrope text-[11px] font-medium leading-snug text-[var(--gslide-accent)]"
        >
          {t("upload.prompt.rewrite.groundedSummary", {
            count: groundedDocumentCount,
          })}
        </p>
      )}

      <div className="sr-only" role="status" aria-live="polite">
        {statusText}
      </div>
    </div>
  );
}
