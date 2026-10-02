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
      for (const candidate of [
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.js`,
        `${base}.mjs`,
        `${base}/index.ts`,
      ]) {
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

function componentBox(component) {
  if (component.id === "alpha") return { x: 10, y: 20, width: 100, height: 40 };
  if (component.id === "beta") return { x: 80, y: 30, width: 50, height: 50 };
  const position = component.position ?? { x: 0, y: 0 };
  const size = component.elements?.[0]?.size ?? { width: 1, height: 1 };
  return { x: position.x, y: position.y, width: size.width, height: size.height };
}

function elementBox(element) {
  const position = element.position ?? { x: 0, y: 0 };
  const size = element.size ?? { width: 1, height: 1 };
  return { x: position.x, y: position.y, width: size.width, height: size.height };
}

const ungroupDeps = {
  componentBox,
  elementBox,
  childArrayInfo(element) {
    return Array.isArray(element.children) ? { items: element.children } : null;
  },
  layoutChildren(_parent, children) {
    return children.map((child) => ({ child, box: elementBox(child) }));
  },
};

function sampleUi() {
  return {
    id: "slide-v2",
    version: "v2-standard",
    components: [
      {
        id: "keep",
        position: { x: 0, y: 0 },
        elements: [{ type: "text", text: "stay" }],
      },
      {
        id: "alpha",
        description: "Alpha",
        position: { x: 10, y: 20 },
        design_variables: [{ name: "accent", value: "#112233" }],
        elements: [{ type: "text", text: "A" }],
      },
      {
        id: "beta",
        position: { x: 80, y: 30 },
        elements: [{ type: "shape", text: "B" }],
      },
    ],
  };
}

test("chart font survives conversion to an editable slide", async () => {
  const { adaptTemplateV2LayoutToSlide } = await import(
    "../components/slide-editor/importing/template-v2-import.ts"
  );
  const slide = adaptTemplateV2LayoutToSlide({
    id: "chart-slide",
    elements: [{
      type: "chart",
      chart_type: "bar",
      font: { family: "Be Vietnam Pro" },
      categories: ["A"],
      series: [{ name: "Sales", values: [1] }],
      decorative: false,
      name: "revenue",
    }],
  });

  assert.equal(slide.elements[0].font?.family, "Be Vietnam Pro");
});

test("grouping two components preserves child content and selects the new group", async () => {
  const { groupTemplateV2ComponentsInUi, isTemplateV2GroupShortcut } = await import(
    "../components/slide-editor/model/template-v2-group.ts"
  );

  assert.equal(groupTemplateV2ComponentsInUi(sampleUi(), [1], { componentBox }), null);
  assert.equal(isTemplateV2GroupShortcut({ metaKey: true, ctrlKey: false, altKey: false, shiftKey: false, code: "KeyG", key: "g" }), true);
  assert.equal(isTemplateV2GroupShortcut({ metaKey: true, ctrlKey: false, altKey: false, shiftKey: true, code: "KeyG", key: "g" }), false);

  const grouped = groupTemplateV2ComponentsInUi(sampleUi(), [2, 1], { componentBox });
  assert.ok(grouped);
  assert.deepEqual(grouped.selection, { kind: "component", componentIndex: 1 });
  assert.deepEqual(
    grouped.ui.components.map((component) => component.id),
    ["keep", "group"],
  );

  const group = grouped.ui.components[1];
  assert.deepEqual(group.position, { x: 10, y: 20 });
  const groupElement = group.elements[0];
  assert.equal(groupElement.type, "group");
  assert.deepEqual(groupElement.size, { width: 120, height: 60 });
  assert.deepEqual(
    groupElement.children.map((child) => ({
      name: child.name,
      position: child.position,
      size: child.size,
      text: child.children[0].text,
    })),
    [
      { name: "alpha", position: { x: 0, y: 0 }, size: { width: 100, height: 40 }, text: "A" },
      { name: "beta", position: { x: 70, y: 10 }, size: { width: 50, height: 50 }, text: "B" },
    ],
  );
  assert.deepEqual(groupElement.children[0].design_variables, [{ name: "accent", value: "#112233" }]);
  assert.equal(grouped.ui.components[0].elements[0].text, "stay");
});

test("ungrouping restores absolute positions without dropping nested text", async () => {
  const { groupTemplateV2ComponentsInUi } = await import(
    "../components/slide-editor/model/template-v2-group.ts"
  );
  const { ungroupTemplateV2ComponentInUi } = await import(
    "../components/slide-editor/model/template-v2-ungroup.ts"
  );

  const grouped = groupTemplateV2ComponentsInUi(sampleUi(), [1, 2], { componentBox });
  const ungrouped = ungroupTemplateV2ComponentInUi(grouped.ui, 1, ungroupDeps);
  assert.ok(ungrouped);
  assert.equal(ungrouped.selection, null);
  assert.deepEqual(
    ungrouped.ui.components.map((component) => ({
      id: component.id,
      position: component.position,
      text: component.elements[0].children?.[0]?.text ?? component.elements[0].text,
      size: component.elements[0].size,
    })),
    [
      { id: "keep", position: { x: 0, y: 0 }, text: "stay", size: undefined },
      { id: "group_part_1", position: { x: 10, y: 20 }, text: "A", size: { width: 100, height: 40 } },
      { id: "group_part_2", position: { x: 80, y: 30 }, text: "B", size: { width: 50, height: 50 } },
    ],
  );
});

test("nested element selection keys round-trip and toggling builds a multi-selection", async () => {
  const model = await import("../components/slide-editor/model/model.ts");
  const nested = {
    kind: "element",
    componentIndex: 1,
    elementPath: [0, 2],
  };
  assert.equal(model.keyForSelection(nested), "element:1:0.2");
  assert.deepEqual(model.selectionFromKey("element:1:0.2"), nested);
  assert.deepEqual(model.selectionFromKey("multi-component:0.2"), {
    kind: "multi-component",
    componentIndexes: [0, 2],
  });

  const both = model.selectionWithComponentToggle(
    { kind: "component", componentIndex: 0 },
    { kind: "component", componentIndex: 1 },
    { additive: true },
  );
  assert.deepEqual(both, { kind: "multi-component", componentIndexes: [0, 1] });
  assert.deepEqual(
    model.selectionWithComponentToggle(both, { kind: "component", componentIndex: 1 }, { additive: true }),
    { kind: "component", componentIndex: 0 },
  );

  const ui = {
    components: [
      {
        position: { x: 4, y: 6 },
        elements: [
          {
            type: "group",
            position: { x: 0, y: 0 },
            size: { width: 80, height: 20 },
            children: [{ type: "text", text: "nested", position: { x: 3, y: 4 }, size: { width: 10, height: 8 } }],
          },
        ],
      },
    ],
  };
  assert.equal(
    model.getElementAtSelection(ui, { kind: "element", componentIndex: 0, elementPath: [0, 0] }).text,
    "nested",
  );
});

test("clipboard and side resize keep geometry for the selected component", async () => {
  const model = await import("../components/slide-editor/model/model.ts");
  const { componentSideResizeBox, resizeRawElementBounds } = await import(
    "../components/slide-editor/model/component-resize.ts"
  );

  const ui = {
    components: [
      {
        id: "card",
        position: { x: 10, y: 20 },
        elements: [{ type: "text", text: "A", position: { x: 0, y: 0 }, size: { width: 100, height: 40 } }],
      },
    ],
  };
  const copied = model.componentForClipboardSelection(ui, { kind: "component", componentIndex: 0 });
  assert.deepEqual(copied.box, { x: 10, y: 20, width: 100, height: 40 });
  assert.equal(copied.components[0].component.elements[0].text, "A");

  assert.deepEqual(
    componentSideResizeBox(
      { x: 100, y: 40, width: 80, height: 30 },
      { width: 20, height: 10 },
      "middle-left",
      { width: 1280, height: 720 },
    ),
    { x: 160, y: 40, width: 20, height: 30 },
  );

  const resized = resizeRawElementBounds(
    [{
      type: "group",
      position: { x: 2, y: 4 },
      size: { width: 10, height: 8 },
      children: [{ type: "text", text: "nested", position: { x: 1, y: 1 }, size: { width: 4, height: 2 } }],
    }],
    2,
    3,
  );
  assert.deepEqual(resized[0].position, { x: 4, y: 12 });
  assert.deepEqual(resized[0].size, { width: 20, height: 24 });
  assert.deepEqual(resized[0].children[0].position, { x: 2, y: 3 });
  assert.equal(resized[0].children[0].text, "nested");
});

test("auto-ungroup splits text stacks, flow layouts, and multi-element components", async () => {
  const { autoUngroupTextComponents } = await import(
    "../components/slide-editor/model/template-v2-ungroup.ts"
  );

  const ui = {
    components: [
      {
        id: "heading_stack",
        position: { x: 0, y: 0 },
        elements: [
          { type: "text", name: "title", text: "Title" },
          { type: "text", name: "subtitle", text: "Subtitle" },
        ],
      },
      {
        id: "flex_copy",
        position: { x: 40, y: 50 },
        elements: [
          {
            type: "flex",
            direction: "column",
            children: [
              { type: "text", text: "One" },
              { type: "text", text: "Two" },
            ],
          },
        ],
      },
      {
        id: "image_row",
        position: { x: 0, y: 100 },
        elements: [
          { type: "image", data: "/img.png" },
          { type: "text", name: "caption", text: "Caption" },
        ],
      },
    ],
  };

  const result = autoUngroupTextComponents(ui, ungroupDeps);

  assert.deepEqual(
    result.components.map((component) => component.id),
    [
      "heading_stack_part_1",
      "heading_stack_part_2",
      "flex_copy_part_1",
      "flex_copy_part_2",
      "image_row_part_1",
      "image_row_part_2",
    ],
  );
  // Text-only groups become one text per component...
  assert.equal(result.components[0].elements.length, 1);
  assert.equal(result.components[0].elements[0].text, "Title");
  assert.equal(result.components[3].elements[0].text, "Two");
  // ...and multi-element components split into one component per element.
  assert.equal(result.components[4].elements.length, 1);
  assert.equal(result.components[4].elements[0].type, "image");
  assert.equal(result.components[5].elements[0].type, "text");
  assert.equal(result.components[5].elements[0].text, "Caption");
});

test("flow column clamps a manual child below a taller preceding sibling", async () => {
  const { layoutFlowChildren } = await import(
    "../components/slide-editor/layout/flowLayout.ts"
  );

  const heading = {
    type: "text",
    position: { x: 0, y: 0 },
    size: { width: 200, height: 150 },
  };
  const subtitle = {
    type: "text",
    position: { x: 0, y: 82 },
    size: { width: 200, height: 40 },
    __gslide_manual_position: true,
  };

  const laidOut = layoutFlowChildren(
    { type: "flex", direction: "column", gap: 5.36 },
    [heading, subtitle],
    { x: 0, y: 0, width: 200, height: 400 },
    {
      elementBox: (element) => ({
        x: element.position?.x ?? 0,
        y: element.position?.y ?? 0,
        width: element.size?.width ?? 1,
        height: element.size?.height ?? 1,
      }),
      elementSize: (element) => ({
        width: element.size?.width ?? 1,
        height: element.size?.height ?? 1,
      }),
      isManualPositioned: (element) =>
        element.__gslide_manual_position === true,
    },
  );

  assert.equal(laidOut[0].box.y, 0);
  assert.ok(
    laidOut[1].box.y >= 150 + 5.36,
    `subtitle y ${laidOut[1].box.y} must clear the two-line heading`,
  );
});
