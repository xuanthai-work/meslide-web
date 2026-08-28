import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("community smart HTML is sanitized before iframe creation", async () => {
  const source = await readFile(
    path.join(
      root,
      "app/(presentation-generator)/components/SmartHtmlSlide.tsx",
    ),
    "utf8",
  );

  assert.match(source, /createDOMPurify\(window\)/);
  assert.match(source, /purifier\.sanitize\(html, SANITIZE_CONFIG\)/);
  assert.match(source, /if \(sanitizedHtml === null\)/);
  assert.match(source, /html=\{sanitizedHtml\}/);
  assert.doesNotMatch(source, /html=\{html\}[\s\S]*IframeSmartHtmlSlide/);
});

test("community callers explicitly disable content scripts", async () => {
  for (const relativePath of [
    "app/(presentation-generator)/(dashboard)/community/components/CommunityPage.tsx",
    "app/(presentation-generator)/(dashboard)/community/components/CommunityDesignPreviewDialog.tsx",
    "app/(presentation-generator)/upload/components/CommunityReferencePicker.tsx",
  ]) {
    const source = await readFile(path.join(root, relativePath), "utf8");
    assert.match(source, /<SmartHtmlSlide[\s\S]*?executeScripts=\{false\}/);
  }
});
