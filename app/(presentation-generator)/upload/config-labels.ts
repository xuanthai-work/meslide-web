/**
 * Display-label maps for upload advanced-settings dropdowns.
 *
 * Tone and verbosity values stored on {@link PresentationConfig} (and sent
 * to the API) are stable tokens such as `sales_pitch` and `text-heavy`.
 * Those tokens must never be shown as-is: CSS `capitalize` turns them into
 * `Sales_pitch` / `Text-Heavy`. Labels are inlined in Vietnamese here.
 *
 * This file stays erasable TypeScript (no `enum`) so the Node type-stripping
 * test runner can import it the same way it imports `language.ts`.
 */

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

export const TONE_LABEL: Record<ToneCode, string> = {
  default: "Mặc định",
  casual: "Thân mật",
  professional: "Chuyên nghiệp",
  funny: "Hài hước",
  educational: "Giáo dục",
  sales_pitch: "Thuyết trình bán hàng",
};

export const VERBOSITY_LABEL: Record<VerbosityCode, string> = {
  concise: "Ngắn gọn",
  standard: "Tiêu chuẩn",
  "text-heavy": "Nhiều chữ",
};
