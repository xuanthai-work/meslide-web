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

const MARKDOWN_TEXT = "../components/slide-editor/text/markdown-text.ts";

test("HTML list tags are sanitized into bullet text runs", async () => {
  const { renderMarkdownTextRuns, sanitizeMarkdownRawText } = await import(MARKDOWN_TEXT);

  const raw = "<ul><li>Triệu chứng: Khát nước</li><li>Nguyên nhân: Kháng insulin</li><ul>";
  const sanitized = sanitizeMarkdownRawText(raw);

  assert.equal(
    sanitized,
    "• Triệu chứng: Khát nước\n• Nguyên nhân: Kháng insulin",
  );
  assert.doesNotMatch(sanitized, /<[a-zA-Z/]/);

  const runs = renderMarkdownTextRuns([{ text: raw }]);
  const content = runs.map((run) => run.text ?? "").join("");
  assert.match(content, /• Triệu chứng: Khát nước/);
  assert.doesNotMatch(content, /<[a-zA-Z/]/);
});

test("HTML is stripped while markdown emphasis survives", async () => {
  const { renderMarkdownTextRuns, sanitizeMarkdownRawText } = await import(MARKDOWN_TEXT);

  const raw = "<p>**bold** and *italic*</p><ul><li>item</li></ul>";
  const sanitized = sanitizeMarkdownRawText(raw);
  assert.doesNotMatch(sanitized, /<[a-zA-Z/]/);

  const runs = renderMarkdownTextRuns([{ text: raw }]);
  const content = runs.map((run) => run.text ?? "").join("");
  assert.equal(content, "bold and italic\n• item");
  assert.ok(runs.some((run) => run.font?.bold === true), "bold run is missing");
  assert.ok(runs.some((run) => run.font?.italic === true), "italic run is missing");
});

test("plain text and LaTeX tags are left untouched", async () => {
  const { sanitizeMarkdownRawText } = await import(MARKDOWN_TEXT);

  assert.equal(sanitizeMarkdownRawText("Hello world"), "Hello world");
  assert.equal(sanitizeMarkdownRawText("  spaced  "), "  spaced  ");

  const latex = String.raw`Area is <latex>\pi r^2</latex>.`;
  assert.equal(sanitizeMarkdownRawText(latex), latex);
});
