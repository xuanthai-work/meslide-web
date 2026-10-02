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

const UNGROUP = "../components/slide-editor/model/template-v2-ungroup.ts";

function elementBox(element) {
  const position = element.position ?? { x: 0, y: 0 };
  const size = element.size ?? { width: 1, height: 1 };
  return { x: position.x, y: position.y, width: size.width, height: size.height };
}

const ungroupDeps = {
  elementBox,
  componentBox(component) {
    const first = component.elements?.[0];
    const size = first?.size ?? { width: 1, height: 1 };
    const position = component.position ?? { x: 0, y: 0 };
    return { x: position.x, y: position.y, width: size.width, height: size.height };
  },
  childArrayInfo(element) {
    return Array.isArray(element.children) ? { items: element.children } : null;
  },
  layoutChildren(_parent, children) {
    return children.map((child) => ({ child, box: elementBox(child) }));
  },
};

function cardGridUi() {
  const card = (x, label) => ({
    type: "container",
    position: { x, y: 0 },
    size: { width: 120, height: 80 },
    child: { type: "text", text: label },
  });
  return {
    id: "slide-v2",
    components: [
      {
        id: "card_grid",
        position: { x: 100, y: 200 },
        elements: [
          {
            type: "flex",
            direction: "row",
            gap: 20,
            position: { x: 0, y: 0 },
            size: { width: 400, height: 80 },
            children: [card(0, "Card 1"), card(140, "Card 2"), card(280, "Card 3")],
          },
        ],
      },
    ],
  };
}

test("a flex card grid ungroups into one component per card", async () => {
  const { autoUngroupComponents } = await import(UNGROUP);

  const result = autoUngroupComponents(cardGridUi(), ungroupDeps);

  assert.deepEqual(
    result.components.map((component) => component.id),
    ["card_grid_part_1", "card_grid_part_2", "card_grid_part_3"],
  );
  for (const component of result.components) {
    // Each card stays a single, self-contained element (frame + inner text).
    assert.equal(component.elements.length, 1);
    assert.equal(component.elements[0].type, "container");
    assert.equal(component.elements[0].child.type, "text");
  }
});

test("ungrouped card components keep distinct, non-overlapping positions", async () => {
  const { autoUngroupComponents } = await import(UNGROUP);

  const result = autoUngroupComponents(cardGridUi(), ungroupDeps);
  const boxes = result.components.map((component) => {
    const element = component.elements[0];
    return {
      x: component.position.x,
      y: component.position.y,
      width: element.size.width,
      height: element.size.height,
    };
  });

  assert.deepEqual(
    boxes.map((box) => box.x),
    [100, 240, 380],
  );
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      const overlapsX = a.x < b.x + b.width && b.x < a.x + a.width;
      const overlapsY = a.y < b.y + b.height && b.y < a.y + a.height;
      assert.equal(overlapsX && overlapsY, false, `cards ${i} and ${j} overlap`);
    }
  }
});

test("ctrl/cmd/shift are treated as additive component selection", async () => {
  const { isAdditiveSelectionEvent } = await import(
    "../components/slide-editor/selection/selectionKeys.ts"
  );

  assert.equal(isAdditiveSelectionEvent({ ctrlKey: true }), true);
  assert.equal(isAdditiveSelectionEvent({ metaKey: true }), true);
  assert.equal(isAdditiveSelectionEvent({ shiftKey: true }), true);
  assert.equal(isAdditiveSelectionEvent({ ctrlKey: false, metaKey: false }), false);
  assert.equal(isAdditiveSelectionEvent({}), false);
  assert.equal(isAdditiveSelectionEvent(null), false);
});
