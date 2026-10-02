"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { motion } from "motion/react";
import {
  AlertTriangle,
  ArrowDown,
  Loader2,
  RotateCcw,
  Star,
  Zap,
} from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { PromptComposerBoundaryContext } from "./PromptComposerBoundary";

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
  /** The attachment control rendered beside the AI action in box 1. */
  children?: ReactNode;
}

/** Shared card shell: hairline border, soft lift on hover, accent focus ring. */
const CARD_CLASS =
  "overflow-hidden rounded-2xl border border-[var(--gslide-border)] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03),0_4px_16px_-2px_rgba(15,23,42,0.05)] transition-[box-shadow,border-color] duration-300 focus-within:border-[color-mix(in_srgb,var(--gslide-accent)_45%,var(--gslide-border))] focus-within:shadow-[0_10px_30px_-4px_rgba(15,23,42,0.06),0_4px_12px_-2px_rgba(15,23,42,0.03)] focus-within:ring-4 focus-within:ring-[color-mix(in_srgb,var(--gslide-accent)_8%,transparent)]";

const CARD_HEADER_CLASS =
  "flex items-center justify-between gap-3 border-b border-[var(--gslide-border)] bg-gradient-to-r from-[#FAFAFC] via-white to-[#FAFAFC] px-4 py-3 sm:px-5";

const CARD_LABEL_CLASS =
  "text-sm font-semibold leading-snug tracking-tight text-[var(--gslide-ink)]";

const TEXTAREA_CLASS =
  "custom_scrollbar resize-none rounded-none border-none bg-transparent p-0 text-sm font-normal leading-relaxed text-[var(--gslide-ink)] shadow-none placeholder:text-[var(--gslide-muted)] focus-visible:ring-0 focus-visible:ring-offset-0";

/**
 * A filled index pill (1 / 2) that numbers the two inputs.
 */
function StepBadge({ step }: { step: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--gslide-accent)_18%,white)] bg-[var(--gslide-accent-soft)] text-xs font-bold text-[var(--gslide-accent)]"
    >
      {step}
    </span>
  );
}

/**
 * The upload page's two text inputs.
 *
 * Box 1 collects the idea and any extra instructions, together with the
 * attachment picker and the AI outline action. Box 2 holds the outline or
 * detailed content that is sent verbatim as the presentation `content`; the
 * AI action writes its result straight into it, and the user keeps editing
 * afterwards. Create is never gated on the AI — this component only reports
 * what the user typed.
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
  const composerRef = useRef<HTMLDivElement>(null);
  const ideaLabel = "Soạn với AI";
  const contentLabel = "Dàn ý hoặc nội dung bài thuyết trình";

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
      ? "Đang tải tài liệu của bạn lên."
      : phase === "reading_documents"
        ? "Đang đọc tài liệu để làm cơ sở cho dàn ý."
        : "Đang tạo dàn ý bằng AI."
    : error
      ? "Tạo dàn ý thất bại."
      : "Đã tạo dàn ý thành công.";

  return (
    <PromptComposerBoundaryContext.Provider value={composerRef}>
      <div
        ref={composerRef}
        data-testid="outline-composer"
        className="flex w-full flex-col gap-1"
      >
        {/* Box 1 — the idea plus everything that acts on it. */}
        <section className={CARD_CLASS} data-purpose="idea-card">
          <div className={CARD_HEADER_CLASS}>
            <div className="flex min-w-0 items-center gap-2.5">
              <StepBadge step={1} />
              <label
                htmlFor="outline-idea"
                className={`${CARD_LABEL_CLASS} flex cursor-pointer items-center gap-1.5`}
              >
                {ideaLabel}
                <Star
                  className="h-3.5 w-3.5 shrink-0 fill-current text-[#E8A33D]"
                  aria-hidden="true"
                />
              </label>
            </div>
            <span className="inline-flex shrink-0 items-center rounded-full border border-[var(--gslide-border)] bg-[#F6F6F9] px-2 py-0.5 text-[11px] font-medium text-[var(--gslide-muted)]">
              {"Tùy chọn"}
            </span>
          </div>

          <div className="flex flex-col gap-2.5 px-4 pt-4 pb-2 sm:px-5">
            <Textarea
              id="outline-idea"
              value={idea}
              rows={3}
              disabled={disabled}
              onChange={(event) => onIdeaChange(event.target.value)}
              placeholder={"Nhập ý tưởng, chủ đề cho AI..."}
              aria-label={ideaLabel}
              data-testid="idea-input"
              className={`${TEXTAREA_CLASS} min-h-[72px]`}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--gslide-border)] pt-2.5">
              <div className="min-w-0 flex-1">{children}</div>
              <motion.button
                type="button"
                disabled={!canGenerate || isGenerating}
                aria-busy={isGenerating}
                onClick={onGenerate}
                whileHover={!canGenerate || isGenerating ? undefined : { scale: 1.02 }}
                whileTap={!canGenerate || isGenerating ? undefined : { scale: 0.98 }}
                data-testid="rewrite-action-button"
                // The solid accent is the base layer and the gradient is the
                // enhancement on top: background-color and background-image
                // are independent, so if the gradient ever fails to resolve
                // the label stays readable on a solid accent button instead
                // of disappearing as white on white.
                className="transform-gpu inline-flex h-8 shrink-0 items-center gap-1.5 self-end whitespace-nowrap rounded-lg bg-[var(--gslide-accent)] bg-gradient-to-r from-[var(--gslide-accent)] to-[var(--gslide-accent-hover)] px-3 text-xs font-semibold text-white shadow-[0_4px_14px_0_color-mix(in_srgb,var(--gslide-accent)_30%,transparent)] transition-all hover:bg-[var(--gslide-accent-hover)] hover:from-[var(--gslide-accent-hover)] hover:to-[var(--gslide-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--gslide-accent)_30%,transparent)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
              >
                {isGenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Zap className="h-3.5 w-3.5 fill-current opacity-90" aria-hidden="true" />
                )}
                {actionLabel}
              </motion.button>
            </div>
          </div>
        </section>

        {/* Either paste an outline, or let the AI draft one from the idea. */}
        <div
          className="relative flex items-center justify-center py-1"
          aria-hidden="true"
        >
          <span className="h-px flex-1 border-t border-dashed border-[var(--gslide-border)]" />
          <span className="mx-3 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--gslide-border)] bg-white px-3 py-1 text-[11px] font-medium text-[var(--gslide-muted)]">
            {"Hoặc dán trực tiếp nội dung bên dưới"}
            <ArrowDown className="h-3 w-3 text-[var(--gslide-accent)]" />
          </span>
          <span className="h-px flex-1 border-t border-dashed border-[var(--gslide-border)]" />
        </div>

        {/* Box 2 — the outline itself. The card hugs the textarea so the
            resize grip in its corner stays flush with the card edge and the
            card grows with the drag. */}
        <section
          className={`${CARD_CLASS} flex flex-col`}
          data-purpose="outline-card"
        >
          <div className={CARD_HEADER_CLASS}>
            <div className="flex min-w-0 items-center gap-2.5">
              <StepBadge step={2} />
              <label htmlFor="outline-content" className={CARD_LABEL_CLASS}>
                {contentLabel}
              </label>
            </div>
            {detectedSlidesCount ? (
              <span
                data-testid="detected-slides-badge"
                className="inline-flex shrink-0 items-center rounded-full border border-[color-mix(in_srgb,#059669_18%,white)] bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-medium leading-none text-[#047857]"
              >
                {`Phát hiện ${detectedSlidesCount} slide`}
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
            <Textarea
              id="outline-content"
              value={content}
              rows={10}
              disabled={disabled}
              onChange={(event) => onContentChange(event.target.value)}
              onKeyDown={handleContentKeyDown}
              placeholder={"Dán bộ dàn ý hoặc báo cáo chi tiết ..."}
              aria-label={contentLabel}
              data-testid="prompt-input"
              className={`${TEXTAREA_CLASS} custom_scrollbar min-h-[210px] resize-y overflow-y-auto font-mono placeholder:font-sans`}
            />

            {error ? (
              <div
                role="alert"
                data-testid="rewrite-error"
                className="flex flex-col gap-2 rounded-xl border border-[#F5D9A8] bg-[#FFF8EC] p-3"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#B45309]"
                    aria-hidden="true"
                  />
                  <p className="text-sm font-normal leading-normal text-[#7A4A00]">
                    {error.trim() || "Đã xảy ra lỗi khi tạo dàn ý. Hãy thử lại; nội dung bạn đã nhập vẫn được giữ nguyên."}
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
                    {"Thử lại"}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </section>

        <div className="sr-only" role="status" aria-live="polite">
          {statusText}
        </div>
      </div>
    </PromptComposerBoundaryContext.Provider>
  );
}
