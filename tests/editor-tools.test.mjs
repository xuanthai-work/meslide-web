import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");

registerHooks({
  resolve(specifier, context, nextResolve) {
    const tryCandidates = (base) => {
      for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, `${base}/index.ts`]) {
        if (!existsSync(candidate)) continue;
        return {
          url: pathToFileURL(candidate).href,
          shortCircuit: true,
          format: candidate.endsWith(".mjs") ? "module" : "module-typescript",
        };
      }
      return null;
    };
    if (specifier.startsWith("@/")) {
      return tryCandidates(path.join(root, specifier.slice(2))) ?? nextResolve(specifier, context);
    }
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL &&
      !/\.[cm]?[jt]sx?$/.test(specifier)
    ) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      return tryCandidates(path.resolve(parentDir, specifier)) ?? nextResolve(specifier, context);
    }
    return nextResolve(specifier, context);
  },
});

function chart() {
  return {
    chart_type: "bar",
    color: "111111",
    colors: ["111111"],
    categories: ["North", "South"],
    series: [{ name: "Sales", values: [10, 20] }],
    data: [
      { label: "North", value: 10, color: "111111" },
      { label: "South", value: 20, color: "111111" },
    ],
  };
}

test("chart edits keep series values and stop at twelve colors", async () => {
  const chartData = await import("../components/slide-editor/charts/chart-data.ts");
  const source = chart();
  assert.equal(chartData.updateChartColorTarget(source, -1, "ABCDEF"), source);
  assert.equal(chartData.normalizeChartColor("#abc"), "AABBCC");
  assert.equal(chartData.rawChartType("doughnut"), "donut");
  assert.equal(chartData.markdownToPlainChartText("**Bold** [docs](https://example.com)"), "Bold docs");
  assert.equal(chartData.limitChartText("x".repeat(200)).length, 128);
  assert.equal(chartData.ellipsizeChartText("x".repeat(30), 10), "xxxxxxx...");

  const recolored = chartData.updateChartColorTarget(source, 0, "#00ff00");
  assert.equal(recolored.color, "00FF00");
  assert.deepEqual(recolored.series, source.series);
  assert.deepEqual(recolored.data.map((datum) => datum.value), [10, 20]);

  const added = chartData.appendChartColorTarget(source);
  assert.equal(added.colors.length, 2);
  const full = { ...source, colors: Array.from({ length: 12 }, () => "111111") };
  assert.equal(chartData.appendChartColorTarget(full), full);

  assert.equal(chartData.chartDataToCsv(source), ",Sales\nNorth,10\nSouth,20");
});

test("table cells read plain text and markdown markers", async () => {
  const { rawTableCellText } = await import("../components/slide-editor/text/template-v2-text.ts");
  assert.equal(rawTableCellText("**Hello**"), "Hello");
  assert.equal(rawTableCellText(12), "12");
  assert.equal(rawTableCellText({ text: "Cell" }), "Cell");
  assert.equal(rawTableCellText(null), "");
});
