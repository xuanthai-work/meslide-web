import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PencilIcon, X } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useT } from "@/i18n/provider";

interface PromptReference {
  id: string;
  label: string;
}

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  references?: PromptReference[];
  onRemoveReference?: (id: string) => void;
  variant?: "smart" | "standard";
  onSubmit?: () => void;
}

export function PromptInput({
  value,
  onChange,
  references = [],
  onRemoveReference,
  variant = "standard",
  onSubmit,
}: PromptInputProps) {
  const t = useT();
  const isCommunityStart =
    variant === "smart" && references.length === 0 && !value.trim();

  const label = isCommunityStart
    ? t("upload.prompt.community")
    : t("upload.prompt.sourceLabel");
  const placeholder = isCommunityStart
    ? t("upload.prompt.communityPlaceholder")
    : t("upload.prompt.sourcePlaceholder");

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      onSubmit?.();
    }
  };

  return (
    <div
      className={cn(
        "relative flex min-h-[180px] flex-col gap-2.5 rounded-[18px] border border-[var(--gslide-border)] bg-white px-[10px] py-3 shadow-none",
      )}
    >
      {references.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {references.map((reference) => (
            <span
              key={reference.id}
              className="inline-flex h-[22px] max-w-full items-center gap-1.5 rounded-full bg-[#F4F4F4] px-[5px] py-1 font-manrope text-[10px] font-medium leading-none text-[#333333]"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--gslide-accent)]" />
              <span className="max-w-[220px] truncate">{reference.label}</span>
              {onRemoveReference && (
                <button
                  type="button"
                  onClick={() => onRemoveReference(reference.id)}
                  className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[#666666] hover:bg-[#E4E4E7] hover:text-[#191919]"
                  aria-label={t("upload.files.removeAria", { name: reference.label })}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1 items-start gap-2">
        <span className="flex h-[21px] shrink-0 items-center">
          <PencilIcon className="h-3.5 w-3.5 text-[#191919]" strokeWidth={1.75} />
        </span>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1">
          <p className="text-sm font-normal leading-normal text-[#333333]">
            {label}
          </p>
          <Textarea
            value={value}
            autoFocus
            rows={variant === "smart" ? 3 : 6}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label={label}
            data-testid="prompt-input"
            className={cn(
              "custom_scrollbar max-h-[400px] min-h-[57px] resize-y overflow-y-auto rounded-none border-none bg-transparent p-0 text-base font-normal leading-normal text-[var(--gslide-ink)] shadow-none placeholder:text-[var(--gslide-muted)] focus-visible:ring-0 focus-visible:ring-offset-0",
              references.length === 0 && "min-h-[79px]",
            )}
          />
        </div>
      </div>
    </div>
  );
}
