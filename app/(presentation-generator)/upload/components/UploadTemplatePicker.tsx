"use client";

import { useEffect, useRef, useState, type TouchEvent } from "react";
import { motion } from "motion/react";
import { Check, ChevronDown, Layers3, Sparkles, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { templateCardCopy } from "../../components/builtin-template-copy";
import { TemplateThumbnailPreview } from "../../components/TemplateListUi";
import type { TemplateListItem } from "../../services/api/template";

export function AutoTemplateThumbnail() {
  return (
    <div
      data-testid="upload-template-auto-thumbnail"
      className="relative flex h-full w-full select-none items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#7A5AF8] via-[#6366F1] to-[#1D6FE8] shadow-sm"
    >
      <div className="absolute -left-3 -top-3 h-10 w-10 rounded-full bg-white/25 blur-[6px]" />
      <div className="absolute -bottom-3 -right-3 h-12 w-12 rounded-full bg-[#1D6FE8]/40 blur-[8px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.28),transparent_65%)]" />
      <div className="absolute inset-x-2.5 top-2 h-[2px] rounded-full bg-white/20" />
      <div className="absolute left-2.5 top-3.5 h-[2px] w-6 rounded-full bg-white/20" />
      <div className="relative z-10 flex items-center justify-center gap-1 text-white">
        <Sparkles size={16} className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]" />
        <span className="text-[11px] font-black tracking-wider text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]">
          AI
        </span>
      </div>
    </div>
  );
}

type UploadTemplatePickerProps = {
  templates: TemplateListItem[];
  loading: boolean;
  error: string | null;
  retry: () => void;
  selectedTemplateId: string | null;
  confirmedTemplateId?: string | null;
  isConfirmed?: boolean;
  onSelectionChange: (id: string | null) => void;
  onConfirmSelection: (id: string | null) => void;
  disabled?: boolean;
};

export function UploadTemplatePicker({
  templates,
  loading,
  error,
  retry,
  selectedTemplateId,
  confirmedTemplateId,
  isConfirmed,
  onSelectionChange,
  onConfirmSelection,
  disabled = false,
}: UploadTemplatePickerProps) {
  const totalItems = templates.length + 1;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const confirmedId = confirmedTemplateId !== undefined
    ? confirmedTemplateId
    : (isConfirmed ? selectedTemplateId : null);
  const isConfirmedSelection = confirmedId !== null && templates.some((t) => t.id === confirmedId);
  const confirmedTemplate = isConfirmedSelection ? templates.find((t) => t.id === confirmedId) ?? null : null;
  const confirmedCopy = confirmedTemplate ? templateCardCopy(confirmedTemplate) : null;

  const isAutoActive = activeIndex === 0;
  const activeTemplate = !isAutoActive ? templates[activeIndex - 1] ?? null : null;
  const activeCopy = activeTemplate ? templateCardCopy(activeTemplate) : null;

  useEffect(() => {
    if (loading) return;
    if (error || templates.length === 0) {
      if (selectedTemplateId) onSelectionChange(null);
      return;
    }
    if (isConfirmedSelection && confirmedId && !templates.some((t) => t.id === confirmedId)) {
      onConfirmSelection(null);
    }
  }, [loading, error, selectedTemplateId, isConfirmedSelection, confirmedId, templates, onSelectionChange, onConfirmSelection]);

  const openPicker = () => {
    if (!isConfirmedSelection || !confirmedId) {
      setActiveIndex(0);
      onSelectionChange(null);
    } else {
      const idx = templates.findIndex((template) => template.id === confirmedId);
      setActiveIndex(idx >= 0 ? idx + 1 : 0);
      onSelectionChange(confirmedId);
    }
    setOpen(true);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onSelectionChange(confirmedId);
    }
    setOpen(nextOpen);
  };

  const goTo = (index: number) => {
    if (totalItems === 0) return;
    setActiveIndex((index + totalItems) % totalItems);
  };

  // Hovering and arrowing only browse the preview; clicking picks the template,
  // so the selected border follows the click before "use this template".
  const selectAt = (index: number) => {
    goTo(index);
    if (index === 0) {
      onSelectionChange(null);
    } else {
      const target = templates[index - 1];
      if (target && target.id !== selectedTemplateId) onSelectionChange(target.id);
    }
  };

  const chooseActive = () => {
    if (!selectedTemplateId) {
      onConfirmSelection(null);
    } else {
      const selected = templates.find((template) => template.id === selectedTemplateId);
      onConfirmSelection(selected ? selected.id : null);
    }
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

  return (
    <>
      <motion.button
        type="button"
        data-testid="upload-template-trigger"
        onClick={openPicker}
        disabled={disabled || loading || templates.length === 0}
        whileHover={disabled || loading || templates.length === 0 ? undefined : { y: -1 }}
        whileTap={disabled || loading || templates.length === 0 ? undefined : { scale: 0.99 }}
        className="transform-gpu group flex w-full max-w-[410px] items-center gap-3 rounded-xl border border-[var(--gslide-border)] bg-white px-3 py-2.5 text-left transition-colors hover:border-[#1D6FE8]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D6FE8]/40 disabled:cursor-default disabled:opacity-70"
      >
        <span className="h-12 w-[78px] shrink-0 overflow-hidden rounded-lg bg-[#F8FBFB]">
          {loading ? (
            <span className="flex h-full items-center justify-center text-[#1D6FE8]"><Layers3 size={21} /></span>
          ) : error || templates.length === 0 ? (
            <span className="flex h-full items-center justify-center text-[#63748F]"><Layers3 size={21} /></span>
          ) : isConfirmedSelection && confirmedTemplate ? (
            <TemplateThumbnailPreview thumbnail={confirmedTemplate.thumbnail} templateName={confirmedCopy?.name ?? confirmedTemplate.name} />
          ) : (
            <AutoTemplateThumbnail />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#63748F]">{"Mẫu thiết kế"}</span>
          <span className="mt-0.5 block truncate text-sm font-semibold text-[#17243C]">
            {loading
              ? "Đang tải mẫu..."
              : error || templates.length === 0
                ? "Chọn mẫu"
                : isConfirmedSelection && confirmedCopy?.name
                  ? confirmedCopy.name
                  : "Auto"}
          </span>
        </span>
        {isConfirmedSelection && confirmedTemplate && (
          <span
            role="button"
            tabIndex={0}
            title={"Đổi về tự động"}
            aria-label={"Đổi về tự động"}
            data-testid="template-reset-auto-button"
            onClick={(event) => {
              event.stopPropagation();
              onConfirmSelection(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.stopPropagation();
                event.preventDefault();
                onConfirmSelection(null);
              }
            }}
            className="z-10 -mr-1 flex h-6 w-6 items-center justify-center rounded-full text-[#8B98AD] transition-colors hover:bg-[#EFF4FF] hover:text-[#1D6FE8]"
          >
            <X size={15} />
          </span>
        )}
        <ChevronDown aria-hidden="true" size={17} className="shrink-0 text-[#667A98]" />
      </motion.button>

      {!loading && (error || templates.length === 0) && (
        <div className="flex items-center justify-center gap-3 text-xs text-[#67758D]">
          <span>{error ? "Không thể tải mẫu." : "Chưa có mẫu khả dụng."}</span>
          <button
            type="button"
            data-testid="template-retry-button"
            onClick={retry}
            className="font-semibold text-[#1D6FE8] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D6FE8]/40"
          >
            {"Thử lại"}
          </button>
        </div>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="max-h-[calc(100dvh-24px)] w-[calc(100vw-24px)] max-w-[1000px] gap-0 overflow-x-hidden overflow-y-auto border border-[#EDEEF4] bg-white p-0 text-[#101323] shadow-[0_24px_80px_rgba(16,19,35,0.16)] motion-reduce:animate-none sm:rounded-2xl"
          overlayClassName="bg-[#101323]/55 motion-reduce:animate-none"
        >
          <div className="px-5 pb-5 pt-7 sm:px-8 sm:pb-7 sm:pt-8">
            <div className="pr-8">
              <DialogTitle className="text-xl font-bold leading-tight sm:text-2xl">{"Chọn phong cách cho slide"}</DialogTitle>
              <DialogDescription className="mt-1.5 text-sm text-[#6B6D78]">{"Xem các mẫu và chọn phong cách cho bài thuyết trình."}</DialogDescription>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-[minmax(0,1fr)_246px] md:gap-7">
              <div className="min-w-0">
                <div
                  data-testid="template-carousel"
                  tabIndex={0}
                  role="group"
                  aria-label={"Xem trước mẫu. Dùng phím mũi tên trái và phải để duyệt."}
                  className="touch-pan-y rounded-xl bg-[#F6F8FB] p-3 outline-none focus-visible:ring-2 focus-visible:ring-[#1D6FE8] sm:p-5"
                  onKeyDown={(event) => {
                    if (event.key === "ArrowRight") {
                      event.preventDefault();
                      const next = (activeIndex + 1) % totalItems;
                      goTo(next);
                      if (next === 0) onSelectionChange(null);
                      else onSelectionChange(templates[next - 1]?.id ?? null);
                    }
                    if (event.key === "ArrowLeft") {
                      event.preventDefault();
                      const prev = (activeIndex - 1 + totalItems) % totalItems;
                      goTo(prev);
                      if (prev === 0) onSelectionChange(null);
                      else onSelectionChange(templates[prev - 1]?.id ?? null);
                    }
                    if (event.key === "Home") {
                      event.preventDefault();
                      goTo(0);
                      onSelectionChange(null);
                    }
                    if (event.key === "End") {
                      event.preventDefault();
                      const last = totalItems - 1;
                      goTo(last);
                      onSelectionChange(templates[last - 1]?.id ?? null);
                    }
                  }}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  <div data-testid="template-main-preview" className="aspect-video overflow-hidden rounded-md border border-[#EDEEF4] bg-white shadow-[0_8px_24px_rgba(16,19,35,0.08)]">
                    {isAutoActive ? (
                      <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#7A5AF8] via-[#6366F1] to-[#1D6FE8] p-6 text-center text-white select-none">
                        <div className="absolute -left-10 -top-10 h-36 w-36 rounded-full bg-white/20 blur-xl" />
                        <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-[#1D6FE8]/40 blur-2xl" />
                        <div className="relative z-10 flex flex-col items-center gap-2.5">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md shadow-inner">
                            <Sparkles size={24} className="text-white drop-shadow" />
                          </div>
                          <span className="text-xl font-bold tracking-tight text-white drop-shadow sm:text-2xl">
                            {"Auto"}
                          </span>
                          <span className="max-w-[360px] text-xs font-normal text-white/90 sm:text-sm">
                            {"AI tự động phân tích dàn ý để chọn mẫu thiết kế phù hợp nhất"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      activeTemplate && <TemplateThumbnailPreview thumbnail={activeTemplate.thumbnail} templateName={activeCopy?.name ?? activeTemplate.name} />
                    )}
                  </div>
                </div>
                <div className="mt-4 min-w-0">
                  <span data-testid="template-active-name" aria-live="polite" aria-atomic="true" className="block truncate text-base font-bold sm:text-lg">
                    {isAutoActive ? "Auto" : activeCopy?.name}
                  </span>
                  <span className="text-xs tabular-nums text-[#6B6D78]">{activeIndex + 1} / {totalItems}</span>
                </div>
              </div>

              <div className="min-w-0 border-t border-[#EDEEF4] pt-4 md:border-l md:border-t-0 md:pl-7 md:pt-0">
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#6B6D78]">{"Tất cả mẫu"}</div>
                <div
                  className="hide-scrollbar flex gap-2 overflow-x-auto pb-2 md:max-h-[420px] md:flex-col md:overflow-x-hidden md:overflow-y-auto md:pr-1"
                  role="group"
                  aria-label={"Tất cả mẫu"}
                  onMouseLeave={() => {
                    if (!selectedTemplateId) {
                      setActiveIndex(0);
                    } else {
                      const idx = templates.findIndex((template) => template.id === selectedTemplateId);
                      setActiveIndex(idx >= 0 ? idx + 1 : 0);
                    }
                  }}
                >
                  {/* Option 0: Auto */}
                  <button
                    type="button"
                    data-testid="template-rail-item-auto"
                    data-selected={selectedTemplateId === null || undefined}
                    aria-pressed={activeIndex === 0}
                    aria-label={`Xem mẫu Auto`}
                    onMouseEnter={() => goTo(0)}
                    onFocus={() => goTo(0)}
                    onClick={() => selectAt(0)}
                    className={cn(
                      "flex w-40 shrink-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-[border-color,background-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D6FE8] md:w-full",
                      selectedTemplateId === null
                        ? "border-[#1D6FE8] bg-[#EFF4FF] shadow-[0_0_0_2px_rgba(29,111,232,0.28)]"
                        : activeIndex === 0
                          ? "border-[#DADDE6] bg-[#F6F8FB]"
                          : "border-transparent hover:border-[#DADDE6] hover:bg-[#F6F8FB]",
                    )}
                  >
                    <span className="block aspect-video w-[54px] shrink-0 overflow-hidden rounded border border-[#EDEEF4] bg-white">
                      <AutoTemplateThumbnail />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#101323]">
                      {"Auto"}
                    </span>
                    {!isConfirmedSelection && <Check aria-hidden="true" size={15} className="hidden shrink-0 text-[#1D6FE8] md:block" />}
                  </button>

                  {/* Templates 1..N */}
                  {templates.map((template, index) => {
                    const copy = templateCardCopy(template);
                    const isSelected = selectedTemplateId === template.id;
                    const isItemConfirmed = isConfirmedSelection && confirmedId === template.id;
                    const isPreviewing = activeIndex === index + 1;
                    return (
                      <button
                        key={template.id}
                        type="button"
                        data-testid={`template-rail-item-${template.id}`}
                        data-selected={isSelected || undefined}
                        aria-pressed={isPreviewing}
                        aria-label={`Xem mẫu ${copy.name}`}
                        onMouseEnter={() => goTo(index + 1)}
                        onFocus={() => goTo(index + 1)}
                        onClick={() => selectAt(index + 1)}
                        className={cn(
                          "flex w-40 shrink-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-[border-color,background-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D6FE8] md:w-full",
                          isSelected
                            ? "border-[#1D6FE8] bg-[#EFF4FF] shadow-[0_0_0_2px_rgba(29,111,232,0.28)]"
                            : isPreviewing
                              ? "border-[#DADDE6] bg-[#F6F8FB]"
                              : "border-transparent hover:border-[#DADDE6] hover:bg-[#F6F8FB]",
                        )}
                      >
                        <span className="block aspect-video w-[54px] shrink-0 overflow-hidden rounded border border-[#EDEEF4] bg-white"><TemplateThumbnailPreview thumbnail={template.thumbnail} templateName={copy.name} /></span>
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#101323]">{copy.name}</span>
                        {isItemConfirmed && <Check aria-hidden="true" size={15} className="hidden shrink-0 text-[#1D6FE8] md:block" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end border-t border-[#EDEEF4] pt-5 sm:mt-6">
              <button type="button" data-testid="template-choose-button" onClick={chooseActive} className="rounded-lg bg-[#1D6FE8] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1558C0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D6FE8] focus-visible:ring-offset-2">{"Dùng mẫu này"}</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
