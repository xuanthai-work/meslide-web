"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, X } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";

import { useT } from "@/i18n/provider";
import type { GenerationMode } from "../generation-mode";

type GenerationModeDialogProps = {
  open: boolean;
  selectedMode: GenerationMode;
  onOpenChange: (open: boolean) => void;
  onSelect: (mode: GenerationMode) => void;
};

const MODE_CARDS: Array<{
  id: GenerationMode;
  media: string;
}> = [
  { id: "standard", media: "/Standard.mp4" },
  { id: "smart", media: "/Smart.mp4" },
];

export default function GenerationModeDialog({
  open,
  selectedMode,
  onOpenChange,
  onSelect,
}: GenerationModeDialogProps) {
  const t = useT();

  const selectMode = (mode: GenerationMode) => {
    onSelect(mode);
    onOpenChange(false);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#101828]/45 backdrop-blur-[2px]" />
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-2">
          <DialogPrimitive.Content className="pointer-events-auto relative max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-[850px] overflow-y-auto rounded-[24px] border border-[#EDEEEF] bg-white p-0 shadow-[0_24px_80px_rgba(15,23,42,0.24)] sm:rounded-[40px]">
            <DialogPrimitive.Description className="sr-only">
              {t("upload.mode.description")}
            </DialogPrimitive.Description>
            <div className="sticky top-0 z-10 border-b border-[#EDEEEF] bg-[#F9FAFB] px-4 py-4 sm:px-8">
              <DialogPrimitive.Title className="text-xl font-medium tracking-[-0.2px] text-[#808080]">
                {t("upload.mode.title")}
              </DialogPrimitive.Title>
              <DialogPrimitive.Close className="absolute right-4 top-5 sm:right-8">
                <X className="h-5 w-5 text-[#808080]" />
              </DialogPrimitive.Close>
            </div>

            <div className="p-3 sm:p-5">
              <div
                role="radiogroup"
                aria-label={t("upload.mode.aria")}
                className="grid grid-cols-1 gap-5 md:grid-cols-2"
              >
                {MODE_CARDS.map((card) => (
                  <ModeCardView
                    key={card.id}
                    mode={card.id}
                    media={card.media}
                    selected={selectedMode === card.id}
                    onSelect={selectMode}
                  />
                ))}
              </div>
            </div>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function ModeCardView({
  mode,
  media,
  selected,
  onSelect,
}: {
  mode: GenerationMode;
  media: string;
  selected: boolean;
  onSelect: (mode: GenerationMode) => void;
}) {
  const t = useT();
  const label =
    mode === "standard"
      ? t("upload.mode.standard.label")
      : t("upload.mode.smart.label");
  const caption =
    mode === "standard"
      ? t("upload.mode.standard.caption")
      : t("upload.mode.smart.caption");
  const description =
    mode === "standard"
      ? t("upload.mode.standard.description")
      : t("upload.mode.smart.description");

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (
      event.target instanceof HTMLElement &&
      event.target.closest("[data-radix-dialog-close]")
    ) {
      return;
    }
    onSelect(mode);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(mode);
    }
  };

  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="group relative cursor-pointer overflow-hidden rounded-[20px] border border-[var(--gslide-border)] bg-white outline-none transition-transform duration-200 ease-out hover:-translate-y-[2px] hover:border-[var(--gslide-accent)] focus-visible:-translate-y-[2px] focus-visible:border-[var(--gslide-accent)] focus-visible:ring-2 focus-visible:ring-[var(--gslide-accent)] focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-[20px] bg-[#F7F7F8]">
        <video
          src={media}
          muted
          loop
          playsInline
          autoPlay
          className="h-full w-full object-cover"
        />
        {selected && (
          <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--gslide-accent)] text-white">
            <Check className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold text-[#191919]">{label}</p>
          <span className="text-xs font-medium text-[#808080]">{caption}</span>
        </div>
        <p className="mt-2 text-sm leading-5 text-[#666666]">{description}</p>
      </div>
    </div>
  );
}
