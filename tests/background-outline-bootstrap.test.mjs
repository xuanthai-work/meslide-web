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

test("cancel returns to upload and discards outlines", async () => {
  const source = await read(
    "app/(presentation-generator)/presentation/hooks/useAutomaticPresentationGeneration.ts",
  );
  const cancelBlock = source.slice(source.indexOf("const cancel = useCallback"));
  assert.match(cancelBlock, /await outlineStream\.cancel\(\)/);
  assert.match(cancelBlock, /clearOutlines/);
  assert.match(cancelBlock, /router\.replace\("\/upload"\)/);
  assert.doesNotMatch(cancelBlock, /\/outline/);
});

test("successful preparation starts slide streaming", async () => {
  const source = await read(
    "app/(presentation-generator)/presentation/hooks/useAutomaticPresentationGeneration.ts",
  );
  assert.match(source, /`\/presentation\?id=\$\{presentationId\}&stream=true`/);
});

test("stale presentationPrepare cannot navigate or clear a newer in-flight guard", async () => {
  const source = await read(
    "app/(presentation-generator)/presentation/hooks/useAutomaticPresentationGeneration.ts",
  );
  assert.match(source, /const prepareGenerationRef = useRef\(0\)/);

  const hydration = source.slice(
    source.indexOf("useEffect(() => {"),
    source.indexOf("const outlineReady"),
  );
  assert.match(hydration, /prepareGenerationRef\.current \+= 1/);
  const hydrationCleanup = hydration.slice(hydration.indexOf("return () => {"));
  assert.match(hydrationCleanup, /prepareGenerationRef\.current \+= 1/);

  const prepareBlock = source.slice(
    source.indexOf("const prepareGeneration = prepareGenerationRef.current"),
    source.indexOf("const retry = useCallback"),
  );
  assert.match(prepareBlock, /const prepareGeneration = prepareGenerationRef\.current/);
  const thenBlock = prepareBlock.slice(
    prepareBlock.indexOf(".then("),
    prepareBlock.indexOf(".catch("),
  );
  const catchBlock = prepareBlock.slice(
    prepareBlock.indexOf(".catch("),
    prepareBlock.indexOf(".finally("),
  );
  const finallyBlock = prepareBlock.slice(prepareBlock.indexOf(".finally("));
  const staleGuard = /if \(prepareGeneration !== prepareGenerationRef\.current\) return;/;

  assert.match(thenBlock, staleGuard);
  assert.ok(
    thenBlock.search(staleGuard) < thenBlock.indexOf("preparedRef.current = true"),
  );
  assert.ok(thenBlock.search(staleGuard) < thenBlock.indexOf("stream=true"));

  assert.match(catchBlock, staleGuard);
  assert.ok(catchBlock.search(staleGuard) < catchBlock.indexOf('setPhase("failed")'));

  assert.match(finallyBlock, staleGuard);
  assert.ok(
    finallyBlock.search(staleGuard) <
      finallyBlock.indexOf("prepareInFlightRef.current = false"),
  );

  const cancelBlock = source.slice(source.indexOf("const cancel = useCallback"));
  const invalidateAt = cancelBlock.indexOf("prepareGenerationRef.current += 1");
  assert.ok(invalidateAt !== -1);
  assert.ok(invalidateAt < cancelBlock.indexOf("await outlineStream.cancel()"));
});
