"use client";
import { Button } from "@/components/ui/button";
import {
  Play,
  Loader2,
  Redo2,
  Undo2,
  RotateCcw,
  ArrowRightFromLine,
  ArrowUpRight,
  Pencil,
  Check,
  Keyboard,
  Layout,
  X,
  AlertTriangle,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDispatch, useSelector } from "react-redux";

import { RootState } from "@/store/store";
import { notify } from "@/components/ui/sonner";
import { usePresentationUndoRedo } from "../hooks/PresentationUndoRedo";
import ToolTip from "@/components/ToolTip";
import {
  clearPresentationData,
  setEnableHtmlSelector,
  updateTitle,
} from "@/store/slices/presentationGeneration";
import { clearHistory } from "@/store/slices/undoRedoSlice";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { GSlideWordmark } from "@/components/gslide";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { TemplatePickerDialog } from "./TemplatePickerDialog";
import { buildSafeExportFileName } from "@/utils/exportFilename";

function formatDisplayTitle(rawTitle?: string | null): string {
  if (!rawTitle) return "Bài thuyết trình";
  const firstLine = rawTitle.split(/\r?\n/)[0].trim();
  const cleaned = firstLine
    .replace(/\s*(Người trình bày|Tác giả|Author|Presenter|Ngày|Date)\s*:.*$/i, "")
    .replace(/^#+\s*/, "")
    .trim();
  return cleaned || rawTitle.slice(0, 60);
}

function PresentationExportOptions({
  mobile,
  exportAsLabel,
  onExportPdf,
  onExportPptx,
}: {
  mobile: boolean;
  exportAsLabel: string;
  onExportPdf: () => void;
  onExportPptx: () => void;
}) {
  return (
    <div
      className={` rounded-[18px] max-md:mt-4 ${mobile ? "" : "bg-white"}  p-5`}
    >
      <p className="text-sm font-medium text-[#19001F]">{exportAsLabel}</p>
      <div className="my-[18px] h-[1px] bg-[#E8E8E8]" />
      <div className="space-y-3">
        <Button
          onClick={onExportPdf}
          variant="ghost"
          className={`  rounded-none px-0 w-full text-xs flex justify-start text-black hover:bg-transparent ${mobile ? "bg-white py-6 border-none rounded-lg" : ""
            }`}
        >
          PDF
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Button>
        <Button
          onClick={onExportPptx}
          variant="ghost"
          className={`w-full flex px-0 justify-start text-xs text-black hover:bg-transparent  ${mobile ? "bg-white py-6" : ""
            }`}
        >
          PPTX
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

const PresentationHeader = ({
  presentation_id,
  isPresentationSaving,
  currentSlide,
}: {
  presentation_id: string;
  isPresentationSaving: boolean;
  currentSlide?: number;
}) => {
  const [open, setOpen] = useState(false);
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isRegenerateConfirmOpen, setIsRegenerateConfirmOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  /** Avoid committing on blur when Save/Cancel was used (focus/click ordering) */
  const titleBlurIntentRef = useRef<"none" | "save" | "cancel">("none");

  const dispatch = useDispatch();

  const { presentationData, isStreaming } = useSelector(
    (state: RootState) => state.presentationGeneration
  );
  const { onUndo, onRedo, canUndo, canRedo } = usePresentationUndoRedo();

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    dispatch(setEnableHtmlSelector(!isStreaming));
  }, [dispatch, isStreaming]);

  const beginTitleEdit = () => {
    if (isStreaming || !presentationData) return;
    setDraftTitle(presentationData.title || "");
    setIsEditingTitle(true);
  };

  const commitTitleEdit = () => {
    if (!presentationData) {
      setIsEditingTitle(false);
      return;
    }
    const trimmed = draftTitle.normalize("NFC").trim();
    const next = trimmed || presentationData.title || "Bài thuyết trình";
    if (next !== presentationData.title) {
      dispatch(updateTitle(next));
    }
    setIsEditingTitle(false);
  };

  const cancelTitleEdit = () => {
    setDraftTitle(presentationData?.title || "");
    setIsEditingTitle(false);
  };

  const handleTitleBlur = () => {
    queueMicrotask(() => {
      const intent = titleBlurIntentRef.current;
      titleBlurIntentRef.current = "none";
      if (intent === "cancel" || intent === "save") return;
      commitTitleEdit();
    });
  };

  const onTitleSaveMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    titleBlurIntentRef.current = "save";
  };

  const onTitleCancelMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    titleBlurIntentRef.current = "cancel";
  };

  const handleExportPptx = async () => {
    if (isStreaming) return;

    let exportToastId: string | number | undefined;
    try {
      exportToastId = notify.loading(
        "Đang xuất PPTX",
        "Bài thuyết trình đang được xuất. Quá trình này có thể mất một lúc."
      );
      setIsExporting(true);
      const safePptxFileName = buildSafeExportFileName(
        presentationData?.title,
        "pptx"
      );
      const safePptxTitle = safePptxFileName.replace(/\.pptx$/i, "");
      const response = await fetch("/api/export-presentation", {
        method: "POST",
        body: JSON.stringify({
          format: "pptx",
          id: presentation_id,
          title: safePptxTitle,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to export PPTX");
      }

      const { path: pptxPath } = await response.json();
      if (!pptxPath) {
        throw new Error("No path returned from export");
      }

      downloadLink(pptxPath, safePptxFileName);
      notify.success(
        "Xuất hoàn tất",
        "Tệp PPTX đã được tải xuống.",
        { id: exportToastId }
      );
    } catch (error) {
      console.error("Export failed:", error);
      notify.error(
        "Xuất thất bại",
        "Không thể xuất bài thuyết trình. Vui lòng thử lại.",
        exportToastId !== undefined ? { id: exportToastId } : undefined
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (isStreaming) return;

    let exportToastId: string | number | undefined;
    try {
      exportToastId = notify.loading(
        "Đang xuất PDF",
        "Bài thuyết trình đang được xuất. Quá trình này có thể mất một lúc."
      );
      setIsExporting(true);
      const safePdfFileName = buildSafeExportFileName(
        presentationData?.title,
        "pdf"
      );
      const safePdfTitle = safePdfFileName.replace(/\.pdf$/i, "");
      const response = await fetch("/api/export-presentation", {
        method: "POST",
        body: JSON.stringify({
          format: "pdf",
          id: presentation_id,
          title: safePdfTitle,
        }),
      });

      if (response.ok) {
        const { path: pdfPath } = await response.json();
        if (!pdfPath) {
          throw new Error("No path returned from export");
        }
        downloadLink(pdfPath, safePdfFileName);
      } else {
        throw new Error("Failed to export PDF");
      }
      notify.success(
        "Xuất hoàn tất",
        "Tệp PDF đã được tải xuống.",
        { id: exportToastId }
      );
    } catch (error) {
      console.error(error);
      notify.error(
        "Xuất thất bại",
        "Không thể xuất bài thuyết trình. Vui lòng thử lại.",
        exportToastId !== undefined ? { id: exportToastId } : undefined
      );
    } finally {
      setIsExporting(false);
    }
  };
  const handleReGenerate = () => {
    setIsRegenerateConfirmOpen(false);
    dispatch(clearPresentationData());
    dispatch(clearHistory());
    router.push(`/presentation?id=${presentation_id}&stream=true`);
  };
  const downloadLink = (path: string, fileName: string) => {
    const link = document.createElement("a");
    link.href = path;
    link.download = fileName;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const titleBlock = (
    <div
      className={cn(
        "min-w-0 flex-1 transition-[box-shadow] duration-200",
        isEditingTitle && "relative z-[60]"
      )}
    >
      {isEditingTitle ? (
        <div className="flex w-full min-w-0 items-stretch gap-0.5 rounded-[14px] border border-[#E4E2EB] bg-white py-1 pl-3.5 pr-1 shadow-[0_2px_12px_rgba(17,3,31,0.06)] ring-2 ring-[var(--gslide-accent)]/15">
          <input
            ref={titleInputRef}
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                titleBlurIntentRef.current = "save";
                commitTitleEdit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                titleBlurIntentRef.current = "cancel";
                cancelTitleEdit();
              }
            }}
            placeholder={"Tiêu đề bài thuyết trình"}
            className="min-w-0 flex-1 bg-transparent py-2 pr-2 font-unbounded text-base leading-tight text-[#101323] placeholder:text-[#101323]/35 outline-none border-0 focus:ring-0"
            aria-label={"Tiêu đề bài thuyết trình"}
          />
          <div className="flex shrink-0 items-center gap-0.5 border-l border-[#EDECEC] pl-1 ml-0.5">
            <ToolTip content={"Lưu · Enter"}>
              <button
                type="button"
                onMouseDown={onTitleSaveMouseDown}
                onClick={commitTitleEdit}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--gslide-accent)] hover:bg-[var(--gslide-accent)]/10 transition-colors"
                aria-label={"Lưu tiêu đề"}
              >
                <Check className="h-4 w-4" strokeWidth={2.25} />
              </button>
            </ToolTip>
            <ToolTip content={"Hủy · Esc"}>
              <button
                type="button"
                onMouseDown={onTitleCancelMouseDown}
                onClick={cancelTitleEdit}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#101323]/55 hover:bg-[var(--gslide-accent-soft)] hover:text-[#101323] transition-colors"
                aria-label={"Hủy chỉnh sửa tiêu đề"}
              >
                <X className="h-4 w-4" strokeWidth={2.25} />
              </button>
            </ToolTip>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={beginTitleEdit}
          disabled={isStreaming || !presentationData}
          className={cn(
            "group/title flex min-w-0 max-w-[480px] items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-left transition-colors",
            "hover:bg-[var(--gslide-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gslide-accent)]",
            "disabled:pointer-events-none disabled:opacity-100 disabled:hover:bg-transparent"
          )}
        >
          <span className="min-w-0 truncate font-unbounded text-sm font-semibold text-[#101323] leading-none">
            {formatDisplayTitle(presentationData?.title)}
          </span>
          {presentationData && !isStreaming && (
            <Pencil
              className="h-3.5 w-3.5 shrink-0 text-[#101323]/40 transition-all duration-200 group-hover/title:text-[var(--gslide-accent)] opacity-80 sm:opacity-0 sm:group-hover/title:opacity-100 group-hover/title:opacity-100"
              aria-hidden
            />
          )}
        </button>
      )}
    </div>
  );

  return (
    <>
      <div className="sticky top-0 z-50 flex h-[72px] items-center justify-between gap-1.5 border-b border-[var(--gslide-border)] bg-[var(--gslide-bg)] px-3 sm:h-[80px] sm:gap-2 sm:px-4 xl:gap-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              router.push("/dashboard");
            }}
            aria-label={"Về trang chủ"}
            className="hidden shrink-0 items-center sm:flex"
          >
            <GSlideWordmark className="text-base" />
          </button>
          <div className="hidden h-4 w-[1px] bg-[#E5E7EB] sm:block shrink-0" aria-hidden="true" />
          {presentationData && !isStreaming && !isEditingTitle ? (
            <ToolTip content={"Đổi tên bài thuyết trình"}>{titleBlock}</ToolTip>
          ) : (
            titleBlock
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 xl:gap-2.5">
          {isPresentationSaving && (
            <div className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            </div>
          )}
          <div className="flex items-center gap-1.5 bg-white px-3 h-[38px] border border-[#EDECEC] rounded-full shadow-sm">
            <ToolTip content={"Tạo lại bài thuyết trình"}>
              <button
                type="button"
                onClick={() => setIsRegenerateConfirmOpen(true)}
                className="group transform-gpu transition-transform duration-200 hover:scale-110 active:scale-90"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#101323] group-hover:text-[var(--gslide-accent)] duration-300" />
              </button>
            </ToolTip>
            <Separator orientation="vertical" className="h-4" />
            <ToolTip content={"Hoàn tác"}>
              <button
                disabled={!canUndo}
                className=" disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group transform-gpu transition-transform duration-200 hover:scale-110 active:scale-90"
                onClick={() => {
                  onUndo();
                }}
              >
                <Undo2 className="w-3.5 h-3.5 text-[#101323] group-hover:text-[var(--gslide-accent)] duration-300" />
              </button>
            </ToolTip>
            <Separator orientation="vertical" className="h-4" />
            <ToolTip content={"Làm lại"}>
              <button
                disabled={!canRedo}
                className=" disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group transform-gpu transition-transform duration-200 hover:scale-110 active:scale-90"
                onClick={() => {
                  onRedo();
                }}
              >
                <Redo2 className="w-3.5 h-3.5 text-[#101323] group-hover:text-[var(--gslide-accent)] duration-300" />
              </button>
            </ToolTip>
          </div>

        {
          <ToolTip content={"Phím tắt (?)"}>
            <motion.button
              type="button"
              aria-label={"Phím tắt"}
              aria-haspopup="dialog"
              aria-expanded={shortcutsDialogOpen}
              aria-keyshortcuts="?"
              data-testid="keyboard-shortcuts-btn"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="transform-gpu hidden h-[38px] w-[38px] items-center justify-center rounded-full border border-[#EDECEC] bg-white shadow-sm text-[#101323] transition-colors hover:border-[var(--gslide-border)] hover:bg-[var(--gslide-accent-soft)] hover:text-[var(--gslide-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gslide-accent)] focus-visible:ring-offset-2 sm:inline-flex"
              onClick={() => setShortcutsDialogOpen(true)}
            >
              <Keyboard
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.8}
              />
            </motion.button>
          </ToolTip>}

          <ToolTip content={"Chọn mẫu thiết kế"}>
            <motion.button
              type="button"
              onClick={() => setIsTemplatePickerOpen(true)}
              disabled={isStreaming === true}
              whileHover={isStreaming ? undefined : { scale: 1.03 }}
              whileTap={isStreaming ? undefined : { scale: 0.97 }}
              className="transform-gpu flex h-[38px] items-center gap-1.5 rounded-full border border-[#EDECEC] bg-white px-3.5 text-sm font-medium text-[#101323] shadow-sm transition-colors duration-200 hover:border-[var(--gslide-accent)] hover:bg-[var(--gslide-accent-soft)] hover:text-[var(--gslide-accent)] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={"Chọn mẫu"}
            >
              <Layout className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{"Mẫu"}</span>
            </motion.button>
          </ToolTip>

          <ToolTip content={"Trình chiếu bài thuyết trình"}>
            <motion.button
              type="button"
              onClick={() => {
                const to = `?id=${presentation_id}&mode=present&slide=${
                  currentSlide || 0
                }`;
                router.push(to);
              }}
              disabled={
                isStreaming ||
                !presentationData?.slides ||
                presentationData?.slides.length === 0
              }
              whileHover={isStreaming || !presentationData?.slides?.length ? undefined : { scale: 1.03 }}
              whileTap={isStreaming || !presentationData?.slides?.length ? undefined : { scale: 0.97 }}
              className="transform-gpu flex h-[38px] items-center gap-2 rounded-full border border-[#EDECEC] bg-white px-3.5 text-sm font-medium text-[#101323] shadow-sm transition-colors duration-200 hover:border-[var(--gslide-accent)] hover:bg-[var(--gslide-accent-soft)] hover:text-[var(--gslide-accent)] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={"Trình chiếu"}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span className="hidden sm:inline">{"Trình chiếu"}</span>
            </motion.button>
          </ToolTip>

          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              render={
                <motion.button
                  className="transform-gpu flex h-[38px] items-center gap-2 rounded-full bg-[var(--gslide-accent)] px-4 text-sm font-semibold text-white shadow-sm transition-[background-color,box-shadow] duration-200 hover:bg-[var(--gslide-accent-hover)] hover:shadow-[0_4px_12px_rgba(29,111,232,0.24)] disabled:cursor-not-allowed disabled:opacity-50 sm:px-5"
                  disabled={isExporting || isStreaming === true}
                  whileHover={isExporting || isStreaming ? undefined : { scale: 1.02 }}
                  whileTap={isExporting || isStreaming ? undefined : { scale: 0.98 }}
                >
                  {isExporting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span className="hidden sm:inline">{"Xuất"}</span>
                  )}{" "}
                  <ArrowRightFromLine className="w-3.5 h-3.5" />
                </motion.button>
              }
            />
            <PopoverContent
              align="end"
              className="w-[200px] rounded-[18px] space-y-2 p-0  "
            >
              <PresentationExportOptions
                mobile={false}
                exportAsLabel={"Xuất dưới dạng"}
                onExportPdf={() => {
                  handleExportPdf();
                  setOpen(false);
                }}
                onExportPptx={() => {
                  handleExportPptx();
                  setOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <Dialog
        open={isRegenerateConfirmOpen}
        onOpenChange={setIsRegenerateConfirmOpen}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[360px] rounded-2xl border-0 p-0 shadow-2xl">
          <DialogHeader className="items-center px-6 pb-4 pt-6 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <DialogTitle className="text-lg font-semibold text-[#191919]">
              {"Tạo lại bài thuyết trình?"}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-gray-500">
              {"Thao tác này sẽ thay thế các slide hiện tại bằng phiên bản mới và xóa lịch sử hoàn tác. Các chỉnh sửa hiện tại có thể bị mất."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row border-t border-gray-100 p-0 sm:space-x-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsRegenerateConfirmOpen(false)}
              className="h-auto flex-1 rounded-none rounded-bl-2xl px-4 py-3.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-700"
            >
              {"Hủy"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleReGenerate}
              className="h-auto flex-1 rounded-none rounded-br-2xl border-l border-gray-100 px-4 py-3.5 text-sm font-medium text-red-500 hover:bg-red-50 hover:text-red-600"
            >
              {"Tạo lại"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <KeyboardShortcutsDialog
        open={shortcutsDialogOpen}
        onOpenChange={setShortcutsDialogOpen}
      />
      <TemplatePickerDialog
        open={isTemplatePickerOpen}
        onOpenChange={setIsTemplatePickerOpen}
      />
    </>
  );
};

export default PresentationHeader;
