"use client";

import type { ChangeEvent, DragEvent } from "react";
import { File, Paperclip, X } from "lucide-react";

import { notify } from "@/components/ui/sonner";
import { useT } from "@/i18n/provider";

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
}: SupportingDocProps) {
  const t = useT();
  const addFiles = (candidates: File[]) => {
    const allowed = candidates.filter(isAllowedFile);
    const rejected = candidates.length - allowed.length;
    if (rejected > 0) {
      notify.error(
        t("upload.files.unsupportedTitle"),
        t("upload.files.supportedDescription"),
      );
    }

    const next = multiple ? [...files, ...allowed] : allowed.slice(0, 1);
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
  };

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

  return (
    <section
      className="flex flex-col gap-2.5 rounded-[18px] border border-[var(--gslide-border)] bg-white p-3"
      data-testid="attachments-uploader"
      aria-labelledby="attachments-uploader-label"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-[var(--gslide-accent-soft)]">
            <Paperclip className="h-3 w-3 text-[var(--gslide-accent)]" aria-hidden="true" />
          </span>
          <h2
            id="attachments-uploader-label"
            className="font-manrope text-xs font-semibold uppercase tracking-wide text-[#333333]"
          >
            {t("upload.files.sectionLabel")}
          </h2>
        </div>
        <span
          data-testid="attachments-optional-indicator"
          className="inline-flex h-[20px] items-center rounded-full bg-[#F4F4F4] px-2 font-manrope text-[10px] font-medium leading-none text-[#666666]"
        >
          {t("upload.files.optionalIndicator")}
        </span>
      </header>

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

      <div className="flex items-center justify-between gap-3">
        <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-full px-2.5 font-manrope text-xs font-medium text-[#4C4C4C] transition hover:bg-[#F6F6F9] focus-within:outline-none focus-within:ring-2 focus-within:ring-[color-mix(in_srgb,var(--gslide-accent)_25%,transparent)]">
          <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{files.length ? t("upload.files.attachMore", { count: files.length }) : t("upload.files.attach")}</span>
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
      </div>

      <p
        data-testid="attachments-helper"
        className="font-manrope text-[11px] font-normal leading-snug text-[var(--gslide-muted)]"
      >
        {helperCopy}
      </p>
    </section>
  );
}

function isAllowedFile(file: File) {
  const name = (file.name || "").toLowerCase();
  return ALLOWED_EXTENSIONS.some((extension) => name.endsWith(extension));
}
