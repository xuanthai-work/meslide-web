import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("background bootstrap hydrates, streams, and prepares exactly once", async () => {
  const source = await read(
    "app/(presentation-generator)/presentation/hooks/useAutomaticPresentationGeneration.ts",
  );
  assert.match(source, /PresentationGenerationApi\.getOutlines/);
  assert.match(source, /useBackgroundOutlineStream/);
  assert.match(source, /outlines\.length === 0/);
  assert.match(source, /prepareInFlightRef\.current/);
  assert.match(source, /preparedRef\.current/);
  assert.match(source, /PresentationGenerationApi\.presentationPrepare/);
  assert.match(source, /layout:\s*templateId/);
});

test("cancel returns to the presentation picker and discards outlines", async () => {
  const source = await read(
    "app/(presentation-generator)/presentation/hooks/useAutomaticPresentationGeneration.ts",
  );
  const cancelBlock = source.slice(source.indexOf("const cancel = useCallback"));
  assert.match(cancelBlock, /await outlineStream\.cancel\(\)/);
  assert.match(cancelBlock, /clearOutlines/);
  assert.match(cancelBlock, /`\/presentation\?id=\$\{presentationId\}&auto=1`/);
  assert.doesNotMatch(cancelBlock, /\/outline/);
});

test("successful preparation starts slide streaming", async () => {
  const source = await read(
    "app/(presentation-generator)/presentation/hooks/useAutomaticPresentationGeneration.ts",
  );
  assert.match(source, /`\/presentation\?id=\$\{presentationId\}&stream=true`/);
});
