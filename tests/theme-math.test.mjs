import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import typescript from "typescript";

import {
  measureMathLatex,
  normalizeMathLatex,
} from "../lib/math.ts";

const expectedCacheCapacity = 256;
const root = path.resolve(import.meta.dirname, "..");
registerHooks({
  resolve(specifier, context, nextResolve) {
    const findModule = (base) => {
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

test("theme client preserves request methods, paths, bodies and font form data", async () => {
  const { default: ThemeApi } = await import("../app/(presentation-generator)/services/api/theme.ts");
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ path: new URL(url, "http://web.local").pathname, ...options });
    return Response.json({ ok: true });
  };
  try {
    await ThemeApi.getThemes();
    await ThemeApi.createTheme({ id: "theme-1", name: "Example" });
    await ThemeApi.updateTheme({ id: "theme-1", name: "Example" });
    await ThemeApi.deleteTheme("theme-1");
    await ThemeApi.generateTheme({});
    await ThemeApi.generateTheme({ primary: "#112233" });
    await ThemeApi.getUserFonts();
    await ThemeApi.uploadFont(new File(["font"], "sample.ttf"));
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(requests.map(({ method, path }) => [method, path]), [
    ["GET", "/api/v1/ppt/themes/all"],
    ["POST", "/api/v1/ppt/themes/create"],
    ["PATCH", "/api/v1/ppt/themes/update/theme-1"],
    ["DELETE", "/api/v1/ppt/themes/delete/theme-1"],
    ["POST", "/api/v1/ppt/theme/generate"],
    ["POST", "/api/v1/ppt/theme/generate"],
    ["GET", "/api/v1/ppt/fonts/uploaded"],
    ["POST", "/api/v1/ppt/fonts/upload"],
  ]);
  assert.deepEqual(JSON.parse(requests[1].body), { id: "theme-1", name: "Example" });
  assert.deepEqual(JSON.parse(requests[2].body), { id: "theme-1", name: "Example" });
  assert.equal(requests[4].body, "{}");
  assert.deepEqual(JSON.parse(requests[5].body), { primary: "#112233" });
  assert.equal(requests[7].body.get("font_file").name, "sample.ttf");
  assert.equal(requests[7].headers["Content-Type"], undefined);
});

test("formula measurements stay stable after the cache evicts old entries", () => {
  assert.equal(normalizeMathLatex("$$ x $$"), "x");
  const previousDocument = globalThis.document;
  let measurements = 0;
  globalThis.document = {
    body: { appendChild() {} },
    createElement() {
      measurements += 1;
      return {
        style: {},
        querySelector() { return null; },
        getBoundingClientRect() { return { width: 42, height: 19 }; },
        remove() {},
      };
    },
  };
  try {
    const first = measureMathLatex("cache-test-first", 16, false);
    assert.deepEqual(first, { width: 42, height: 19 });
    assert.deepEqual(measureMathLatex("cache-test-first", 16, false), first);
    assert.equal(measurements, 1);

    for (let index = 0; index < expectedCacheCapacity; index += 1) {
      measureMathLatex(`cache-test-${index}`, 16, false);
    }
    assert.deepEqual(measureMathLatex("cache-test-first", 16, false), first);
    assert.equal(measurements, expectedCacheCapacity + 2);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});
