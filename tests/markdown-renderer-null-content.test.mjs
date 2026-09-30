import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("markdown renderer never passes nullish content to marked", async () => {
  const source = await readFile(
    new URL("../components/MarkDownRender.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /content\?: string \| null/);
  assert.match(
    source,
    /const safeContent = typeof content === "string" \? content : ""/
  );
  assert.match(source, /marked\.parse\(safeContent\)/);
  assert.match(source, /sanitizeMarkdownHtml\(String\(parsed\)\)/);
});

test("dashboard cards provide a fallback title", async () => {
  const source = await readFile(
    new URL(
      "../app/(presentation-generator)/(dashboard)/dashboard/components/PresentationGrid.tsx",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(
    source,
    /presentation\.title \?\? "Bài thuyết trình không tiêu đề"/
  );
});
