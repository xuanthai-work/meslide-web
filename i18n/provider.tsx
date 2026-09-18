"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { defaultLocale, type Locale } from "./config";
import { translate } from "./translate";
import type { MessageKey, Params } from "./types";

/**
 * Client-side i18n context. Wraps the app at the root/client boundary (see
 * `app/ClientRoot.tsx`) so every client component can call {@link useT} /
 * {@link useI18n} without prop-drilling locale.
 *
 * The provider defaults to {@link defaultLocale} (Vietnamese), so server and
 * first client render match — no flash of English on first load. The locale is
 * passed as a prop (not read from the URL) so routes stay locale-free, and a
 * language switcher can be added later by simply lifting locale into state.
 */

type TranslateFn = <K extends MessageKey<typeof import("./locales/vi").default>>(
  key: K,
  params?: Params,
) => string;

interface I18nContextValue {
  locale: Locale;
  t: TranslateFn;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale = defaultLocale,
  children,
}: {
  locale?: Locale;
  children: ReactNode;
}) {
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      t: ((key: never, params?: Params) => translate(key, params, locale)) as TranslateFn,
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Access the active locale and `t` function. Falls back to a Vietnamese
 * translator when used outside an {@link I18nProvider} (e.g. a component
 * rendered before the provider mounts) so rendering never throws.
 */
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  return {
    locale: defaultLocale,
    t: ((key: never, params?: Params) => translate(key, params, defaultLocale)) as TranslateFn,
  };
}

/** Convenience hook returning just the `t` function. */
export function useT(): TranslateFn {
  return useI18n().t;
}