import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import typescript from "typescript";

const root = path.resolve(import.meta.dirname, "..");
registerHooks({
  resolve(specifier, context, nextResolve) {
    const findModule = (base) => {
      for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`]) {
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
      return findModule(path.join(root, specifier.slice(2))) ?? nextResolve(specifier, context);
    }
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL && !/\.[cm]?[jt]sx?$/.test(specifier)) {
      return findModule(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier)) ?? nextResolve(specifier, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);
    if (!url.endsWith(".ts")) return loaded;
    return {
      format: "module",
      shortCircuit: true,
      source: typescript.transpileModule(String(loaded.source), {
        compilerOptions: { module: typescript.ModuleKind.ESNext, target: typescript.ScriptTarget.ES2022 },
      }).outputText,
    };
  },
});

test("generated chart HTML uses its slide font for all labels", async () => {
  const { chartConfig } = await import("../lib/template-v2-html-chart.ts");
  const config = chartConfig({
    chart_type: "bar",
    font: { family: "Be Vietnam Pro" },
    categories: ["A", "B"],
    series: [{ name: "Sales", values: [1, 2] }],
  }, 300);

  const configJson = JSON.stringify(config);
  assert.match(configJson, /Be Vietnam Pro/);
  assert.doesNotMatch(configJson, /Inter, Arial, sans-serif/);
});

test("slide HTML keeps tall title glyphs visible outside their line box", async () => {
  const { templateV2UiToHtmlFragment } = await import("../lib/template-v2-json-to-html.ts");
  const html = templateV2UiToHtmlFragment({
    elements: [{
      type: "text",
      position: { x: 0, y: 0 },
      size: { width: 1050, height: 104 },
      font: { family: "Lato Heavy", size: 121.6, line_height: 0.9 },
      runs: [{ text: "Hành Động Ngay" }],
    }],
  });

  assert.ok(html?.includes("overflow:visible;white-space:pre-wrap;"));
});
