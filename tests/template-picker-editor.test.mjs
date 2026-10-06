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
      for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}/index.ts`]) {
        if (!existsSync(candidate)) continue;
        return {
          url: pathToFileURL(candidate).href,
          shortCircuit: true,
          format: "module-typescript",
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

async function loadSlice() {
  const generation = await import("../store/slices/presentationGeneration.ts");
  const blankSlide = await import(
    "../app/(presentation-generator)/_shared/blank-slide.ts"
  );
  return { generation, blankSlide };
}

function blankPresentation() {
  return {
    id: "deck-blank",
    language: "vi",
    layout: null,
    n_slides: 2,
    title: "Blank deck",
    theme: null,
    version: "v2-standard",
    slides: [
      { id: "s1", index: 0, layout_group: "blank", layout: "__blank_slide__" },
      { id: "s2", index: 1, layout_group: "blank", layout: "__blank_slide__" },
    ],
  };
}

test("applyTemplateToPresentation rewrites blank slides and sets the layout", async () => {
  const { generation, blankSlide } = await loadSlice();
  const reducer = generation.default;
  const { setPresentationData, applyTemplateToPresentation } = generation;
  const { isTemplateFreePresentation } = blankSlide;

  const blank = blankPresentation();
  let state = reducer(undefined, setPresentationData(blank));
  assert.equal(isTemplateFreePresentation(state.presentationData), true);

  const layout = { name: "template-v2-nova", layouts: [{ id: "l1" }] };
  state = reducer(
    state,
    applyTemplateToPresentation({
      templateId: "template-v2-nova",
      layout,
      fonts: { body: "Manrope" },
      theme: null,
    })
  );

  assert.deepEqual(state.presentationData.layout, layout);
  assert.deepEqual(state.presentationData.fonts, { body: "Manrope" });
  assert.equal(state.presentationData.slides[0].layout_group, "template-v2-nova");
  assert.equal(state.presentationData.slides[1].layout_group, "template-v2-nova");
  assert.equal(isTemplateFreePresentation(state.presentationData), false);
});

test("applyTemplateToPresentation does not overwrite slides that already have a template", async () => {
  const { generation } = await loadSlice();
  const reducer = generation.default;
  const { setPresentationData, applyTemplateToPresentation } = generation;

  const deck = {
    ...blankPresentation(),
    slides: [
      { id: "s1", index: 0, layout_group: "template-v2-existing" },
      { id: "s2", index: 1, layout_group: "blank" },
      { id: "s3", index: 2, layout_group: "" },
    ],
  };

  let state = reducer(undefined, setPresentationData(deck));
  state = reducer(
    state,
    applyTemplateToPresentation({
      templateId: "template-v2-nova",
      layout: { name: "nova" },
    })
  );

  assert.equal(state.presentationData.slides[0].layout_group, "template-v2-existing");
  assert.equal(state.presentationData.slides[1].layout_group, "template-v2-nova");
  assert.equal(state.presentationData.slides[2].layout_group, "template-v2-nova");
});

test("applyTemplateToPresentation is a no-op without presentation data", async () => {
  const { generation } = await loadSlice();
  const reducer = generation.default;
  const { applyTemplateToPresentation } = generation;

  const state = reducer(
    undefined,
    applyTemplateToPresentation({
      templateId: "template-v2-nova",
      layout: { name: "nova" },
    })
  );

  assert.equal(state.presentationData, null);
});

test("applyTemplateToPresentation is exported from the slice", async () => {
  const { generation } = await loadSlice();
  assert.equal(typeof generation.applyTemplateToPresentation, "function");
});
