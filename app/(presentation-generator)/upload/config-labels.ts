import type { MessageKey } from "@/i18n/types";

/**
 * Display-label maps for upload advanced-settings dropdowns.
 *
 * Tone and verbosity values stored on {@link PresentationConfig} (and sent
 * to the API) are stable tokens such as `sales_pitch` and `text-heavy`.
 * Those tokens must never be shown as-is: CSS `capitalize` turns them into
 * `Sales_pitch` / `Text-Heavy`. Labels live in the i18n catalogs instead.
 *
 * This file stays erasable TypeScript (no `enum`) so the Node type-stripping
 * test runner can import it the same way it imports `language.ts`.
 */
type CatalogKey = MessageKey<typeof import("@/i18n/locales/vi").default>;

export const TONE_CODES = [
  "default",
  "casual",
  "professional",
  "funny",
  "educational",
  "sales_pitch",
] as const;

export type ToneCode = (typeof TONE_CODES)[number];

export const VERBOSITY_CODES = ["concise", "standard", "text-heavy"] as const;

export type VerbosityCode = (typeof VERBOSITY_CODES)[number];

export const TONE_LABEL_KEY: Record<ToneCode, CatalogKey> = {
  default: "upload.advanced.tones.default",
  casual: "upload.advanced.tones.casual",
  professional: "upload.advanced.tones.professional",
  funny: "upload.advanced.tones.funny",
  educational: "upload.advanced.tones.educational",
  sales_pitch: "upload.advanced.tones.salesPitch",
};

export const VERBOSITY_LABEL_KEY: Record<VerbosityCode, CatalogKey> = {
  concise: "upload.advanced.verbosityOptions.concise",
  standard: "upload.advanced.verbosityOptions.standard",
  "text-heavy": "upload.advanced.verbosityOptions.textHeavy",
};
