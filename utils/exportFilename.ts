const MAX_EXPORT_TITLE_LENGTH = 80;

export type ExportExtension = "pdf" | "pptx";

/** Build a filesystem-safe export name while preserving Vietnamese letters. */
export function buildSafeExportFileName(
  rawTitle: string | null | undefined,
  extension: ExportExtension,
): string {
  const normalizedTitle = (rawTitle || "presentation").normalize("NFC").trim();
  const titleWithoutExtension = normalizedTitle.replace(/\.(pdf|pptx)$/iu, "");

  let safeBase = titleWithoutExtension
    // Unicode letters/numbers (including Vietnamese), spaces, _ and - are safe.
    .replace(/[^\p{L}\p{N}\s_-]+/gu, "-")
    .replace(/\s+/gu, "-")
    .replace(/[-_]{2,}/gu, "-")
    .replace(/^[-_]+|[-_]+$/gu, "");

  if (!safeBase) safeBase = "presentation";

  if (safeBase.length > MAX_EXPORT_TITLE_LENGTH) {
    safeBase = safeBase.slice(0, MAX_EXPORT_TITLE_LENGTH).replace(/[-_]+$/gu, "");
  }

  return `${safeBase || "presentation"}.${extension}`;
}
