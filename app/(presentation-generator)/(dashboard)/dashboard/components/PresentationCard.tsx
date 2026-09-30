'use client'
import React from "react";

import { Card } from "@/components/ui/card";
import { DashboardApi } from "@/app/(presentation-generator)/services/api/dashboard";
import { Archive, AlertTriangle, Copy, EllipsisVertical, Loader2, Play, Trash } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { useRouter } from "next/navigation";
import { notify } from "@/components/ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import SlideScale from "@/app/(presentation-generator)/components/PresentationRender";
import {
  shouldRenderTemplateV2HtmlPreview,
  TemplateV2HtmlSlidePreview,
} from "@/app/(presentation-generator)/components/TemplateV2HtmlSlidePreview";
import MarkdownRenderer from "@/components/MarkDownRender";
import ToolTip from "@/components/ToolTip";

export const PresentationCard = ({
  id,
  title,
  presentation,
  viewMode = "grid",
  onDeleted,
  onDuplicated
}: {
  id: string;
  title: string;
  presentation: any;
  viewMode?: "grid" | "list";
  onDeleted?: (presentationId: string) => void;
  onDuplicated?: (presentation: any) => void;
}) => {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [showActions, setShowActions] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isDuplicating, setIsDuplicating] = React.useState(false);
  const isUnsupported = presentation?.version === "v1-standard";

  const handlePreview = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isUnsupported) {
      notify.warning(
        "Bài thuyết trình không được hỗ trợ",
        "Bộ slide này được tạo bằng phiên bản GSlide cũ. Hãy dùng phiên bản tương thích để mở."
      );
      return;
    }
    router.push(`/presentation?id=${id}`);
  };

  // Present mode lives inside the editor route as a query-param state, so a
  // quick present is the same navigation plus `mode=present`.
  const handleQuickPresent = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isUnsupported) {
      notify.warning(
        "Bài thuyết trình không được hỗ trợ",
        "Bộ slide này được tạo bằng phiên bản GSlide cũ. Hãy dùng phiên bản tương thích để mở."
      );
      return;
    }
    router.push(`/presentation?id=${id}&mode=present&slide=0`);
  };

  const hasSlides = (presentation?.n_slides ?? presentation?.slides?.length ?? 0) > 0;

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    const response = await DashboardApi.deletePresentation(id);

    if (response?.success) {
      notify.success("Đã xóa bài thuyết trình", "Bài thuyết trình đã được xóa khỏi trang chủ của bạn.");
      setShowDeleteDialog(false);
      if (onDeleted) {
        onDeleted(id);
      }
    } else {
      notify.error("Không thể xóa bài thuyết trình", response?.message || "Đã xảy ra lỗi khi xóa bài thuyết trình.");
    }
    setIsDeleting(false);
  };

  const handleDuplicate = async () => {
    if (isDuplicating) return;
    setIsDuplicating(true);
    try {
      const duplicated = await DashboardApi.duplicatePresentation(id);
      notify.success("Đã nhân bản bài thuyết trình", "Một bản sao đã được thêm vào trang chủ của bạn.");
      onDuplicated?.(duplicated);
    } catch (error) {
      notify.error(
        "Không thể nhân bản bài thuyết trình",
        error instanceof Error ? error.message : "Đã xảy ra lỗi khi nhân bản bài thuyết trình."
      );
    } finally {
      setIsDuplicating(false);
    }
  };
  const firstSlide = presentation?.slides?.[0];
  const useTemplateV2HtmlPreview = shouldRenderTemplateV2HtmlPreview(
    firstSlide,
    presentation?.version
  );
  return (
    <>
      <Card
        suppressHydrationWarning={true}
        onClick={handlePreview}
        aria-disabled={isUnsupported}
        title={isUnsupported ? "Không được hỗ trợ trong phiên bản GSlide này" : undefined}
        className={`relative flex flex-col overflow-hidden rounded-xl border-[var(--gslide-border)] bg-white p-0 shadow-none transition-all duration-500 sm:shadow-none presentation-card group slide-theme ${
          isUnsupported
            ? "cursor-not-allowed border-[#EDEEEF]"
            : "cursor-pointer hover:shadow-md"
        }`}
      >
     
      <div
        id={`dashboard-presentation-card-${id}`}
        suppressHydrationWarning={true}
        className={`relative z-40 flex flex-1 ${viewMode === "list" ? "min-h-[122px] flex-row" : "flex-col"}`}
      >
        <img src="/card_bg.svg" alt="" className="absolute top-0 left-0 w-full h-full object-cover" />
        <div className={isUnsupported
          ? `relative flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-[#EDEEEF] bg-white/90 ${viewMode === "list" ? "m-3 w-[170px] shrink-0" : "mx-5 mt-4"}`
          : `relative aspect-video overflow-hidden bg-white ${viewMode === "list" ? "m-3 w-[170px] shrink-0 rounded-lg border border-[#EDEEEF]" : "w-full border-b border-[#EDEEEF]"}`
        }>

          {isUnsupported ? (
            <div className="flex flex-col items-center gap-2 px-5 text-center text-[#666666]">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--gslide-accent-soft)] text-[var(--gslide-accent)]">
                <Archive className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <p className="text-xs font-medium">{"Không có bản xem trước"}</p>
            </div>
          ) : useTemplateV2HtmlPreview ? (
            <TemplateV2HtmlSlidePreview
              slide={firstSlide}
              fonts={presentation.fonts}
            />
          ) : (
            <SlideScale
              slide={firstSlide}
              fonts={presentation.fonts}
              isClickable={false}
              presentationLayout={presentation.layout}
            />
          )}
        </div>
        <p className="absolute right-2 top-2 z-40 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-[#191919] shadow-sm backdrop-blur-sm">
          {presentation.n_slides ?? presentation?.slides?.length ?? 0}
        </p>
        <div className={`z-40 flex bg-white px-5 py-3 ${viewMode === "list" ? "min-w-0 flex-1 items-center border-l border-[#EDEEEF]" : "relative mt-auto w-full border-t border-[#EDEEEF]"}`}>
          <div className="flex items-center justify-between gap-7 w-full">
            <div className="flex flex-col items-start gap-1">
              <div className="text-sm text-[#191919] font-semibold  overflow-hidden line-clamp-1">
                <MarkdownRenderer content={title} className="mb-0 line-clamp-1 overflow-hidden text-sm font-semibold text-[var(--gslide-ink)]" />
              </div>
              <p className="text-sm text-[var(--gslide-muted)]">
                {new Date(presentation?.created_at).toLocaleDateString("vi-VN")}
              </p>

            </div>
            <div className="flex items-center gap-1">
            {!isUnsupported && hasSlides && (
              <ToolTip content={"Trình chiếu nhanh"}>
                <button
                  type="button"
                  aria-label={"Trình chiếu nhanh bộ slide này"}
                  data-testid={`quick-present-${id}`}
                  onClick={handleQuickPresent}
                  className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-[var(--gslide-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gslide-accent)]/40"
                >
                  <Play className="h-4 w-4" aria-hidden="true" />
                </button>
              </ToolTip>
            )}
            <Popover open={showActions} onOpenChange={setShowActions}>
              <PopoverTrigger className="w-6 h-6 hover:bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-700" onClick={(e) => e.stopPropagation()}>
                <EllipsisVertical className="w-6 h-6 text-gray-500" />
              </PopoverTrigger>
              <PopoverContent align="end" className="bg-white w-[200px]">
                {!isUnsupported && (
                  <button
                    className="flex items-center justify-between w-full px-2 py-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isDuplicating}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowActions(false);
                      void handleDuplicate();
                    }}
                  >
                    <p>{isDuplicating ? "Đang nhân bản…" : "Nhân bản"}</p>
                    {isDuplicating ? (
                      <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                    ) : (
                      <Copy className="h-4 w-4 text-gray-500" />
                    )}
                  </button>
                )}
                <button
                  className="flex items-center justify-between w-full px-2 py-1 hover:bg-gray-100"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowActions(false);
                    setShowDeleteDialog(true);
                  }}
                >
                  <p>{"Xóa"}</p>
                  <Trash className="h-4 w-4 text-red-500" />
                </button>
              </PopoverContent>
            </Popover>
            </div>
          </div>

        </div>
      </div>
      </Card>

      <Dialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          if (isDeleting && !open) return;
          setShowDeleteDialog(open);
        }}
      >
        <DialogContent
          hideDefaultClose
          overlayClassName="z-[100] bg-[#101828]/55 backdrop-blur-[3px]"
          className="z-[101] w-[calc(100vw-32px)] max-w-[420px] gap-0 overflow-hidden rounded-[24px] border-0 bg-white p-0 shadow-[0_28px_90px_rgba(15,23,42,0.24)] sm:max-w-[420px]"
        >
          <DialogHeader className="items-center px-7 pb-6 pt-8 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--gslide-accent-soft)] ring-8 ring-[#FAF9FF]">
              <AlertTriangle
                className="h-6 w-6 text-[var(--gslide-accent)]"
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </div>
            <DialogTitle className="text-[22px] font-semibold leading-7 tracking-[-0.02em] text-[#191919]">
              {"Xóa bài thuyết trình?"}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="w-full pt-2 text-sm leading-6 text-[#667085]">
                <p>{"Thao tác này sẽ xóa vĩnh viễn bài thuyết trình bên dưới."}</p>
                <div
                  className="mt-4 rounded-[12px] border border-[#EAECF0] bg-[#F9FAFB] px-4 py-3 text-left"
                  title={title || "Bài thuyết trình không tiêu đề"}
                >
                  <p className="line-clamp-2 break-words text-sm font-medium leading-5 text-[#344054]">
                    {title || "Bài thuyết trình không tiêu đề"}
                  </p>
                </div>
                <p className="mt-3 text-[13px] text-[#98A2B3]">
                  {"Thao tác này không thể hoàn tác."}
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="grid grid-cols-2 gap-3 border-t border-[#EAECF0] bg-[#FCFCFD] p-4 sm:grid sm:space-x-0">
            <button
              type="button"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
              className="h-11 rounded-[10px] border border-[#D0D5DD] bg-white px-4 text-sm font-medium text-[#344054] shadow-sm transition-colors hover:bg-[#F9FAFB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gslide-accent)]/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {"Hủy"}
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
              className="flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#191919] px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gslide-accent)]/30 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {"Đang xóa…"}
                </>
              ) : (
                <>
                  <Trash className="h-4 w-4" aria-hidden="true" />
                  {"Xóa"}
                </>
              )}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
