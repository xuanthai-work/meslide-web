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

function slide(id, extra = {}) {
  return {
    id,
    index: 0,
    type: 1,
    design_index: null,
    images: ["old-a", "old-b"],
    properties: null,
    icons: ["icon-a"],
    graph_id: null,
    content: {
      title: "Title",
      body: [{ heading: "H", description: "D" }],
      image: { __image_url__: "keep-url", __image_prompt__: "keep-prompt", caption: "stay" },
      icon: { __icon_url__: "old-icon", __icon_query__: "old-query" },
    },
    ...extra,
  };
}

function deck(slides, extra = {}) {
  return {
    id: "deck",
    language: "vi",
    layout: { name: "default" },
    n_slides: slides.length,
    title: "Deck",
    slides,
    theme: null,
    ...extra,
  };
}

test("slide reducers keep V1 and V2 JSON and edit nested content in place", async () => {
  const generation = await import("../store/slices/presentationGeneration.ts");
  const reducer = generation.default;
  const {
    addSlide,
    deletePresentationSlide,
    duplicatePresentationSlide,
    movePresentationSlide,
    replaceSlidesWithBlankFallback,
    setPresentationData,
    updateSlideContent,
    updateSlideIcon,
    updateSlideImage,
  } = generation;

  const v1 = deck([slide("s1"), slide("s2")], { version: "v1-standard" });
  const v2 = deck(
    [slide("v2", { ui: { selected: false }, content: { title: "T", body: "B", elements: [{ id: "e1" }] } })],
    { version: "v2-standard", components: [{ id: "c1" }], fonts: { body: "Manrope" }, structure: { order: [0] } },
  );

  let state = reducer(undefined, setPresentationData(v1));
  assert.equal(JSON.stringify(state.presentationData), JSON.stringify(v1));
  state = reducer(state, setPresentationData(v2));
  assert.equal(JSON.stringify(state.presentationData), JSON.stringify(v2));
  assert.equal(state.presentationData.version, "v2-standard");

  state = reducer(state, setPresentationData(v1));
  state = reducer(state, updateSlideContent({ slideIndex: 0, dataPath: "body[0].description", content: "Edited" }));
  assert.equal(state.presentationData.slides[0].content.body[0].description, "Edited");
  assert.equal(state.presentationData.slides[0].content.body[0].heading, "H");

  state = reducer(state, updateSlideImage({ slideIndex: 0, dataPath: "image", imageUrl: "https://cdn/new.png" }));
  assert.deepEqual(state.presentationData.slides[0].content.image, {
    __image_url__: "https://cdn/new.png",
    __image_prompt__: "keep-prompt",
    caption: "stay",
  });
  assert.equal(state.presentationData.slides[0].images[0], "https://cdn/new.png");
  assert.equal(state.presentationData.slides[0].images[1], "old-b");

  state = reducer(state, updateSlideIcon({
    slideIndex: 0,
    dataPath: "icon",
    iconUrl: "https://cdn/icon.svg",
    query: "arrow",
  }));
  assert.equal(state.presentationData.slides[0].content.icon.__icon_url__, "https://cdn/icon.svg");
  assert.equal(state.presentationData.slides[0].content.icon.__icon_query__, "arrow");
  assert.equal(state.presentationData.slides[0].icons[0], "https://cdn/icon.svg");

  state = reducer(state, movePresentationSlide({ fromIndex: 0, toIndex: 1 }));
  assert.deepEqual(state.presentationData.slides.map((item) => item.id), ["s2", "s1"]);
  assert.deepEqual(state.presentationData.slides.map((item) => item.index), [0, 1]);

  const added = slide("s3");
  state = reducer(state, addSlide({ slide: added, index: 0 }));
  assert.equal(state.presentationData.slides[0].id, "s3");
  assert.equal(state.presentationData.n_slides, 3);

  state = reducer(state, duplicatePresentationSlide({ index: 0, slideId: "s3-copy" }));
  assert.equal(state.presentationData.slides[1].id, "s3-copy");
  assert.equal(state.presentationData.n_slides, 4);

  state = reducer(state, deletePresentationSlide(1));
  assert.equal(state.presentationData.slides.some((item) => item.id === "s3-copy"), false);
  assert.equal(state.presentationData.n_slides, 3);

  const only = deck([slide("only")]);
  state = reducer(state, setPresentationData(only));
  const beforeDelete = JSON.stringify(state.presentationData);
  state = reducer(state, deletePresentationSlide(0));
  assert.equal(JSON.stringify(state.presentationData), beforeDelete);

  state = reducer(state, replaceSlidesWithBlankFallback({ slideData: slide("blank") }));
  assert.equal(state.presentationData.slides.length, 1);
  assert.equal(state.presentationData.slides[0].id, "blank");
  assert.equal(state.presentationData.slides[0].index, 0);
  assert.equal(state.presentationData.n_slides, 1);
});

test("addSlide stops at the slide limit", async () => {
  const { default: reducer, addSlide, setPresentationData } = await import(
    "../store/slices/presentationGeneration.ts"
  );
  const slides = Array.from({ length: 50 }, (_, index) => slide(`s${index}`, { index }));
  let state = reducer(undefined, setPresentationData(deck(slides)));
  state = reducer(state, addSlide({ slide: slide("overflow"), index: 0 }));
  assert.equal(state.presentationData.slides.length, 50);
  assert.equal(state.presentationData.slides[0].id, "s0");
});

test("updateSlideSpeakerNote writes the note onto the target slide", async () => {
  const {
    default: reducer,
    setPresentationData,
    updateSlideSpeakerNote,
  } = await import("../store/slices/presentationGeneration.ts");
  const slides = [slide("s0"), slide("s1")];
  let state = reducer(undefined, setPresentationData(deck(slides)));

  state = reducer(
    state,
    updateSlideSpeakerNote({ index: 0, speakerNote: "Ghi chú mới" }),
  );
  assert.equal(state.presentationData.slides[0].speaker_note, "Ghi chú mới");
  assert.equal(state.presentationData.slides[1].speaker_note, undefined);

  state = reducer(
    state,
    updateSlideSpeakerNote({ index: 1, speakerNote: "Slide hai" }),
  );
  assert.equal(state.presentationData.slides[1].speaker_note, "Slide hai");
  assert.equal(state.presentationData.slides[0].speaker_note, "Ghi chú mới");
});

test("updateSlideSpeakerNote ignores an out-of-range slide index", async () => {
  const {
    default: reducer,
    setPresentationData,
    updateSlideSpeakerNote,
  } = await import("../store/slices/presentationGeneration.ts");
  let state = reducer(undefined, setPresentationData(deck([slide("s0")])));
  const before = JSON.stringify(state.presentationData);
  state = reducer(
    state,
    updateSlideSpeakerNote({ index: 9, speakerNote: "x" }),
  );
  assert.equal(JSON.stringify(state.presentationData), before);
});

test("upload state keeps the other field when only one is sent", async () => {
  const { default: reducer, setPptGenUploadState } = await import(
    "../store/slices/presentationGenUpload.ts"
  );
  const config = { prompt: "Hello", webSearch: true };
  const files = [{ id: "file-1", size: "1 KB" }];
  let state = reducer(undefined, setPptGenUploadState({ config, files }));
  assert.equal(state.config.prompt, "Hello");
  assert.equal(state.files[0].id, "file-1");

  state = reducer(state, setPptGenUploadState({ config: { ...config, prompt: "Next" } }));
  assert.equal(state.config.prompt, "Next");
  assert.equal(state.files[0].id, "file-1");
});
