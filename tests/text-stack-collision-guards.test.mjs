import assert from "node:assert/strict";
import test from "node:test";

import {
  fitTextToBox,
  hasShortSingleLineText,
} from "../components/slide-editor/text/template-v2-text-fit.mjs";
import {
  MIN_STACK_GAP,
  autoUngroupTextComponents,
} from "../components/slide-editor/model/template-v2-ungroup.ts";

test("short display text prefers a single line even in a tall box", () => {
  const runs = [{ text: "AB CD", font: { size: 48, lineHeight: 1.15 } }];
  const box = { width: 120, height: 200 };

  // Two lines would fit inside the box, but the copy is short and large so the
  // engine should keep it on one line (like the HTML thumbnail).
  const fitted = fitTextToBox(runs, box);
  assert.equal(fitted.lines.length, 1);
  assert.ok(fitted.fontScale >= 0.8, `scale ${fitted.fontScale} must stay legible`);
  assert.equal(fitted.ellipsis, false);
});

test("hasShortSingleLineText only matches short, large, unbroken copy", () => {
  const large = (text) => [{ text, font: { size: 48, lineHeight: 1.15 } }];
  assert.equal(hasShortSingleLineText(large("Vị Thế 2026"), 48), true);
  assert.equal(hasShortSingleLineText(large("MOMENTUM"), 48), true);
  assert.equal(
    hasShortSingleLineText(
      large("a long descriptive sentence that certainly needs two lines"),
      48,
    ),
    false,
  );
  assert.equal(hasShortSingleLineText(large("AB\nCD"), 48), false);
  assert.equal(hasShortSingleLineText(large("AB CD"), 20), false);
});

function stackDeps() {
  const elementBox = (element) => ({
    x: element.position?.x ?? 0,
    y: element.position?.y ?? 0,
    width: element.size?.width ?? 1,
    height: element.size?.height ?? 1,
  });
  return {
    elementBox,
    componentBox: (component) => {
      const first = component.elements?.[0];
      const size = first?.size ?? { width: 1, height: 1 };
      const position = component.position ?? { x: 0, y: 0 };
      return { x: position.x, y: position.y, width: size.width, height: size.height };
    },
    childArrayInfo: (element) =>
      Array.isArray(element.children) ? { items: element.children } : null,
    layoutChildren: (_parent, children) =>
      children.map((child) => ({ child, box: elementBox(child) })),
  };
}

test("auto-ungroup pushes a stacked sibling clear of a taller preceding text", () => {
  const ui = {
    components: [
      {
        id: "stack",
        position: { x: 0, y: 0 },
        elements: [
          {
            type: "text",
            name: "title",
            text: "Title",
            position: { x: 0, y: 0 },
            size: { width: 200, height: 150 },
          },
          {
            type: "text",
            name: "subtitle",
            text: "Subtitle",
            position: { x: 0, y: 82 },
            size: { width: 200, height: 40 },
          },
        ],
      },
    ],
  };

  const result = autoUngroupTextComponents(ui, stackDeps());

  assert.deepEqual(
    result.components.map((component) => component.id),
    ["stack_part_1", "stack_part_2"],
  );
  assert.equal(result.components[0].position.y, 0);
  // 150 (title bottom) + MIN_STACK_GAP, not the stale authored 82.
  assert.equal(result.components[1].position.y, 150 + MIN_STACK_GAP);
});
