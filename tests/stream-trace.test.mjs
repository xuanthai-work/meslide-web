import assert from "node:assert/strict";
import test from "node:test";

import {
  createStreamTraceState,
  replayStreamTrace,
} from "../lib/generation-lifecycle.ts";
import { mergeSingleSlidePreservingResolvedAssets } from "../app/(presentation-generator)/presentation/utils/streamAssetMerge.ts";

function assertSingleSocket(state) {
  assert.equal(state.socketOpen && state.retryTimer, false);
  if (!state.socketOpen) assert.equal(state.stallTimer, false);
}

test("a presentation trace keeps one socket and ignores events after complete", () => {
  const state = replayStreamTrace([
    { type: "status", at: 1_000 },
    { type: "heartbeat", at: 2_000 },
    { type: "chunk", at: 3_000 },
    { type: "slide_assets", at: 4_000 },
    { type: "complete", at: 5_000 },
    { type: "chunk", at: 6_000 },
    { type: "disconnect", at: 7_000 },
  ]);

  assert.deepEqual(state.applied, ["status", "heartbeat", "chunk", "slide_assets", "complete"]);
  assert.equal(state.state, "complete");
  assert.equal(state.closed, true);
  assert.equal(state.lastUsefulEventAt, 5_000);
  assert.equal(state.hasUsefulEvent, true);
  assertSingleSocket(state);
});

test("heartbeat does not reset the stall clock and a dead socket does not reconnect", () => {
  const state = replayStreamTrace([
    { type: "chunk", at: 1_000 },
    { type: "heartbeat", at: 50_000 },
    { type: "disconnect", at: 51_000 },
    { type: "reconnect", at: 52_000 },
  ]);

  assert.equal(state.lastUsefulEventAt, 1_000);
  assert.equal(state.state, "stalled");
  assert.equal(state.retryCount, 0);
  assert.equal(state.socketOpen, false);
  assert.deepEqual(state.applied, ["chunk", "heartbeat", "disconnect-stall"]);
  assertSingleSocket(state);
});

test("silent reconnect happens only before the first useful event", () => {
  const retried = replayStreamTrace([
    { type: "disconnect", at: 100 },
    { type: "reconnect", at: 1_100 },
    { type: "status", at: 1_200 },
  ]);
  assert.equal(retried.retryCount, 1);
  assert.equal(retried.socketOpen, true);
  assert.equal(retried.retryTimer, false);
  assert.equal(retried.stallTimer, true);
  assert.equal(retried.state, "generating");
  assertSingleSocket(retried);

  const exhausted = replayStreamTrace([
    { type: "disconnect", at: 1 },
    { type: "reconnect", at: 2 },
    { type: "disconnect", at: 3 },
    { type: "reconnect", at: 4 },
    { type: "disconnect", at: 5 },
    { type: "reconnect", at: 6 },
    { type: "disconnect", at: 7 },
  ]);
  assert.equal(exhausted.retryCount, 3);
  assert.equal(exhausted.state, "failed");
  assert.equal(exhausted.socketOpen, false);
  assertSingleSocket(exhausted);
});

test("an error does not retry and unmount closes the only socket", () => {
  const failed = replayStreamTrace([
    { type: "status", at: 1 },
    { type: "error", at: 2 },
    { type: "reconnect", at: 3 },
  ]);
  assert.equal(failed.state, "failed");
  assert.equal(failed.retryCount, 0);
  assert.equal(failed.socketOpen, false);

  const unmounted = replayStreamTrace([
    { type: "chunk", at: 1 },
    { type: "unmount", at: 2 },
    { type: "disconnect", at: 3 },
    { type: "chunk", at: 4 },
  ]);
  assert.equal(unmounted.closed, true);
  assert.equal(unmounted.socketOpen, false);
  assert.equal(unmounted.retryTimer, false);
  assert.equal(unmounted.stallTimer, false);
  assert.deepEqual(unmounted.applied, ["chunk", "unmount"]);
  assert.equal(createStreamTraceState().stallTimer, true);
});

test("a later chunk cannot put a placeholder back over a resolved asset", () => {
  let slides = [];
  const resolved = {
    index: 0,
    image: "https://cdn.example/photo.png",
    ui: { src: "https://cdn.example/photo.png" },
  };
  const placeholder = {
    index: 0,
    image: "/static/images/placeholder.jpg",
    ui: { src: "/static/icons/placeholder.svg" },
    title: "After",
  };

  slides = mergeSingleSlidePreservingResolvedAssets(slides, {
    index: 0,
    image: "/static/images/placeholder.jpg",
    ui: { src: "/static/images/placeholder.jpg" },
    title: "Before",
  });
  slides = mergeSingleSlidePreservingResolvedAssets(slides, resolved);
  slides = mergeSingleSlidePreservingResolvedAssets(slides, placeholder);

  assert.equal(slides.length, 1);
  assert.equal(slides[0].image, "https://cdn.example/photo.png");
  assert.equal(slides[0].ui.src, "https://cdn.example/photo.png");
  assert.equal(slides[0].title, "After");

  const outOfOrder = replayStreamTrace([
    { type: "slide_assets", at: 1 },
    { type: "complete", at: 2 },
    { type: "chunk", at: 3 },
  ]);
  assert.deepEqual(outOfOrder.applied, ["slide_assets", "complete"]);
});
