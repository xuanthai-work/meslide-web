import { defaultLocale, fallbackLocale, type Locale } from "./config.ts";
import type { Catalog, MessageKey, MessageValue, Params } from "./types";
import vi from "./locales/vi.ts";
import en from "./locales/en.ts";

/**
 * Direct translator for server components, metadata functions, hooks, and
 * non-React utilities. React components should use {@link useT} instead so
 * they re-render when the active locale changes.
 *
 * Lookup order: active locale catalog, then {@link fallbackLocale} (English),
 * then the key itself (so a missing key is visible rather than empty). In
 * development a missing key also logs a warning.
 */

const catalogs: Record<Locale, Catalog> = {
  "vi-VN": vi,
  "en-US": en,
};

const isDev = process.env.NODE_ENV !== "production";

/** Canonical catalog shape used for compile-time key checking. */
type Shape = typeof vi;

/** Resolve a dot-path key to a leaf message within a catalog, or `undefined`. */
function lookup(catalog: Catalog, key: string): MessageValue | undefined {
  const parts = key.split(".");
  let node: Catalog | MessageValue = catalog;
  for (const part of parts) {
    if (node && typeof node === "object" && !Array.isArray(node) && part in node) {
      node = (node as Catalog)[part];
    } else {
      return undefined;
    }
  }
  return typeof node === "string" || typeof node === "function"
    ? node
    : undefined;
}

/** Replace `{name}` placeholders with coerced param values. */
export function interpolate(template: string, params: Params): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name)
      ? String(params[name])
      : match,
  );
}

/**
 * Translate `key` for `locale` (defaulting to {@link defaultLocale}).
 *
 * Falls back to {@link fallbackLocale} when the key is absent from the active
 * catalog, and to the key string itself when missing from both — so problems
 * are visible instead of rendering empty text. Missing keys log a warning in
 * development.
 */
export function translate<K extends MessageKey<Shape>>(
  key: K,
  params?: Params,
  locale: Locale = defaultLocale,
): string {
  const value = lookup(catalogs[locale], key) ?? lookup(catalogs[fallbackLocale], key);

  if (value === undefined) {
    if (isDev) {
      console.warn(`[i18n] missing translation key: "${key}"`);
    }
    return key;
  }

  return typeof value === "function"
    ? value(params ?? {}, locale)
    : interpolate(value, params ?? {});
}

/**
 * Escape hatch for dynamically-built keys that cannot be checked at compile
 * time. Prefer {@link translate} with a literal key wherever possible.
 */
export function translateRaw(key: string, params?: Params, locale?: Locale): string {
  return translate(key as MessageKey<Shape>, params, locale);
}

export { defaultLocale, fallbackLocale };
export type { Locale };