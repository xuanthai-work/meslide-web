"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { AlertTriangle, Loader2, RotateCcw, Sparkles } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { PromptComposerBoundaryContext } from "./PromptComposerBoundary";
import { useT } from "@/i18n/provider";

/**
 * Progress phases of an AI outline request, in execution order: the
 * selected documents are uploaded, then read (decomposed/extracted), then
 * the outline itself is generated.
 */
export type OutlinePhase =
  | "uploading_documents"
  | "reading_documents"
  | "rewriting";

interface OutlineComposerProps {
  /** Box 1: the idea plus any extra instructions for the AI. */
  idea: string;
  onIdeaChange: (value: string) => void;
  /** Box 2: the outline or detailed content that becomes the deck. */
  content: string;
  onContentChange: (value: string) => void;
  /** Slides the outline declares for itself; null when it declares none. */
  detectedSlidesCount?: number | null;
  /** Promotes `detectedSlidesCount` over the slide-count dropdown. */
  strictOutline: boolean;
  onStrictOutlineChange: (checked: boolean) => void;
  /** Label of the AI outline action; follows the request phase. */
  actionLabel: string;
  isGenerating: boolean;
  onGenerate: () => void;
  /** False when there is nothing to build an outline from. */
  canGenerate: boolean;
  phase: OutlinePhase | null;
  error: string | null;
  onRetry?: () => void;
  /** Ctrl/Cmd+Enter on box 2 creates the presentation. */
  onSubmit?: () => void;
  /** Disables both fields and the action while generation is in progress. */
  disabled?: boolean;
  children?: ReactNode;
}

/**
 * The upload page's two text inputs.
 *
 * Box 1 collects the idea and any extra instructions, and owns the AI outline
 * action. Box 2 holds the outline or detailed content that is sent verbatim
 * as the presentation `content`; the AI action writes its result straight
 * into it, and the user keeps editing afterwards. Create is never gated on
 * the AI — this component only reports what the user typed.
 *
 * The whole group is the drop target for attachments, which it publishes
 * through {@link PromptComposerBoundaryContext} for the attachment control
 * rendered as `children`.
 */
export function OutlineComposer({
  idea,
  onIdeaChange,
  content,
  onContentChange,
  detectedSlidesCount = null,
  strictOutline,
  onStrictOutlineChange,
  actionLabel,
  isGenerating,
  onGenerate,
  canGenerate,
  phase,
  error,
  onRetry,
  onSubmit,
  disabled = false,
  children,
}: OutlineComposerProps) {
  const t = useT();
  const composerRef = useRef<HTMLDivElement>(null);
  const ideaLabel = t("upload.outline.ideaLabel");
  const contentLabel = t("upload.outline.contentLabel");

  const handleContentKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter") return;
    // Let an IME confirm the current composition instead of submitting.
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
      return;
    }
    // Shift+Enter (and Alt+Enter) keep the textarea newline.
    if (event.shiftKey || event.altKey) return;
    if (!event.metaKey && !event.ctrlKey) return;

    event.preventDefault();
    onSubmit?.();
  };

  // Phase changes are announced politely; an empty string keeps the live
  // region present without spamming announcements.
  const statusText = isGenerating
    ? phase === "uploading_documents"
      ? t("upload.prompt.rewrite.aria.uploading")
      : phase === "reading_documents"
        ? t("upload.prompt.rewrite.aria.reading")
        : t("upload.prompt.rewrite.aria.loading")
    : error
      ? t("upload.prompt.rewrite.aria.error")
      : t("upload.prompt.rewrite.aria.success");

  return (
    <PromptComposerBoundaryContext.Provider value={composerRef}>
      <div
        ref={composerRef}
        data-testid="outline-composer"
        className="flex w-full flex-col gap-2.5"
      >
        <div className="flex flex-col gap-1.5 rounded-[18px] border border-[var(--gslide-border)] bg-white px-[10px] py-3">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="outline-idea"
              className="text-sm font-normal leading-normal text-[#333333]"
            >
              {ideaLabel}
            </label>
            <button
              type="button"
              disabled={!canGenerate || isGenerating}
              aria-busy={isGenerating}
              onClick={onGenerate}
              data-testid="rewrite-action-button"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#F6F6F9] px-3.5 py-1.5 font-manrope text-xs font-medium text-[var(--gslide-ink)] transition hover:bg-[#E6E6E9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--gslide-accent)_25%,transparent)] disabled:opacity-50"
            >
              {isGenerating ? (
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
              {actionLabel}
            </button>
          </div>
          <Textarea
            id="outline-idea"
            value={idea}
            rows={2}
            disabled={disabled}
            onChange={(event) => onIdeaChange(event.target.value)}
            placeholder={t("upload.outline.ideaPlaceholder")}
            aria-label={ideaLabel}
            data-testid="idea-input"
            className="custom_scrollbar max-h-[200px] min-h-[57px] resize-none rounded-none border-none bg-transparent p-0 text-base font-normal leading-normal text-[var(--gslide-ink)] shadow-none placeholder:text-[var(--gslide-muted)] focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        <div className="flex flex-col gap-2.5 rounded-[18px] border border-[var(--gslide-border)] bg-white px-[10px] py-3">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="outline-content"
              className="text-sm font-normal leading-normal text-[#333333]"
            >
              {contentLabel}
            </label>
            {detectedSlidesCount ? (
              <span
                data-testid="detected-slides-badge"
                className="inline-flex h-[22px] shrink-0 items-center rounded-full bg-[#ECFDF5] px-2.5 font-manrope text-[10px] font-medium leading-none text-[#059669]"
              >
                {t("upload.outline.detectedCount", {
                  count: detectedSlidesCount,
                })}
              </span>
            ) : null}
          </div>
          <Textarea
            id="outline-content"
            value={content}
            rows={10}
            disabled={disabled}
            onChange={(event) => onContentChange(event.target.value)}
            onKeyDown={handleContentKeyDown}
            placeholder={t("upload.outline.contentPlaceholder")}
            aria-label={contentLabel}
            data-testid="prompt-input"
            className="custom_scrollbar max-h-[520px] min-h-[220px] resize-y overflow-y-auto rounded-none border-none bg-transparent p-0 font-mono text-sm font-normal leading-relaxed text-[var(--gslide-ink)] shadow-none placeholder:font-sans placeholder:text-[var(--gslide-muted)] focus-visible:ring-0 focus-visible:ring-offset-0"
          />

          {error ? (
            <div
              role="alert"
              data-testid="rewrite-error"
              className="flex flex-col gap-2 rounded-lg bg-[#FFF4E5] p-2.5"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#B45309]"
                  aria-hidden="true"
                />
                <p className="text-sm font-normal leading-normal text-[#7A4A00]">
                  {error.trim() || t("upload.prompt.rewrite.errorFallback")}
                </p>
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
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F3F4F6] pt-3 text-xs text-[var(--gslide-muted)]">
            <label className="flex cursor-pointer select-none items-center gap-2">
              <input
                type="checkbox"
                checked={strictOutline}
                onChange={(event) => onStrictOutlineChange(event.target.checked)}
                data-testid="strict-outline-toggle"
                className="rounded border-[#D1D5DB] text-[var(--gslide-accent)] focus:ring-[var(--gslide-accent)]"
              />
              <span>{t("upload.outline.strictLabel")}</span>
            </label>
            <span className="text-[11px] text-[var(--gslide-muted)]">
              {t("upload.outline.dropHint")}
            </span>
          </div>
        </div>

        {children}

        <div className="sr-only" role="status" aria-live="polite">
          {statusText}
        </div>
      </div>
    </PromptComposerBoundaryContext.Provider>
  );
}
