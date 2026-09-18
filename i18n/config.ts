/**
 * Localization configuration for GSlide.
 *
 * The default UI locale is Vietnamese (`vi-VN`). English (`en-US`) remains a
 * complete fallback catalog during the migration so a missing Vietnamese key
 * never leaves the user with an empty string.
 *
 * Locale is deliberately NOT added to route paths — GSlide is embedded as a
 * miniweb and existing URLs must keep working without `/vi` or `/en` prefixes.
 * A visible language switcher is not required for the first release; this
 * module is structured so one can be added later without restructuring
 * components (see {@link I18nProvider}).
 */

/**
 * Locales supported by the UI, in preference order.
 *
 * The string values are BCP-47 tags used by `Intl` APIs and the React context.
 * For Open Graph `og:locale` (which uses `language_REGION`), use
 * {@link ogLocale}.
 */
export const locales = ["vi-VN", "en-US"] as const;

export type Locale = (typeof locales)[number];

/** UI locale rendered on first load. */
export const defaultLocale: Locale = "vi-VN";

/** Catalog used when a key is missing from the active locale. */
export const fallbackLocale: Locale = "en-US";

/**
 * Map a BCP-47 UI locale to the `language_REGION` form expected by Open Graph
 * `og:locale`.
 */
export function ogLocale(locale: Locale): string {
  const [language, region] = locale.split("-");
  return region
    ? `${language.toLowerCase()}_${region.toUpperCase()}`
    : language.toLowerCase();
}

/** Returns `true` when `value` is one of the supported UI locales. */
export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
