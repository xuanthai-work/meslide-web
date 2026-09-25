"use client";

import { useEffect, useRef, useState, type PointerEvent, type TouchEvent } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Layers3 } from "lucide-react";
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

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    event.currentTarget.style.setProperty("--tilt-x", `${-y * 7}deg`);
    event.currentTarget.style.setProperty("--tilt-y", `${x * 9}deg`);
  };

  const resetPointer = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.style.setProperty("--tilt-x", "0deg");
    event.currentTarget.style.setProperty("--tilt-y", "0deg");
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
        className="group flex w-full max-w-[410px] items-center gap-3 rounded-2xl border border-[var(--gslide-border)] bg-white px-3 py-2.5 text-left shadow-[0_6px_24px_rgba(22,40,70,0.05)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[#1D6FE8]/40 hover:shadow-[0_14px_32px_rgba(22,40,70,0.11)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D6FE8]/40 disabled:cursor-default disabled:opacity-70 motion-reduce:transform-none motion-reduce:transition-none"
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
          className="max-h-[calc(100dvh-24px)] w-[calc(100vw-24px)] max-w-[980px] gap-0 overflow-x-hidden overflow-y-auto border border-white/10 bg-[#0D1930] p-0 text-white shadow-[0_34px_100px_rgba(3,13,30,0.55)] motion-reduce:animate-none sm:rounded-[28px]"
          overlayClassName="bg-[#070F21]/75 backdrop-blur-[8px] motion-reduce:animate-none"
        >
          <div className="relative overflow-hidden px-5 pb-5 pt-6 sm:px-9 sm:pt-8">
            <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[46%] h-72 w-[65%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#236BE7]/20 blur-[90px]" />
            <DialogTitle className="relative font-syne text-xl font-bold tracking-tight sm:text-[26px]">{t("upload.template.dialogTitle")}</DialogTitle>
            <DialogDescription className="relative mt-2 text-sm text-[#9CAECC]">{t("upload.template.dialogDescription")}</DialogDescription>

            <div
              data-testid="template-carousel"
              tabIndex={0}
              role="group"
              aria-label={t("upload.template.carouselAria")}
              className="relative mt-3 h-[280px] touch-pan-y overflow-hidden rounded-[22px] outline-none focus-visible:ring-2 focus-visible:ring-[#83B9FF] sm:mt-5 sm:h-[370px]"
              style={{ perspective: "1200px" }}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") { event.preventDefault(); event.currentTarget.focus(); goTo(activeIndex + 1); }
                if (event.key === "ArrowLeft") { event.preventDefault(); event.currentTarget.focus(); goTo(activeIndex - 1); }
                if (event.key === "Home") { event.preventDefault(); event.currentTarget.focus(); goTo(0); }
                if (event.key === "End") { event.preventDefault(); event.currentTarget.focus(); goTo(templates.length - 1); }
              }}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {[-1, 1, 0].map((offset) => {
                const index = (activeIndex + offset + templates.length) % templates.length;
                const template = templates[index];
                if (!template || (templates.length === 1 && offset !== 0) || (templates.length === 2 && offset === 1)) return null;
                const copy = templateCardCopy(template, locale);
                return (
                  <div
                    key={template.id}
                    className={cn(
                      "absolute left-1/2 top-1/2 w-[min(68vw,360px)] transition-transform duration-500 ease-out sm:w-[390px] motion-reduce:transition-none",
                      offset === 0 ? "z-20" : "z-10",
                    )}
                    style={{
                      transform: `translate(-50%, -50%) translateX(${offset * 70}%) rotateY(${-offset * 38}deg) scale(${offset === 0 ? 1 : 0.76})`,
                      opacity: offset === 0 ? 1 : 0.68,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => offset === 0 ? chooseActive() : goTo(index)}
                      onPointerMove={offset === 0 ? handlePointerMove : undefined}
                      onPointerLeave={offset === 0 ? resetPointer : undefined}
                      aria-label={offset === 0 ? t("upload.template.chooseAria", { name: copy.name }) : t("upload.template.previewAria", { name: copy.name })}
                      className={cn(
                        "w-full rounded-[18px] border bg-white p-2 text-left shadow-[0_24px_55px_rgba(0,0,0,0.4)] outline-none transition-transform duration-200 focus-visible:ring-4 focus-visible:ring-[#8CB9FF] motion-reduce:transition-none",
                        offset === 0 ? "border-[#8CB9FF]" : "border-white/60",
                      )}
                      style={offset === 0 ? { transform: "rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))" } : undefined}
                    >
                      <span className="block aspect-video overflow-hidden rounded-[12px] bg-[#F8FBFB]">
                        <TemplateThumbnailPreview thumbnail={template.thumbnail} templateName={copy.name} />
                      </span>
                      <span className="flex items-center justify-between gap-2 px-2 pb-1 pt-3 text-[#15233B]">
                        <span className="truncate font-syne text-sm font-bold sm:text-base">{copy.name}</span>
                        {selectedTemplateId === template.id && <Check aria-hidden="true" size={17} className="shrink-0 text-[#1D6FE8]" />}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="relative mt-1 flex items-center justify-center gap-4 sm:gap-6">
              <button type="button" onClick={() => goTo(activeIndex - 1)} aria-label={t("upload.template.previous")} className="rounded-full border border-white/20 p-2.5 text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8CB9FF]"><ArrowLeft size={18} /></button>
              <span className="min-w-0 text-center">
                <span data-testid="template-active-name" aria-live="polite" aria-atomic="true" className="block truncate font-syne text-base font-bold sm:text-lg">{activeCopy?.name}</span>
                <span className="block text-xs text-[#9CAECC]">{activeIndex + 1} / {templates.length}</span>
              </span>
              <button type="button" onClick={() => goTo(activeIndex + 1)} aria-label={t("upload.template.next")} className="rounded-full border border-white/20 p-2.5 text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8CB9FF]"><ArrowRight size={18} /></button>
            </div>

            <div className="relative mt-5 flex gap-2 overflow-x-auto pb-2" role="group" aria-label={t("upload.template.railAria")}>
              {templates.map((template, index) => {
                const copy = templateCardCopy(template, locale);
                return (
                  <button
                    key={template.id}
                    type="button"
                    data-testid={`template-rail-item-${template.id}`}
                    aria-pressed={activeIndex === index}
                    aria-label={t("upload.template.previewAria", { name: copy.name })}
                    onClick={() => goTo(index)}
                    className={cn("w-20 shrink-0 rounded-lg border p-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8CB9FF]", activeIndex === index ? "border-[#8CB9FF] bg-[#8CB9FF]/15" : "border-white/15 bg-white/5 hover:border-white/40")}
                  >
                    <span className="block aspect-video overflow-hidden rounded bg-white"><TemplateThumbnailPreview thumbnail={template.thumbnail} templateName={copy.name} /></span>
                    <span className="mt-1 block truncate text-[10px] text-white">{copy.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="relative mt-4 flex justify-end">
              <button type="button" data-testid="template-choose-button" onClick={chooseActive} className="rounded-full bg-[#2877F2] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_7px_22px_rgba(35,107,231,0.32)] transition-colors hover:bg-[#418CFA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8CB9FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D1930]">{t("upload.template.choose")}</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
