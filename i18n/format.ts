import { defaultLocale, type Locale } from "./config.ts";

export function formatNumber(
  value: number,
  locale: Locale = defaultLocale,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatDate(
  value: Date | number | string,
  locale: Locale = defaultLocale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(locale, options).format(date);
}

export function formatFileSize(
  bytes: number,
  locale: Locale = defaultLocale,
): string {
  const megabytes = bytes / (1024 * 1024);
  return `${formatNumber(megabytes, locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} MB`;
}
