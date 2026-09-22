import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PencilIcon } from "lucide-react";
import {
  createContext,
  useCallback,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { useT } from "@/i18n/provider";

/** Drop target for attachments rendered inside this composer. */
export const PromptComposerBoundaryContext =
  createContext<RefObject<HTMLDivElement | null> | null>(null);

const MAX_PROMPT_HEIGHT = 400;

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Ctrl/Cmd+Enter creates the presentation. */
  onSubmit?: () => void;
  /** Bare Enter rewrites the prompt. Shift+Enter inserts a newline. */
  onRewrite?: () => void;
  children?: ReactNode;
}

export function PromptInput({
  value,
  onChange,
  onSubmit,
  onRewrite,
  children,
}: PromptInputProps) {
  const t = useT();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const label = t("upload.prompt.sourceLabel");
  const placeholder = t("upload.prompt.sourcePlaceholder");

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter") return;
    // Let an IME confirm the current composition instead of rewriting.
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
      return;
    }
    // Shift+Enter (and Alt+Enter) keep the textarea newline.
    if (event.shiftKey || event.altKey) return;

    event.preventDefault();
    if (event.metaKey || event.ctrlKey) {
      onSubmit?.();
      return;
    }
    onRewrite?.();
  };

  const resizeToContent = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    const contentHeight = textarea.scrollHeight;
    textarea.style.height = `${Math.min(contentHeight, MAX_PROMPT_HEIGHT)}px`;
    textarea.style.overflowY =
      contentHeight > MAX_PROMPT_HEIGHT ? "auto" : "hidden";
  }, []);

  useLayoutEffect(() => {
    resizeToContent();
  }, [resizeToContent, value]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    let previousWidth = textarea.getBoundingClientRect().width;
    let resizeFrame: number | null = null;
    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry || entry.contentRect.width === previousWidth) return;

      previousWidth = entry.contentRect.width;
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(resizeToContent);
    });

    resizeObserver.observe(textarea);
    return () => {
      resizeObserver.disconnect();
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
    };
  }, [resizeToContent]);

  return (
    <PromptComposerBoundaryContext.Provider value={composerRef}>
    <div
      ref={composerRef}
      className={cn(
        "relative flex flex-col gap-2.5 rounded-[18px] border border-[var(--gslide-border)] bg-white px-[10px] py-3 shadow-none",
      )}
    >
      <div className="flex min-h-0 flex-1 items-start gap-2">
        <span className="flex h-[21px] shrink-0 items-center">
          <PencilIcon className="h-3.5 w-3.5 text-[#191919]" strokeWidth={1.75} />
        </span>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1">
          <p className="text-sm font-normal leading-normal text-[#333333]">
            {label}
          </p>
          <Textarea
            ref={textareaRef}
            value={value}
            autoFocus
            rows={1}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label={label}
            data-testid="prompt-input"
            className={cn(
              "custom_scrollbar max-h-[400px] min-h-[57px] resize-none overflow-y-hidden rounded-none border-none bg-transparent p-0 text-base font-normal leading-normal text-[var(--gslide-ink)] shadow-none placeholder:text-[var(--gslide-muted)] focus-visible:ring-0 focus-visible:ring-offset-0",
              "min-h-[79px]",
            )}
          />
        </div>
      </div>
      {children}
    </div>
    </PromptComposerBoundaryContext.Provider>
  );
}
