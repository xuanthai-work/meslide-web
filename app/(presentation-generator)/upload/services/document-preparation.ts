import type { DecomposedDocument } from "../../services/api/presentation-generation";
import { MAX_NUMBER_OF_SLIDES } from "@/utils/presentationLimits";
import { toLegacyLanguageValue } from "../language";
import type { LanguageType } from "../type";

/** Product document limit. The Next proxy allows 110mb so multipart overhead fits. */
export const PRESENTATION_UPLOAD_MAX_BYTES = 100 * 1024 * 1024;

export const BLANK_PRESENTATION_PATH = "/api/v1/ppt/presentation/create/blank";

export function exceedsPresentationUploadLimit(size: number): boolean {
  return size > PRESENTATION_UPLOAD_MAX_BYTES;
}

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

export type FingerprintFile = {
  name: string;
  size: number;
  lastModified: number;
  type?: string;
};

/** Ordered fingerprint of the selected files: name, size, lastModified, type. */
export function fileFingerprint(files: FingerprintFile[]): string {
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

export type PreparationStep = "use-cache" | "decompose" | "upload-and-decompose";

/** Same files and language reuse the cache. A language change reuses the upload. */
export function planDocumentPreparation(input: {
  fileFingerprint: string;
  decompositionKey: string;
  cachedDecompositionKey: string | null;
  uploadedFingerprint: string | null;
}): PreparationStep {
  if (
    input.cachedDecompositionKey &&
    input.cachedDecompositionKey === input.decompositionKey
  ) {
    return "use-cache";
  }
  if (input.uploadedFingerprint === input.fileFingerprint) return "decompose";
  return "upload-and-decompose";
}

export function buildCreatePresentationBody(input: {
  content: string;
  n_slides: number | null;
  file_paths?: string[];
  language: LanguageType | null;
  tone?: string | null;
  verbosity?: string | null;
  instructions?: string | null;
  web_search?: boolean;
}) {
  const limitedSlideCount =
    typeof input.n_slides === "number"
      ? Math.min(Math.max(input.n_slides, 1), MAX_NUMBER_OF_SLIDES)
      : null;
  return {
    content: input.content,
    n_slides: limitedSlideCount,
    file_paths: input.file_paths,
    language: toLegacyLanguageValue(input.language),
    tone: input.tone,
    verbosity: input.verbosity,
    instructions: input.instructions,
    include_table_of_contents: true,
    include_title_slide: true,
    web_search: input.web_search,
  };
}