import assert from "node:assert/strict";
import test from "node:test";

import {
  boxesIntersect,
  componentIndexesInMarquee,
  isBackgroundComponent,
  isComponentLocked,
} from "../components/slide-editor/model/template-v2-lock.ts";

test("isBackgroundComponent detects backdrop/decor components", () => {
  assert.equal(isBackgroundComponent({ id: "background_canvas" }), true);
  assert.equal(isBackgroundComponent({ id: "soft_background_accent" }), true);
  assert.equal(isBackgroundComponent({ name: "decor_frame" }), true);
  assert.equal(isBackgroundComponent({ description: "Full-canvas backdrop" }), true);
  assert.equal(isBackgroundComponent({ id: "slide_bg" }), true);
  assert.equal(isBackgroundComponent({ is_background: true }), true);
  assert.equal(isBackgroundComponent({ role: "background" }), true);

  assert.equal(isBackgroundComponent({ id: "card_grid" }), false);
  assert.equal(isBackgroundComponent({ name: "metric_card" }), false);
  assert.equal(isBackgroundComponent(null), false);
  assert.equal(isBackgroundComponent(undefined), false);
});

test("isComponentLocked locks backgrounds by default and honors explicit flags", () => {
  assert.equal(isComponentLocked({ id: "background_canvas" }), true);
  assert.equal(
    isComponentLocked({ id: "background_canvas", locked: false }),
    false,
  );
  assert.equal(isComponentLocked({ id: "card", locked: true }), true);
  assert.equal(isComponentLocked({ id: "card" }), false);
  assert.equal(isComponentLocked(null), false);
});

test("boxesIntersect detects axis-aligned overlaps", () => {
  const a = { x: 0, y: 0, width: 100, height: 100 };
  assert.equal(boxesIntersect(a, { x: 50, y: 50, width: 100, height: 100 }), true);
  assert.equal(boxesIntersect(a, { x: -20, y: 20, width: 30, height: 10 }), true);
  // Touching edges do not count as an intersection.
  assert.equal(boxesIntersect(a, { x: 100, y: 0, width: 10, height: 10 }), false);
  assert.equal(boxesIntersect(a, { x: 0, y: 200, width: 100, height: 100 }), false);
});

function boxOf(component) {
  return {
    x: component.position.x,
    y: component.position.y,
    width: component.size.width,
    height: component.size.height,
  };
}

test("marquee selects intersecting cards and skips the locked background", () => {
  const components = [
    {
      id: "background_canvas",
      position: { x: 0, y: 0 },
      size: { width: 1280, height: 720 },
    },
    { id: "card_1", position: { x: 100, y: 100 }, size: { width: 120, height: 80 } },
    { id: "card_2", position: { x: 260, y: 100 }, size: { width: 120, height: 80 } },
    { id: "card_3", position: { x: 800, y: 500 }, size: { width: 120, height: 80 } },
  ];

  const marquee = { x: 50, y: 50, width: 400, height: 200 };
  const selected = componentIndexesInMarquee(components, marquee, boxOf);

  assert.deepEqual(selected, [1, 2]);
  assert.equal(selected.includes(0), false);
  assert.equal(selected.includes(3), false);
});

test("an explicitly unlocked background can be marquee-selected", () => {
  const components = [
    {
      id: "background_canvas",
      locked: false,
      position: { x: 0, y: 0 },
      size: { width: 1280, height: 720 },
    },
    { id: "card_1", position: { x: 100, y: 100 }, size: { width: 120, height: 80 } },
  ];

  assert.deepEqual(
    componentIndexesInMarquee(components, { x: 50, y: 50, width: 200, height: 200 }, boxOf),
    [0, 1],
  );
});
