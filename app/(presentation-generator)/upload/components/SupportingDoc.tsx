"use client";

import { useCallback, useContext, useEffect, type ChangeEvent, type DragEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { File, Paperclip, X } from "lucide-react";

import { notify } from "@/components/ui/sonner";
import { PromptComposerBoundaryContext } from "./PromptComposerBoundary";
import { exceedsPresentationUploadLimit } from "../services/document-preparation";
import {
  isAllowedDocumentName,
  SUPPORTED_DOCUMENT_ACCEPT,
} from "../services/supported-documents";

/**
 * How the selected documents participate in the upload flow. The parent owns
 * the flag and feature state; this component just resolves the localized
 * helper copy that explains the behavior to the user.
 *
 * - `none`: no files attached — show concise format guidance.
 * - `doc_aware`: document-aware rewrite is enabled and files are selected —
 *   tell the user AI will read the documents to optimize the prompt.
 * - `presentation_only`: the rollout flag is off and files are selected —
 *   tell the user the documents will be used during Create, not during
 *   rewrite.
 */
export type SupportingDocUsageMode = "none" | "doc_aware" | "presentation_only";

interface SupportingDocProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  /** Disables the whole attachment control while generation is in progress. */
  disabled?: boolean;
  multiple?: boolean;
  /**
   * Describes how the selected documents participate in the surrounding flow
   * so the helper copy stays truthful. Defaults to "none" when the caller
   * has no files or no flag context.
   */
  usageMode?: SupportingDocUsageMode;
}

const MAX_SUPPORTED_FILES = 8;
const ACCEPT = SUPPORTED_DOCUMENT_ACCEPT;

export default function SupportingDoc({
  files,
  onFilesChange,
  disabled = false,
  multiple = true,
  usageMode = "none",
}: SupportingDocProps) {
  const boundaryRef = useContext(PromptComposerBoundaryContext);
  const addFiles = useCallback((candidates: File[]) => {
    const allowed = candidates.filter(isAllowedFile);
    const rejected = candidates.length - allowed.length;
    if (rejected > 0) {
      notify.error(
        "Một số tệp không được hỗ trợ",
        "Hỗ trợ Word, PowerPoint, bảng tính, PDF/TXT/Markdown và tệp ảnh.",
      );
    }
    const withinLimit = allowed.filter((file) => !exceedsPresentationUploadLimit(file.size));
    if (withinLimit.length < allowed.length) {
      notify.error(
        "Tệp quá lớn",
        "Kích thước tệp phải nhỏ hơn 100 MB.",
      );
    }

    const next = multiple ? [...files, ...withinLimit] : withinLimit.slice(0, 1);
    const limited = next.slice(0, MAX_SUPPORTED_FILES);
    if (next.length > MAX_SUPPORTED_FILES) {
      notify.warning(
        "Đã đạt giới hạn số tệp",
        `Bạn chỉ có thể tải lên tối đa ${MAX_SUPPORTED_FILES} tài liệu.`,
      );
    }
    if (limited.length > files.length) {
      notify.success(
        "Đã chọn tệp",
        `Đã thêm ${(limited.length - files.length)} tệp.`,
      );
    }
    onFilesChange(limited);
  }, [files, multiple, onFilesChange]);

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []));
    event.currentTarget.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) addFiles(Array.from(event.dataTransfer.files ?? []));
  };

  // Helper copy follows the typed usage mode so the same component can be
  // reused by flows other than the document-aware rewrite without embedding
  // feature-flag checks here.
  const helperCopy =
    usageMode === "doc_aware" && files.length > 0
      ? Number(files.length) <= 1
                ? "AI sẽ dùng 1 tài liệu để tối ưu prompt"
                : `AI sẽ dùng ${files.length} tài liệu để tối ưu prompt`
      : usageMode === "presentation_only" && files.length > 0
        ? Number(files.length) <= 1
                ? "Tài liệu này sẽ được dùng khi tạo bài thuyết trình"
                : `${files.length} tài liệu sẽ được dùng khi tạo bài thuyết trình`
        : "Đính kèm Word, PowerPoint, bảng tính, PDF/TXT hoặc ảnh nếu bạn muốn AI dùng chúng.";

  // The composer owns the visible box, so drops anywhere on that box attach
  // files. The listener is rebound when the selection changes so the next
  // drop appends to the current list.
  useEffect(() => {
    const node = boundaryRef?.current;
    if (!node) return;

    const onDragOver = (event: globalThis.DragEvent) => {
      event.preventDefault();
    };
    const onDrop = (event: globalThis.DragEvent) => {
      event.preventDefault();
      if (disabled) return;
      addFiles(Array.from(event.dataTransfer?.files ?? []));
    };

    node.addEventListener("dragover", onDragOver);
    node.addEventListener("drop", onDrop);
    return () => {
      node.removeEventListener("dragover", onDragOver);
      node.removeEventListener("drop", onDrop);
    };
  }, [addFiles, boundaryRef, disabled]);

  return (
    <section
      className="flex flex-col gap-2"
      data-testid="attachments-uploader"
      aria-labelledby="attachments-uploader-label"
      onDragOver={boundaryRef ? undefined : (event) => event.preventDefault()}
      onDrop={boundaryRef ? undefined : handleDrop}
    >
      <h2 id="attachments-uploader-label" className="sr-only">
        {"Tài liệu tham chiếu"}
      </h2>
      <span className="sr-only" data-testid="attachments-optional-indicator">
        {"Không bắt buộc"}
      </span>

      {files.length > 0 && (
        <ul
          className="flex flex-wrap items-center gap-2"
          data-testid="file-list"
          aria-label={"Tệp đính kèm"}
        >
          <AnimatePresence mode="popLayout">
            {files.map((file, index) => (
              <motion.li
                key={`${file.name}-${file.size}-${index}`}
                layout="position"
                initial={{ opacity: 0, scale: 0.92, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="transform-gpu inline-flex h-[30px] max-w-full items-center gap-2 rounded-lg border border-[var(--gslide-border)] bg-white px-2 font-manrope text-[11px] text-[var(--gslide-ink)]"
                data-testid="attached-file-item"
              >
                <File className="h-3.5 w-3.5 shrink-0 text-[var(--gslide-accent)]" aria-hidden="true" />
                <span className="max-w-[180px] truncate" title={file.name}>
                  {file.name}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onFilesChange(files.filter((_, fileIndex) => fileIndex !== index))
                  }
                  aria-label={`Xóa ${file.name}`}
                  data-testid="remove-file-button"
                  className="rounded-full text-[#777777] hover:bg-[#E6E6E9] hover:text-[#191919] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--gslide-accent)_25%,transparent)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {files.length > 0 && (
        <p
          data-testid="attachments-helper"
          className="font-manrope text-[11px] font-normal leading-snug text-[var(--gslide-muted)]"
        >
          {helperCopy}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <motion.label
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="transform-gpu inline-flex h-8 min-w-0 cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--gslide-border)] bg-white px-2.5 font-manrope text-xs font-medium text-[var(--gslide-muted)] transition-colors hover:border-[color-mix(in_srgb,var(--gslide-accent)_35%,var(--gslide-border))] hover:text-[var(--gslide-ink)] focus-within:outline-none focus-within:ring-2 focus-within:ring-[color-mix(in_srgb,var(--gslide-accent)_25%,transparent)]"
        >
          <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{files.length ? `Đính kèm thêm (${files.length})` : "Đính kèm tệp"}</span>
          <input
            type="file"
            className="sr-only"
            accept={ACCEPT}
            multiple={multiple}
            disabled={disabled}
            onChange={handleFilesSelected}
            data-testid="file-upload-input"
          />
        </motion.label>
      </div>
    </section>
  );
}

function isAllowedFile(file: File) {
  return isAllowedDocumentName(file.name);
}
