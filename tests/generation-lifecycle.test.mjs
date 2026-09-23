import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  STALL_MS,
  isUsefulStreamEvent,
  shouldSilentRetry,
  needsCancelConfirm,
  isStalled,
  silentRetryDelayMs,
  shouldShowKeepWaiting,
} from "../lib/generation-lifecycle.ts";

const backgroundOutlineSource = () => readFile(
  new URL(
    "../app/(presentation-generator)/presentation/hooks/useBackgroundOutlineStream.ts",
    import.meta.url,
  ),
  "utf8",
);

test("heartbeat is not a useful event", () => {
  assert.equal(isUsefulStreamEvent("heartbeat"), false);
  assert.equal(isUsefulStreamEvent("status"), true);
  assert.equal(isUsefulStreamEvent("chunk"), true);
  assert.equal(isUsefulStreamEvent("slide_html"), false);
  assert.equal(isUsefulStreamEvent("complete"), true);
  assert.equal(isUsefulStreamEvent("error"), true);
});

test("silent retry only before first useful event", () => {
  assert.equal(shouldSilentRetry({ retryCount: 0, hasUsefulEvent: false, closed: false }), true);
  assert.equal(shouldSilentRetry({ retryCount: 3, hasUsefulEvent: false, closed: false }), false);
  assert.equal(shouldSilentRetry({ retryCount: 0, hasUsefulEvent: true, closed: false }), false);
  assert.equal(shouldSilentRetry({ retryCount: 0, hasUsefulEvent: false, closed: true }), false);
  assert.equal(silentRetryDelayMs(1), 1000);
  assert.equal(silentRetryDelayMs(3), 3000);
});

test("cancel confirm only when a draft exists", () => {
  assert.equal(needsCancelConfirm(0), false);
  assert.equal(needsCancelConfirm(2), true);
});

test("stalls after 45s without useful events while generating", () => {
  assert.equal(STALL_MS, 45_000);
  assert.equal(isStalled({ now: 50_000, lastUsefulEventAt: 0, state: "generating" }), true);
  assert.equal(isStalled({ now: 40_000, lastUsefulEventAt: 0, state: "generating" }), false);
  assert.equal(isStalled({ now: 80_000, lastUsefulEventAt: 0, state: "connecting" }), true);
  assert.equal(isStalled({ now: 80_000, lastUsefulEventAt: 0, state: "complete" }), false);
});

test("Keep waiting only for silence stalls, not dead sockets", () => {
  assert.equal(shouldShowKeepWaiting("silence"), true);
  assert.equal(shouldShowKeepWaiting("socket"), false);
  assert.equal(shouldShowKeepWaiting(null), false);
});

test("outline stream hook imports lifecycle helpers", async () => {
  const source = await backgroundOutlineSource();
  assert.match(source, /from "@\/lib\/generation-lifecycle"/);
  assert.match(source, /shouldSilentRetry/);
  assert.match(source, /isUsefulStreamEvent/);
  assert.match(source, /heartbeat/);
});

test("presentation stream hook imports lifecycle helpers", async () => {
  const source = await readFile(
    new URL(
      "../app/(presentation-generator)/presentation/hooks/usePresentationStreaming.ts",
      import.meta.url
    ),
    "utf8"
  );
  assert.match(source, /from "@\/lib\/generation-lifecycle"/);
  assert.match(source, /shouldSilentRetry/);
  assert.match(source, /isUsefulStreamEvent/);
  assert.match(source, /heartbeat/);
});

test("presentation cancel persists via updatePresentationContent", async () => {
  const source = await readFile(
    new URL(
      "../app/(presentation-generator)/presentation/hooks/usePresentationStreaming.ts",
      import.meta.url
    ),
    "utf8"
  );
  assert.match(source, /updatePresentationContent/);
});

test("presentation retry re-locks the editor via setStreaming(true)", async () => {
  const source = await readFile(
    new URL(
      "../app/(presentation-generator)/presentation/hooks/usePresentationStreaming.ts",
      import.meta.url
    ),
    "utf8"
  );
  const retryFn = source.slice(source.indexOf("const retry = useCallback"));
  assert.match(retryFn, /setStreaming\(true\)/);
  assert.match(retryFn, /setError\(false\)/);
});

test("presentation retry keeps already-rendered slides while the saved prefix is replayed", async () => {
  const source = await readFile(
    new URL(
      "../app/(presentation-generator)/presentation/hooks/usePresentationStreaming.ts",
      import.meta.url
    ),
    "utf8"
  );
  const chunkBlock = source.slice(
    source.indexOf('case "chunk"'),
    source.indexOf('case "slide_assets"')
  );
  const partialReplayBlock = chunkBlock.slice(
    chunkBlock.indexOf("normalizedPartialData.slides")
  );

  assert.match(partialReplayBlock, /normalizedPartialData\.slides\.reduce\(/);
  assert.match(partialReplayBlock, /mergeSingleSlidePreservingResolvedAssets\(/);
  assert.doesNotMatch(
    partialReplayBlock,
    /mergeSlidesPreservingResolvedAssets\(\s*prev\?\.slides,\s*normalizedPartialData\.slides/
  );
});

test("stream hooks hide Keep waiting after socket death", async () => {
  const outline = await backgroundOutlineSource();
  const presentation = await readFile(
    new URL(
      "../app/(presentation-generator)/presentation/hooks/usePresentationStreaming.ts",
      import.meta.url
    ),
    "utf8"
  );
  for (const source of [outline, presentation]) {
    assert.match(source, /shouldShowKeepWaiting/);
    assert.match(source, /stallCauseRef\.current = "socket"/);
    assert.match(source, /if \(!eventSourceRef\.current\) \{\s*return;/);
  }
});

test("background outline chunks report progress without exposing partial outlines", async () => {
  const source = await backgroundOutlineSource();
  const chunkBlock = source.slice(
    source.indexOf('case "chunk"'),
    source.indexOf('case "heartbeat"'),
  );
  assert.match(chunkBlock, /lastUsefulEventAtRef\.current = Date\.now\(\)/);
  assert.match(chunkBlock, /setLifecycle\("generating"\)/);
  assert.doesNotMatch(chunkBlock, /jsonrepair|JSON\.parse|setOutlines/);
});

test("background outline completion is the only event that stores outlines", async () => {
  const source = await backgroundOutlineSource();
  const completeBlock = source.slice(
    source.indexOf('case "complete"'),
    source.indexOf('case "closing"'),
  );
  assert.match(completeBlock, /data\.presentation\.outlines\.slides/);
  assert.match(completeBlock, /validateAndLimitOutlines/);
  assert.match(completeBlock, /dispatch\(setOutlines/);
  assert.match(completeBlock, /outlinesData\.length === 0/);
});

test("background outline cancellation discards partial state", async () => {
  const source = await backgroundOutlineSource();
  const cancelBlock = source.slice(source.indexOf("const cancel = useCallback"));
  assert.match(cancelBlock, /dispatch\(clearOutlines\(\)\)/);
  assert.doesNotMatch(cancelBlock, /updateOutlines/);
});
