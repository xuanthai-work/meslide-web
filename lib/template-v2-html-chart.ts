import { markdownToPlainChartText } from "@/components/slide-editor/charts/chart-data";
import { applyChartFontFamily } from "@/lib/chart-font";
import {
  CHART_BROWSER_SCRIPT_URL,
  CHART_DATALABELS_SCRIPT_URL,
} from "@/lib/chart-browser";
import {
  CHART_FONT_FAMILY,
  DEFAULT_CHART_COLORS,
  DATA_LABEL_POSITIONS,
  clamp,
  cssNumber,
  escapeAttribute,
  escapeCssColor,
  escapeScriptText,
  frameStyle,
  isComponent,
  readArray,
  readBoolean,
  readBox,
  readNumber,
  readRecord,
  readRecordOrNull,
  readString,
  readStringValue,
  transformStyle,
  type ChartKind,
  type ChartPointData,
  type ChartSeriesData,
  type DataLabelPosition,
  type InfographicKind,
  type JsonRecord,
  type NormalizedChartData,
  type RenderMode,
} from "@/lib/template-v2-html-shared";

export function renderChart(item: JsonRecord, mode: RenderMode): string {
  const box = readBox(item);
  const width = Math.max(1, box.width ?? 1);
  const height = Math.max(1, box.height ?? 1);
  const config = chartConfig(item, height);

  return `<div style="${frameStyle(item, mode)}${transformStyle(
    item
  )}overflow:hidden"><canvas data-gslide-chart="true" data-chart-config="${escapeAttribute(
    JSON.stringify(config)
  )}" width="${cssNumber(Math.round(width))}" height="${cssNumber(
    Math.round(height)
  )}" style="display:block;width:100%;height:100%"></canvas></div>`;
}

export function renderInfographic(item: JsonRecord, mode: RenderMode): string {
  const data = infographicData(item);
  const kind = infographicKindFromValue(readString(data.type));
  if (kind === "gauge") return renderGaugeInfographic(item, mode);
  return renderProgressBarInfographic(item, mode);
}

export function renderProgressBarInfographic(item: JsonRecord, mode: RenderMode): string {
  const metrics = infographicMetrics(item);
  const highlightColor = infographicHighlightColor(item);
  const baseColor = infographicBaseColor(item);
  const fallbackSize = { width: 180, height: 40 };
  const box = readBox(item, fallbackSize);

  return `<div style="${frameStyle(item, mode, fallbackSize)}${transformStyle(
    item
  )}display:flex;align-items:center;overflow:hidden"><div style="position:relative;width:100%;height:${cssNumber(
    Math.max(
      6,
      Math.min(18, Math.round((box.height ?? fallbackSize.height) * 0.35))
    )
  )}px;border-radius:999px;background:${escapeCssColor(
    baseColor
  )};overflow:hidden"><div style="height:100%;width:${cssNumber(
    metrics.ratio * 100
  )}%;border-radius:inherit;background:${escapeCssColor(highlightColor)}"></div></div></div>`;
}

export function renderGaugeInfographic(item: JsonRecord, mode: RenderMode): string {
  const metrics = infographicMetrics(item);
  const highlightColor = infographicHighlightColor(item);
  const baseColor = infographicBaseColor(item);
  const fallbackSize = { width: 160, height: 96 };
  const progressPath =
    metrics.ratio > 0
      ? `<path d="${escapeAttribute(
        describeGaugeArc(60, 60, 48, metrics.ratio)
      )}" fill="none" stroke="${escapeAttribute(
        escapeCssColor(highlightColor)
      )}" stroke-width="12" stroke-linecap="round"/>`
      : "";

  return `<div style="${frameStyle(item, mode, fallbackSize)}${transformStyle(
    item
  )}overflow:hidden"><svg width="100%" height="100%" viewBox="0 0 120 72" preserveAspectRatio="xMidYMid meet" style="display:block"><path d="M 12 60 A 48 48 0 0 1 108 60" fill="none" stroke="${escapeAttribute(
    escapeCssColor(baseColor)
  )}" stroke-width="12" stroke-linecap="round"/>${progressPath}</svg></div>`;
}

export function chartConfig(item: JsonRecord, height: number): JsonRecord {
  const chartKind = chartKindFromValue(readString(item.chartType ?? item.chart_type));
  const data = normalizeChartData(item, chartKind);
  const primaryColor = safeChartColor(readString(item.color), DEFAULT_CHART_COLORS[0]);
  const colors = data.colors.length > 0 ? data.colors : [primaryColor];
  const axisColor = safeChartColor(
    readString(item.axisColor ?? item.axis_color),
    "#98A2B3"
  );
  const gridColor = safeChartColor(
    readString(item.gridColor ?? item.grid_color),
    axisColor
  );
  const textColor = safeChartColor(
    readString(item.textColor ?? item.text_color ?? item.labelColor ?? item.label_color),
    "#475467"
  );
  const titleColor =
    safeChartColor(readString(item.titleColor ?? item.title_color), "#344054");
  const legendColor = safeChartColor(
    readString(item.legendColor ?? item.legend_color),
    textColor
  );
  const title = markdownToPlainChartText(readString(item.title) ?? "");
  const fontSize = clamp(height * 0.033, 9, 18);
  const titleFontSize = clamp(height * 0.044, 11, 26);
  const valueFontSize = clamp(height * 0.029, 8, 15);
  const autoShowLegend =
    isPieLikeChart(chartKind) ||
    data.series.length > 1 ||
    Boolean(data.series[0]?.name && data.series[0].name !== "Series 1");
  const showLegend = readOptionalBoolean(
    item.legend ?? item.showLegend,
    autoShowLegend
  );
  const dataLabelPosition = readDataLabelPosition(
    Object.prototype.hasOwnProperty.call(item, "data_labels")
      ? item.data_labels
      : item.dataLabels
  );
  const dataLabels = dataLabelPosition != null;
  const xAxisGrid = readOptionalBoolean(
    item.x_axis_grid ?? item.xAxisGrid ?? item.grid,
    true
  );
  const yAxisGrid = readOptionalBoolean(
    item.y_axis_grid ?? item.yAxisGrid ?? item.grid,
    true
  );
  const xAxis = readOptionalBoolean(item.x_axis ?? item.xAxis, true);
  const yAxis = readOptionalBoolean(item.y_axis ?? item.yAxis, true);
  const xAxisTitle = markdownToPlainChartText(
    readString(
      Object.prototype.hasOwnProperty.call(item, "x_axis_title")
        ? item.x_axis_title
        : item.xAxisTitle
    ) ?? ""
  );
  const yAxisTitle = markdownToPlainChartText(
    readString(
      Object.prototype.hasOwnProperty.call(item, "y_axis_title")
        ? item.y_axis_title
        : item.yAxisTitle
    ) ?? ""
  );
  const config: JsonRecord = {
    type: chartJsType(chartKind),
    data: {
      labels: data.categories,
      datasets: chartDatasets(chartKind, { ...data, colors }),
    },
    options: {
      color: textColor,
      font: {
        family: CHART_FONT_FAMILY,
      },
      indexAxis: isHorizontalChart(chartKind) ? "y" : "x",
      layout: {
        padding: isPieLikeChart(chartKind)
          ? { top: 16, right: 20, bottom: 12, left: 20 }
          : { top: 12, right: 22, bottom: 8, left: 12 },
      },
      responsive: false,
      maintainAspectRatio: false,
      animation: false,
      normalized: true,
      plugins: {
        legend: {
          display: showLegend,
          position: "bottom",
          labels: {
            boxWidth: Math.max(8, fontSize * 0.8),
            boxHeight: Math.max(8, fontSize * 0.8),
            color: legendColor,
            font: { family: CHART_FONT_FAMILY, size: fontSize, weight: 600 },
            padding: Math.max(8, fontSize),
            usePointStyle: true,
          },
        },
        title: {
          display: Boolean(title),
          text: title.split(/\r?\n/).filter(Boolean),
          color: titleColor,
          font: {
            family: CHART_FONT_FAMILY,
            size: titleFontSize,
            weight: "700",
          },
          padding: {
            bottom: Math.max(16, titleFontSize * 0.8),
            top: 0,
          },
        },
        tooltip: { enabled: false },
        datalabels: {
          align: chartDataLabelAlign(dataLabelPosition ?? "top"),
          anchor: chartDataLabelAnchor(dataLabelPosition ?? "top"),
          clamp: true,
          clip: false,
          color: textColor,
          display: dataLabels,
          font: {
            family: CHART_FONT_FAMILY,
            size: valueFontSize,
            weight: 600,
          },
          offset: dataLabelPosition === "outside" ? 6 : 2,
          gslideOutsideColor: textColor,
          gslidePosition: dataLabelPosition ?? "top",
        },
      },
    },
  };

  if (chartKind === "donut") {
    readRecord(config.options).cutout = "58%";
  } else if (chartKind === "pie") {
    readRecord(config.options).cutout = "0%";
  } else {
    readRecord(config.options).scales = chartScales({
      axisColor,
      chartKind,
      fontSize,
      gridColor,
      xAxis,
      xAxisGrid,
      xAxisTitle,
      yAxis,
      yAxisGrid,
      yAxisTitle,
    });
  }

  return applyChartFontFamily(config, readString(readRecord(item.font).family));
}

export function chartDatasets(chartKind: ChartKind, data: NormalizedChartData): JsonRecord[] {
  if (chartKind === "pie" || chartKind === "donut") {
    const series = data.series[0];
    if (!series) return [];
    return [
      {
        label: series.name,
        data: series.values.map((value) => Math.max(0, value)),
        backgroundColor: series.values.map(
          (_, index) =>
            data.colors[index % data.colors.length] ??
            DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length]
        ),
        borderColor: "#FFFFFF",
        borderWidth: 1,
        hoverOffset: 0,
      },
    ];
  }

  if (chartKind === "polar_area") {
    const series = data.series.length ? data.series : [emptyChartSeries()];
    return series.map((seriesItem) => {
      const colors =
        data.series.length === 1
          ? categoryColors(seriesItem, data.colors)
          : seriesItem.values.map(() => seriesColor(seriesItem, data));
      return {
        label: seriesItem.name,
        data: seriesItem.values,
        backgroundColor: colors.map((color) => withAlpha(color, 0.78)),
        borderColor: colors,
        borderWidth: 1,
      };
    });
  }

  if (chartKind === "scatter" || chartKind === "bubble") {
    return data.series.map((seriesItem) => {
      const colors =
        data.series.length === 1
          ? categoryColors(seriesItem, data.colors)
          : [seriesColor(seriesItem, data)];
      return {
        label: seriesItem.name,
        data:
          chartKind === "bubble"
            ? seriesItem.points.map((point) => ({ ...point, r: point.r ?? 6 }))
            : seriesItem.points.map(({ x, y }) => ({ x, y })),
        backgroundColor: colors.map((color) => withAlpha(color, 0.78)),
        borderColor: colors,
        borderWidth: 2,
        pointRadius: chartKind === "scatter" ? 4 : undefined,
        pointHoverRadius: 4,
      };
    });
  }

  const lineLike = chartKind === "line" || chartKind === "area";

  return data.series.map((series, index) => {
    const color = seriesColor(series, data, index);
    const perCategoryColors =
      data.series.length === 1 && data.colors.length
        ? categoryColors(series, data.colors)
        : null;
    const barChart = isBarChart(chartKind);
    const stackedBarChart = isStackedChart(chartKind);
    const dataset: JsonRecord = {
      label: series.name,
      data: series.values,
      backgroundColor:
        chartKind === "area"
          ? withAlpha(color, 0.24)
          : lineLike
            ? color
            : perCategoryColors ?? color,
      borderColor: color,
      borderWidth: lineLike ? 3 : 0,
      borderRadius: barChart && stackedBarChart ? 7 : undefined,
      borderSkipped: barChart ? (stackedBarChart ? "start" : false) : undefined,
      fill: chartKind === "area",
      maxBarThickness: 62,
      gslideBarRadius:
        barChart && !stackedBarChart
          ? { horizontal: isHorizontalChart(chartKind), radius: 7 }
          : undefined,
      pointBackgroundColor: perCategoryColors ?? color,
      pointBorderColor: "#FFFFFF",
      pointBorderWidth: lineLike ? 1.5 : 0,
      pointRadius: lineLike ? 3.5 : 0,
      tension: lineLike ? 0.35 : 0,
    };

    return dataset;
  });
}

export function normalizeChartData(
  item: JsonRecord,
  chartKind: ChartKind
): NormalizedChartData {
  const points = readArray(item.data)
    .map(readRecord)
    .map((point, index) => {
      const value = chartValue(point);
      return {
        label: readString(point.label) ?? `Value ${index + 1}`,
        value,
        point: chartPoint(point, index),
        color: normalizeChartColor(readString(point.color)),
      };
    })
    .filter(
      (
        point
      ): point is {
        label: string;
        value: number;
        point: ChartPointData;
        color: string | null;
      } =>
        Boolean(point)
    );
  const series = readArray(item.series)
    .map(readRecord)
    .map((series, index) => {
      const rawValues = readArray(series.values ?? series.data);
      const values = rawValues.map(chartValue);
      return {
        name: readString(series.name) ?? `Series ${index + 1}`,
        points: rawValues.map((value, valueIndex) =>
          chartPoint(value, valueIndex)
        ),
        values,
      };
    })
    .filter((series) => series.values.length);
  if (!series.length && points.length) {
    series.push({
      name: readString(item.title) ?? "Series 1",
      points: points.map((point) => point.point),
      values: points.map((point) => point.value),
    });
  }
  if (!series.length) {
    series.push(emptyChartSeries());
  }
  if (isPieLikeChart(chartKind) && series.length > 1) {
    series.splice(1);
  }
  const maxLength = Math.min(
    24,
    Math.max(1, ...series.map((item) => item.values.length), points.length)
  );
  const categoryValues = readArray(item.categories);
  const categories = normalizeCategories(
    categoryValues.length ? categoryValues : points.map((point) => point.label),
    maxLength
  );
  const colors = readColorArray(item.colors);
  const legacySeriesColors = colors.length
    ? []
    : readColorArray(item.seriesColors ?? item.series_colors);
  const pointColors = points
    .map((point) => point.color)
    .filter((color): color is string => Boolean(color));

  return {
    categories,
    colors:
      colors.length > 0
        ? colors
        : legacySeriesColors.length > 0
          ? legacySeriesColors
          : pointColors.length > 0
            ? pointColors
            : [normalizeChartColor(readString(item.color)) ?? DEFAULT_CHART_COLORS[0]],
    series: series.map((item) => ({
      ...item,
      values: padValues(item.values, categories.length),
      points: padPoints(item.points, categories.length, item.values),
    })),
  };
}

export function normalizeCategories(values: unknown[], length: number): string[] {
  return Array.from({ length }, (_, index) => {
    const value = values[index];
    return readStringValue(value) || `Value ${index + 1}`;
  });
}

export function padValues(values: number[], length: number): number[] {
  return Array.from({ length }, (_, index) => values[index] ?? 0);
}

export function padPoints(
  points: ChartPointData[],
  length: number,
  fallbackValues: number[]
): ChartPointData[] {
  return Array.from({ length }, (_, index) => {
    const point = points[index];
    if (point) return point;
    return { x: index + 1, y: fallbackValues[index] ?? 0 };
  });
}

export function readColorArray(value: unknown): string[] {
  return readArray(value)
    .map((item) => normalizeChartColor(readString(item)))
    .filter((color): color is string => Boolean(color));
}

export function normalizeChartColor(value: string | null): string | null {
  if (!value) return null;
  return safeChartColor(value, DEFAULT_CHART_COLORS[0]);
}

export function normalizeChartKindValue(value: string | null): string {
  if (!value) return "";
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
}

export function chartKindFromValue(value: string | null): ChartKind {
  const normalized = normalizeChartKindValue(value);
  if (normalized === "bubble") return "bubble";
  if (normalized === "horizontal_bar" || normalized === "bar_horizontal") {
    return "horizontal_bar";
  }
  if (
    normalized === "horizontal_stacked_bar" ||
    normalized === "stacked_horizontal_bar"
  ) {
    return "horizontal_stacked_bar";
  }
  if (
    normalized === "stacked_bar" ||
    normalized === "bar_stacked" ||
    normalized === "stacked" ||
    normalized === "stacked_column"
  ) {
    return "stacked_bar";
  }
  if (normalized === "line") return "line";
  if (normalized === "area") return "area";
  if (normalized === "pie") return "pie";
  if (normalized === "donut" || normalized === "doughnut") return "donut";
  if (normalized === "polar" || normalized === "polar_area") return "polar_area";
  if (normalized === "radar") return "radar";
  if (normalized === "scatter") return "scatter";
  return "bar";
}

export function chartJsType(chartKind: ChartKind): string {
  if (chartKind === "donut") return "doughnut";
  if (chartKind === "area") return "line";
  if (chartKind === "polar_area") return "polarArea";
  if (
    chartKind === "horizontal_bar" ||
    chartKind === "stacked_bar" ||
    chartKind === "horizontal_stacked_bar"
  ) {
    return "bar";
  }
  return chartKind;
}

export function isPieLikeChart(chartKind: ChartKind): boolean {
  return chartKind === "pie" || chartKind === "donut";
}

export function isBarChart(chartKind: ChartKind): boolean {
  return (
    chartKind === "bar" ||
    chartKind === "horizontal_bar" ||
    chartKind === "stacked_bar" ||
    chartKind === "horizontal_stacked_bar"
  );
}

export function isHorizontalChart(chartKind: ChartKind): boolean {
  return (
    chartKind === "horizontal_bar" || chartKind === "horizontal_stacked_bar"
  );
}

export function isStackedChart(chartKind: ChartKind): boolean {
  return chartKind === "stacked_bar" || chartKind === "horizontal_stacked_bar";
}

export function chartScales({
  axisColor,
  chartKind,
  fontSize,
  gridColor,
  xAxis,
  xAxisGrid,
  xAxisTitle,
  yAxis,
  yAxisGrid,
  yAxisTitle,
}: {
  axisColor: string;
  chartKind: ChartKind;
  fontSize: number;
  gridColor: string;
  xAxis: boolean;
  xAxisGrid: boolean;
  xAxisTitle: string;
  yAxis: boolean;
  yAxisGrid: boolean;
  yAxisTitle: string;
}): JsonRecord | undefined {
  if (isPieLikeChart(chartKind) || chartKind === "polar_area") return undefined;

  if (chartKind === "radar") {
    return {
      r: {
        angleLines: {
          color: withAlpha(gridColor, xAxisGrid ? 0.35 : 0),
          display: xAxisGrid,
        },
        beginAtZero: true,
        grid: {
          color: withAlpha(gridColor, yAxisGrid ? 0.35 : 0),
          display: yAxisGrid,
        },
        pointLabels: {
          color: axisColor,
          display: xAxis,
          font: { family: CHART_FONT_FAMILY, size: fontSize, weight: 600 },
        },
        ticks: {
          backdropColor: "transparent",
          color: axisColor,
          display: yAxis,
          font: {
            family: CHART_FONT_FAMILY,
            size: Math.max(8, fontSize - 1),
          },
          gslideFormat: true,
        },
      },
    };
  }

  const horizontal = isHorizontalChart(chartKind);
  const stacked = isStackedChart(chartKind);
  const showCategoryGrid = horizontal ? xAxisGrid : yAxisGrid;
  const showLinearGrid = horizontal ? yAxisGrid : xAxisGrid;
  const showCategoryAxis = horizontal ? yAxis : xAxis;
  const showLinearAxis = horizontal ? xAxis : yAxis;
  const categoryAxis = {
    display: showCategoryAxis || showCategoryGrid,
    border: { color: axisColor, display: showCategoryAxis },
    grid: {
      color: withAlpha(gridColor, showCategoryGrid ? 0.25 : 0),
      display: showCategoryGrid,
      drawTicks: showCategoryAxis,
    },
    stacked,
    ticks: {
      color: axisColor,
      display: showCategoryAxis,
      font: { family: CHART_FONT_FAMILY, size: fontSize, weight: 600 },
      maxRotation: 0,
      autoSkip: true,
    },
    title: {
      color: axisColor,
      display: showCategoryAxis && Boolean(horizontal ? yAxisTitle : xAxisTitle),
      font: { family: CHART_FONT_FAMILY, size: fontSize, weight: 700 },
      text: horizontal ? yAxisTitle : xAxisTitle,
    },
    type: "category",
  };
  const linearAxis = {
    beginAtZero: true,
    display: showLinearAxis || showLinearGrid,
    border: { color: axisColor, display: showLinearAxis },
    grace: "8%",
    grid: {
      color: withAlpha(gridColor, showLinearGrid ? 0.35 : 0),
      display: showLinearGrid,
      drawTicks: showLinearAxis,
    },
    stacked,
    ticks: {
      color: axisColor,
      display: showLinearAxis,
      font: {
        family: CHART_FONT_FAMILY,
        size: Math.max(8, fontSize - 2),
        weight: 600,
      },
      gslideFormat: true,
    },
    title: {
      color: axisColor,
      display: showLinearAxis && Boolean(horizontal ? xAxisTitle : yAxisTitle),
      font: { family: CHART_FONT_FAMILY, size: fontSize, weight: 700 },
      text: horizontal ? xAxisTitle : yAxisTitle,
    },
    type: "linear",
  };

  if (chartKind === "scatter" || chartKind === "bubble") {
    return {
      x: {
        ...linearAxis,
        display: xAxis || yAxisGrid,
        border: { ...linearAxis.border, display: xAxis },
        grid: {
          color: withAlpha(gridColor, yAxisGrid ? 0.35 : 0),
          display: yAxisGrid,
          drawTicks: xAxis,
        },
        ticks: { ...linearAxis.ticks, display: xAxis },
        title: {
          ...linearAxis.title,
          display: xAxis && Boolean(xAxisTitle),
          text: xAxisTitle,
        },
      },
      y: {
        ...linearAxis,
        display: yAxis || xAxisGrid,
        border: { ...linearAxis.border, display: yAxis },
        grid: {
          color: withAlpha(gridColor, xAxisGrid ? 0.35 : 0),
          display: xAxisGrid,
          drawTicks: yAxis,
        },
        ticks: { ...linearAxis.ticks, display: yAxis },
        title: {
          ...linearAxis.title,
          display: yAxis && Boolean(yAxisTitle),
          text: yAxisTitle,
        },
      },
    };
  }

  return horizontal ? { x: linearAxis, y: categoryAxis } : { x: categoryAxis, y: linearAxis };
}

export function chartValue(value: unknown): number {
  const direct = readNumber(value);
  if (direct != null) return direct;

  const record = readRecord(value);
  return (
    readNumber(record.value) ??
    readNumber(record.y) ??
    readNumber(record.data) ??
    0
  );
}

export function chartPoint(value: unknown, index: number): ChartPointData {
  const record = readRecord(value);
  const radius = readNumber(record.r ?? record.radius);
  return {
    x: readNumber(record.x) ?? index + 1,
    y: chartValue(value),
    ...(radius != null ? { r: radius } : {}),
  };
}

export function emptyChartSeries(): ChartSeriesData {
  return {
    name: "Series 1",
    points: [{ x: 1, y: 0 }],
    values: [0],
  };
}

export function seriesColor(
  series: ChartSeriesData,
  data: NormalizedChartData,
  index = data.series.indexOf(series)
): string {
  return (
    data.colors[index % data.colors.length] ??
    DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length]
  );
}

export function categoryColors(series: ChartSeriesData, colors: string[]): string[] {
  return series.values.map(
    (_, index) =>
      colors[index % colors.length] ??
      DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length]
  );
}

export function safeChartColor(
  value: string | null | undefined,
  fallback = DEFAULT_CHART_COLORS[0]
): string {
  const color = withHash(value) ?? fallback;
  if (
    /^#[0-9A-Fa-f]{3}$/.test(color) ||
    /^#[0-9A-Fa-f]{6}$/.test(color) ||
    /^rgba?\(/i.test(color)
  ) {
    return color;
  }
  return fallback;
}

export function withHash(value: string | null | undefined): string | null {
  if (!value) return null;
  const color = value.trim();
  if (!color) return null;
  return color.startsWith("#") || /^rgba?\(/i.test(color) ? color : `#${color}`;
}

export function withAlpha(color: string, alpha: number): string {
  const normalized = safeChartColor(color);
  const hex = normalized.match(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/);
  if (!hex) {
    const rgb = normalized.match(/^rgba?\(([^)]+)\)$/i);
    if (rgb) {
      const channels = rgb[1]
        .split(",")
        .slice(0, 3)
        .map((part) => part.trim());
      return `rgba(${channels.join(", ")}, ${alpha})`;
    }
    return normalized;
  }

  const raw =
    hex[1].length === 3
      ? hex[1]
        .split("")
        .map((char) => char + char)
        .join("")
      : hex[1];
  const int = Number.parseInt(raw, 16);
  return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
}

export interface InfographicMetrics {
  ratio: number;
}

export function infographicKindFromValue(value: string | null): InfographicKind {
  return value === "gauge" ? "gauge" : "progress_bar";
}

export function infographicData(item: JsonRecord): JsonRecord {
  return readRecord(item.data);
}

export function infographicMetrics(item: JsonRecord): InfographicMetrics {
  const data = infographicData(item);
  const rawMin = readNumber(data.min_value) ?? 0;
  const rawMax = readNumber(data.max_value) ?? 100;
  const min = Math.min(rawMin, rawMax);
  const max = Math.max(rawMin, rawMax);
  const value = clamp(readNumber(data.value) ?? min, min, max);
  const ratio = max === min ? 0 : (value - min) / (max - min);

  return {
    ratio,
  };
}

export function infographicHighlightColor(item: JsonRecord): string {
  const colors = readArray(item.colors);
  return (
    normalizeChartColor(readString(colors[1])) ??
    DEFAULT_CHART_COLORS[0]
  );
}

export function infographicBaseColor(item: JsonRecord): string {
  const colors = readArray(item.colors);
  return (
    normalizeChartColor(readString(colors[0])) ??
    "#E5E7EB"
  );
}

export function describeGaugeArc(
  centerX: number,
  centerY: number,
  radius: number,
  ratio: number
): string {
  const start = gaugePoint(centerX, centerY, radius, 180);
  const end = gaugePoint(
    centerX,
    centerY,
    radius,
    180 + clamp(ratio, 0, 1) * 180
  );
  return `M ${cssNumber(start.x)} ${cssNumber(start.y)} A ${cssNumber(
    radius
  )} ${cssNumber(radius)} 0 0 1 ${cssNumber(end.x)} ${cssNumber(end.y)}`;
}

export function gaugePoint(
  centerX: number,
  centerY: number,
  radius: number,
  angleDegrees: number
): { x: number; y: number } {
  const radians = (angleDegrees * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(radians),
    y: centerY + radius * Math.sin(radians),
  };
}

export function readOptionalBoolean(value: unknown, fallback: boolean): boolean {
  return value == null ? fallback : readBoolean(value);
}

export function readDataLabelPosition(value: unknown): DataLabelPosition | null {
  if (value === true) return "top";
  if (value === false || value == null) return null;
  const text = readString(value);
  return text && DATA_LABEL_POSITIONS.has(text)
    ? (text as DataLabelPosition)
    : null;
}

export function chartDataLabelAnchor(position: DataLabelPosition) {
  if (position === "base") return "start";
  if (position === "mid") return "center";
  return "end";
}

export function chartDataLabelAlign(position: DataLabelPosition) {
  if (position === "base") return "end";
  if (position === "top") return "start";
  if (position === "outside") return "end";
  return "center";
}

export function hasChartItem(item: JsonRecord): boolean {
  if (isComponent(item)) {
    return readArray(item.elements).map(readRecord).some(hasChartItem);
  }

  if (readString(item.type) === "chart") return true;
  if (Array.isArray(item.children)) {
    return readArray(item.children).map(readRecord).some(hasChartItem);
  }

  if (Array.isArray(item.elements)) {
    return readArray(item.elements).map(readRecord).some(hasChartItem);
  }

  const child = readRecordOrNull(item.child);
  if (child) return hasChartItem(child);

  const itemChild = readRecordOrNull(item.item);
  return itemChild ? hasChartItem(itemChild) : false;
}

export function renderChartScripts(): string {
  return `<script src="${escapeAttribute(CHART_BROWSER_SCRIPT_URL)}"></script><script src="${escapeAttribute(
    CHART_DATALABELS_SCRIPT_URL,
  )}"></script><script>${escapeScriptText(
    chartRendererScript()
  )}</script>`;
}

export function chartRendererScript(): string {
  return `
(function(){
var state=window.__GSLIDE_JSON_CHARTS__={status:"pending"};
function finish(status,message){state.status=status;if(message)state.message=message}
function readNumber(value){var parsed=Number(value);return Number.isFinite(parsed)?parsed:null}
export function chartValue(raw){if(typeof raw==="number")return raw;if(raw&&typeof raw==="object"){var value=raw.y!=null?raw.y:raw.value!=null?raw.value:raw.data;var numeric=readNumber(value);return numeric==null?0:numeric}var parsed=readNumber(raw);return parsed==null?0:parsed}
var compactNumberSuffixes=["","K","M","B","T","Qa","Qi","Sx","Sp","Oc","No","Dc"];
function formatScaledCompactNumber(value){var abs=Math.abs(value);var decimals=abs>=100?0:abs>=10?1:2;return Number(value.toFixed(decimals)).toString()}
function formatValue(value){if(!Number.isFinite(value))return "";var abs=Math.abs(value);if(abs<1000)return abs%1===0?String(value):String(Math.round(value*10)/10).replace(/\\.0$/,"");var suffixIndex=Math.floor(Math.log10(abs)/3);if(suffixIndex>=compactNumberSuffixes.length)return value.toExponential(2).replace(/\\.?0+e/,"e");var scaled=value/Math.pow(1000,suffixIndex);var formatted=formatScaledCompactNumber(scaled);if(Math.abs(Number(formatted))>=1000&&suffixIndex<compactNumberSuffixes.length-1){suffixIndex+=1;scaled=value/Math.pow(1000,suffixIndex);formatted=formatScaledCompactNumber(scaled)}return formatted+compactNumberSuffixes[suffixIndex]}
function formatAxisTick(value){var numeric=Number(value);return Number.isFinite(numeric)?formatValue(numeric):String(value)}
function hydrateScales(scales){if(!scales)return;Object.keys(scales).forEach(function(key){var scale=scales[key];if(!scale)return;if(scale.ticks&&scale.ticks.gslideFormat){scale.ticks.callback=formatAxisTick;delete scale.ticks.gslideFormat}if(scale.r&&scale.r.ticks&&scale.r.ticks.gslideFormat){scale.r.ticks.callback=formatAxisTick;delete scale.r.ticks.gslideFormat}})}
function barBorderRadius(rawValue,horizontal,radius){var value=chartValue(rawValue);if(horizontal){return value<0?{bottomLeft:radius,bottomRight:0,topLeft:radius,topRight:0}:{bottomLeft:0,bottomRight:radius,topLeft:0,topRight:radius}}return value<0?{bottomLeft:radius,bottomRight:radius,topLeft:0,topRight:0}:{bottomLeft:0,bottomRight:0,topLeft:radius,topRight:radius}}
function hydrateBarBorderRadii(config){var datasets=config&&config.data&&Array.isArray(config.data.datasets)?config.data.datasets:[];datasets.forEach(function(dataset){var options=dataset&&dataset.gslideBarRadius;if(!options)return;var radius=readNumber(options.radius);dataset.borderRadius=function(context){return barBorderRadius(context&&context.raw,!!options.horizontal,radius==null?7:radius)};delete dataset.gslideBarRadius})}
function datasetBackgroundColor(dataset,index){var background=dataset&&dataset.backgroundColor;var color=Array.isArray(background)?background[index]:background;return typeof color==="string"?color:null}
function clamp(value,min,max){return Math.min(Math.max(value,min),max)}
function parseColor(color){if(!color)return null;var hex=String(color).match(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/);if(hex){var raw=hex[1].length===3?hex[1].split("").map(function(ch){return ch+ch}).join(""):hex[1];var value=Number.parseInt(raw,16);return[(value>>16)&255,(value>>8)&255,value&255,1]}var rgb=String(color).match(/^rgba?\\(([^)]+)\\)$/i);if(!rgb)return null;var channels=rgb[1].split(",").map(function(part){return Number(part.trim())});if(channels.length<3||channels.slice(0,3).some(Number.isNaN))return null;return[clamp(channels[0],0,255),clamp(channels[1],0,255),clamp(channels[2],0,255),clamp(Number.isFinite(channels[3])?channels[3]:1,0,1)]}
function relativeLuminance(channels){var mapped=channels.map(function(channel){var normalized=channel/255;return normalized<=0.04045?normalized/12.92:Math.pow((normalized+0.055)/1.055,2.4)});return mapped[0]*0.2126+mapped[1]*0.7152+mapped[2]*0.0722}
function contrastRatio(first,second){var lighter=Math.max(first,second);var darker=Math.min(first,second);return(lighter+0.05)/(darker+0.05)}
function contrastTextColor(backgroundColor,fallback){var background=parseColor(backgroundColor);if(!background)return fallback;var composite=[background[0],background[1],background[2]].map(function(channel){return channel*background[3]+255*(1-background[3])});var luminance=relativeLuminance(composite);var dark=[16,24,40];var light=[255,255,255];return contrastRatio(luminance,relativeLuminance(light))>=contrastRatio(luminance,relativeLuminance(dark))?"#FFFFFF":"#101828"}
function hydrateDataLabels(config){var plugins=config&&config.options&&config.options.plugins;var options=plugins&&plugins.datalabels;if(!options)return;var position=options.gslidePosition==="base"||options.gslidePosition==="mid"||options.gslidePosition==="outside"||options.gslidePosition==="top"?options.gslidePosition:"top";var outsideColor=options.gslideOutsideColor||options.color||"#475467";options.formatter=function(value){return formatValue(chartValue(value))};options.color=function(context){if(position==="outside")return outsideColor;var meta=context.chart.getDatasetMeta(context.datasetIndex);var type=String(meta&&meta.type||"");if(type!=="bar"&&type!=="pie"&&type!=="doughnut"&&type!=="polarArea")return outsideColor;return contrastTextColor(datasetBackgroundColor(context.dataset,context.dataIndex),outsideColor)};delete options.gslideOutsideColor;delete options.gslidePosition}
function render(){if(!window.Chart){finish("error","Chart.js failed to load");return}if(!window.ChartDataLabels){finish("error","Chart.js datalabels plugin failed to load");return}try{var Chart=window.Chart;Chart.register(window.ChartDataLabels);document.querySelectorAll("canvas[data-gslide-chart]").forEach(function(canvas){var configText=canvas.getAttribute("data-chart-config");if(!configText)return;var config=JSON.parse(configText);config.options=config.options||{};config.options.animation=false;config.options.responsive=false;config.options.maintainAspectRatio=false;hydrateScales(config.options.scales);hydrateBarBorderRadii(config);hydrateDataLabels(config);var existing=typeof Chart.getChart==="function"?Chart.getChart(canvas):null;if(existing)existing.destroy();var chart=new Chart(canvas,config);if(typeof chart.update==="function")chart.update("none")});requestAnimationFrame(function(){finish("ready")})}catch(error){finish("error",error&&error.message?error.message:String(error))}}
if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",render,{once:true})}else{render()}
})();
`;
}
