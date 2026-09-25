"use client";

import { useEffect, useRef, useState, type TouchEvent } from "react";
import { Check, ChevronDown, Layers3 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { templateCardCopy } from "../../components/builtin-template-copy";
import { TemplateThumbnailPreview } from "../../components/TemplateListUi";
import { useTemplateSummaries } from "../../hooks/useTemplateSummaries";

type UploadTemplatePickerProps = {
  selectedTemplateId: string | null;
  onSelectionChange: (id: string | null) => void;
  onAvailabilityChange: (available: boolean) => void;
  disabled?: boolean;
};

export function UploadTemplatePicker({
  selectedTemplateId,
  onSelectionChange,
  onAvailabilityChange,
  disabled = false,
}: UploadTemplatePickerProps) {
  const { locale, t } = useI18n();
  const { defaultTemplates: templates, loading, error, retry } = useTemplateSummaries();
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? null;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    onAvailabilityChange(!loading && !error && selectedTemplate !== null);
  }, [loading, error, selectedTemplate, onAvailabilityChange]);

  useEffect(() => {
    if (loading) return;
    if (error || templates.length === 0) {
      if (selectedTemplateId) onSelectionChange(null);
      return;
    }
    if (!selectedTemplate) onSelectionChange(templates[0].id);
  }, [loading, error, selectedTemplateId, selectedTemplate, templates, onSelectionChange]);

  const openPicker = () => {
    setActiveIndex(Math.max(0, templates.findIndex((template) => template.id === selectedTemplateId)));
    setOpen(true);
  };

  const goTo = (index: number) => {
    if (templates.length === 0) return;
    setActiveIndex((index + templates.length) % templates.length);
  };

  const chooseActive = () => {
    const active = templates[activeIndex];
    if (!active) return;
    onSelectionChange(active.id);
    setOpen(false);
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;
    const delta = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) > 40) goTo(activeIndex + (delta < 0 ? 1 : -1));
  };

  const activeTemplate = templates[activeIndex] ?? null;
  const activeCopy = activeTemplate ? templateCardCopy(activeTemplate, locale) : null;
  const selectedCopy = selectedTemplate ? templateCardCopy(selectedTemplate, locale) : null;

  return (
    <>
      <button
        type="button"
        data-testid="upload-template-trigger"
        onClick={openPicker}
        disabled={disabled || loading || templates.length === 0}
        className="group flex w-full max-w-[410px] items-center gap-3 rounded-xl border border-[var(--gslide-border)] bg-white px-3 py-2.5 text-left transition-colors hover:border-[#1D6FE8]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D6FE8]/40 disabled:cursor-default disabled:opacity-70"
      >
        <span className="h-12 w-[78px] shrink-0 overflow-hidden rounded-lg bg-[#F8FBFB]">
          {selectedTemplate ? (
            <TemplateThumbnailPreview thumbnail={selectedTemplate.thumbnail} templateName={selectedCopy?.name ?? selectedTemplate.name} />
          ) : (
            <span className="flex h-full items-center justify-center text-[#1D6FE8]"><Layers3 size={21} /></span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#63748F]">{t("upload.template.label")}</span>
          <span className="mt-0.5 block truncate text-sm font-semibold text-[#17243C]">
            {loading ? t("upload.template.loading") : selectedCopy?.name ?? t("upload.template.unavailable")}
          </span>
        </span>
        <ChevronDown aria-hidden="true" size={17} className="shrink-0 text-[#667A98]" />
      </button>

      {!loading && (error || templates.length === 0) && (
        <div className="flex items-center justify-center gap-3 text-xs text-[#67758D]">
          <span>{t(error ? "upload.template.loadError" : "upload.template.empty")}</span>
          <button
            type="button"
            data-testid="template-retry-button"
            onClick={retry}
            className="font-semibold text-[#1D6FE8] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D6FE8]/40"
          >
            {t("upload.template.retry")}
          </button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-h-[calc(100dvh-24px)] w-[calc(100vw-24px)] max-w-[1000px] gap-0 overflow-x-hidden overflow-y-auto border border-[#EDEEF4] bg-white p-0 text-[#101323] shadow-[0_24px_80px_rgba(16,19,35,0.16)] motion-reduce:animate-none sm:rounded-2xl"
          overlayClassName="bg-[#101323]/55 motion-reduce:animate-none"
        >
          <div className="px-5 pb-5 pt-7 sm:px-8 sm:pb-7 sm:pt-8">
            <div className="pr-8">
              <DialogTitle className="text-xl font-bold leading-tight sm:text-2xl">{t("upload.template.dialogTitle")}</DialogTitle>
              <DialogDescription className="mt-1.5 text-sm text-[#6B6D78]">{t("upload.template.dialogDescription")}</DialogDescription>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-[minmax(0,1fr)_246px] md:gap-7">
              <div className="min-w-0">
                <div
                  data-testid="template-carousel"
                  tabIndex={0}
                  role="group"
                  aria-label={t("upload.template.carouselAria")}
                  className="touch-pan-y rounded-xl bg-[#F6F8FB] p-3 outline-none focus-visible:ring-2 focus-visible:ring-[#1D6FE8] sm:p-5"
                  onKeyDown={(event) => {
                    if (event.key === "ArrowRight") { event.preventDefault(); goTo(activeIndex + 1); }
                    if (event.key === "ArrowLeft") { event.preventDefault(); goTo(activeIndex - 1); }
                    if (event.key === "Home") { event.preventDefault(); goTo(0); }
                    if (event.key === "End") { event.preventDefault(); goTo(templates.length - 1); }
                  }}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  <div data-testid="template-main-preview" className="aspect-video overflow-hidden rounded-md border border-[#EDEEF4] bg-white shadow-[0_8px_24px_rgba(16,19,35,0.08)]">
                    {activeTemplate && <TemplateThumbnailPreview thumbnail={activeTemplate.thumbnail} templateName={activeCopy?.name ?? activeTemplate.name} />}
                  </div>
                </div>
                <div className="mt-4 min-w-0">
                  <span data-testid="template-active-name" aria-live="polite" aria-atomic="true" className="block truncate text-base font-bold sm:text-lg">{activeCopy?.name}</span>
                  <span className="text-xs tabular-nums text-[#6B6D78]">{activeIndex + 1} / {templates.length}</span>
                </div>
              </div>

              <div className="min-w-0 border-t border-[#EDEEF4] pt-4 md:border-l md:border-t-0 md:pl-7 md:pt-0">
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#6B6D78]">{t("upload.template.railAria")}</div>
                <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-2 md:max-h-[420px] md:flex-col md:overflow-x-hidden md:overflow-y-auto md:pr-1" role="group" aria-label={t("upload.template.railAria")}>
                  {templates.map((template, index) => {
                    const copy = templateCardCopy(template, locale);
                    return (
                      <button
                        key={template.id}
                        type="button"
                        data-testid={`template-rail-item-${template.id}`}
                        aria-pressed={activeIndex === index}
                        aria-label={t("upload.template.previewAria", { name: copy.name })}
                        onMouseEnter={() => goTo(index)}
                        onFocus={() => goTo(index)}
                        onClick={() => goTo(index)}
                        className={cn("flex w-40 shrink-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D6FE8] md:w-full", activeIndex === index ? "border-[#1D6FE8] bg-[#EFF4FF]" : "border-transparent hover:border-[#EDEEF4] hover:bg-[#F6F8FB]")}
                      >
                        <span className="block aspect-video w-[54px] shrink-0 overflow-hidden rounded border border-[#EDEEF4] bg-white"><TemplateThumbnailPreview thumbnail={template.thumbnail} templateName={copy.name} /></span>
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#101323]">{copy.name}</span>
                        {selectedTemplateId === template.id && <Check aria-hidden="true" size={15} className="hidden shrink-0 text-[#1D6FE8] md:block" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end border-t border-[#EDEEF4] pt-5 sm:mt-6">
              <button type="button" data-testid="template-choose-button" onClick={chooseActive} className="rounded-lg bg-[#1D6FE8] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1558C0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D6FE8] focus-visible:ring-offset-2">{t("upload.template.choose")}</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
