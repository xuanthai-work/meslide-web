/**
 * Extensions the upload attachment control accepts.
 *
 * Mirrors the backend whitelist in
 * `gslide-api/servers/fastapi/constants/documents.py`
 * (`UPLOAD_ACCEPTED_EXTENSIONS`). Keep both in sync: a format missing on
 * either side is rejected or silently skipped during document decomposition.
 */
export const SUPPORTED_DOCUMENT_EXTENSIONS = [
  ".pdf",
  ".txt",
  ".md",
  ".markdown",
  ".docx",
  ".docm",
  ".odt",
  ".pptx",
  ".pptm",
  ".odp",
  ".xlsx",
  ".xlsm",
  ".ods",
  ".csv",
  ".tsv",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".bmp",
  ".tiff",
  ".webp",
] as const;

/** `accept` attribute value for the hidden file input. */
export const SUPPORTED_DOCUMENT_ACCEPT =
  SUPPORTED_DOCUMENT_EXTENSIONS.join(",");

/** Extension gate used by the drop zone and the file picker. */
export function isAllowedDocumentName(name: string | null | undefined): boolean {
  const normalized = (name ?? "").toLowerCase();
  return SUPPORTED_DOCUMENT_EXTENSIONS.some((extension) =>
    normalized.endsWith(extension),
  );
}
