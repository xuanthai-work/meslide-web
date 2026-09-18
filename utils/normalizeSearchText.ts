/**
 * Canonicalize user-visible text before matching it.
 *
 * Vietnamese text can arrive in either NFC (precomposed) or NFD (combining
 * marks) form. Normalizing both sides keeps search results identical without
 * removing meaningful diacritics.
 */
export function normalizeSearchText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFC")
    .trim()
    .toLocaleLowerCase("vi-VN");
}

export function includesSearchText(value: unknown, query: unknown): boolean {
  return normalizeSearchText(value).includes(normalizeSearchText(query));
}
