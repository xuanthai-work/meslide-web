"use client";

import { useCallback, useContext, useEffect, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { File, Paperclip, X } from "lucide-react";

import { notify } from "@/components/ui/sonner";
import { useT } from "@/i18n/provider";
import { PromptComposerBoundaryContext } from "./PromptInput";
import { exceedsPresentationUploadLimit } from "../services/document-preparation";

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
  /** Composer action rendered on the bottom-right of the attachment row. */
  action?: ReactNode;
}

const MAX_SUPPORTED_FILES = 8;
const ALLOWED_EXTENSIONS = [
  ".pdf", ".txt", ".docx", ".docm", ".odt",
  ".pptx", ".pptm", ".odp", ".xlsx", ".xlsm",
  ".ods", ".csv", ".tsv", ".jpg", ".jpeg", ".png", ".gif",
  ".bmp", ".tiff", ".webp",
];
const ACCEPT = ALLOWED_EXTENSIONS.join(",");

export default function SupportingDoc({
  files,
  onFilesChange,
  disabled = false,
  multiple = true,
  usageMode = "none",
  action,
}: SupportingDocProps) {
  const t = useT();
  const boundaryRef = useContext(PromptComposerBoundaryContext);
  const addFiles = useCallback((candidates: File[]) => {
    const allowed = candidates.filter(isAllowedFile);
    const rejected = candidates.length - allowed.length;
    if (rejected > 0) {
      notify.error(
        t("upload.files.unsupportedTitle"),
        t("upload.files.supportedDescription"),
      );
    }
    const withinLimit = allowed.filter((file) => !exceedsPresentationUploadLimit(file.size));
    if (withinLimit.length < allowed.length) {
      notify.error(
        t("templateStudio.upload.tooLargeTitle"),
        t("templateStudio.upload.tooLargeDescription"),
      );
    }

    const next = multiple ? [...files, ...withinLimit] : withinLimit.slice(0, 1);
    const limited = next.slice(0, MAX_SUPPORTED_FILES);
    if (next.length > MAX_SUPPORTED_FILES) {
      notify.warning(
        t("upload.files.limitTitle"),
        t("upload.files.limitDescription", { max: MAX_SUPPORTED_FILES }),
      );
    }
    if (limited.length > files.length) {
      notify.success(
        t("upload.files.selectedTitle"),
        t("upload.files.addedDescription", { count: limited.length - files.length }),
      );
    }
    onFilesChange(limited);
  }, [files, multiple, onFilesChange, t]);

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
      ? t("upload.files.helperDocAware", { count: files.length })
      : usageMode === "presentation_only" && files.length > 0
        ? t("upload.files.helperPresentationOnly", { count: files.length })
        : t("upload.files.emptyGuidance");

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
        {t("upload.files.sectionLabel")}
      </h2>
      <span className="sr-only" data-testid="attachments-optional-indicator">
        {t("upload.files.optionalIndicator")}
      </span>

      {files.length > 0 && (
        <ul
          className="flex flex-wrap items-center gap-2"
          data-testid="file-list"
          aria-label={t("upload.files.attachedAria")}
        >
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="inline-flex h-[30px] max-w-full items-center gap-2 rounded-lg border border-[var(--gslide-border)] bg-white px-2 font-manrope text-[11px] text-[var(--gslide-ink)]"
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
                aria-label={t("upload.files.removeAria", { name: file.name })}
                data-testid="remove-file-button"
                className="rounded-full text-[#777777] hover:bg-[#E6E6E9] hover:text-[#191919] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--gslide-accent)_25%,transparent)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex h-8 min-w-0 cursor-pointer items-center gap-2 rounded-full px-2.5 font-manrope text-xs font-medium text-[#4C4C4C] transition hover:bg-[#F6F6F9] focus-within:outline-none focus-within:ring-2 focus-within:ring-[color-mix(in_srgb,var(--gslide-accent)_25%,transparent)]">
          <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{files.length ? t("upload.files.attachMore", { count: files.length }) : t("upload.files.attach")}</span>
          <input
            type="file"
            className="sr-only"
            accept={ACCEPT}
            multiple={multiple}
            disabled={disabled}
            onChange={handleFilesSelected}
            data-testid="file-upload-input"
          />
        </label>
        {action}
      </div>
    </section>
  );
}

function isAllowedFile(file: File) {
  const name = (file.name || "").toLowerCase();
  return ALLOWED_EXTENSIONS.some((extension) => name.endsWith(extension));
}
