import type { DecomposedDocument } from "../../services/api/presentation-generation";
import type { LanguageType } from "../type";

/**
 * Pure helpers for the document-preparation cache owned by the upload page.
 *
 * The browser keeps selected files as `File[]`; before the first
 * document-aware rewrite or Create they are uploaded and decomposed once.
 * Two separate cache keys keep that work reusable:
 *
 * - the upload cache key is the ordered file fingerprint, so re-decomposing
 *   after a language change never re-uploads the originals;
 * - the decomposition cache key adds the normalized presentation language,
 *   because OCR/extraction is language-sensitive.
 */

export type PreparedDocumentSet = {
  fileFingerprint: string;
  decompositionKey: string;
  uploadedPaths: string[];
  documents: DecomposedDocument[];
};

/** Ordered fingerprint of the selected files: name, size, lastModified, type. */
export function fileFingerprint(files: File[]): string {
  return files
    .map(
      (file) =>
        `${file.name}|${file.size}|${file.lastModified}|${file.type ?? ""}`
    )
    .join(";;");
}

/** Decomposition cache key: file fingerprint plus normalized language. */
export function decompositionKeyFor(
  fingerprint: string,
  language: LanguageType | null | undefined
): string {
  return `${fingerprint}::${(language ?? "").trim().toLowerCase()}`;
}

export function documentPathsOf(prepared: PreparedDocumentSet): string[] {
  return prepared.documents.map((document) => document.file_path);
}