/** Apply a chart element's font to its Chart.js configuration. */
export function applyChartFontFamily<T>(config: T, family: string | null | undefined): T {
  const selectedFamily = family?.trim();
  if (!selectedFamily) return config;

  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value === null || typeof value !== "object") return;

    const record = value as Record<string, unknown>;
    const font = record.font;
    if (font !== null && typeof font === "object" && !Array.isArray(font)) {
      (font as Record<string, unknown>).family = selectedFamily;
    }
    Object.values(record).forEach(visit);
  };

  visit(config);
  return config;
}
