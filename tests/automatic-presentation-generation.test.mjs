import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("new presentations keep template selection but bypass outline verification", async () => {
  const uploadPage = await read(
    "app/(presentation-generator)/upload/components/UploadPage.tsx",
  );
  const documentsPreview = await read(
    "app/(presentation-generator)/documents-preview/components/DocumentPreviewPage.tsx",
  );

  assert.match(
    uploadPage,
    /return `\/outline\?\$\{params\.toString\(\)\}`/,
  );
  assert.match(uploadPage, /auto:\s*"1"/);
  assert.match(documentsPreview, /router\.replace\(`\/outline\?/);
  assert.doesNotMatch(documentsPreview, /generation_mode|community_design_ids/);
});

test("template selection starts the hidden outline-to-slide bootstrap", async () => {
  const outlinePage = await read(
    "app/(presentation-generator)/outline/components/OutlinePage.tsx",
  );
  const presentationPage = await read(
    "app/(presentation-generator)/presentation/components/PresentationPage.tsx",
  );
  const bootstrapHook = await read(
    "app/(presentation-generator)/presentation/hooks/useAutomaticPresentationGeneration.ts",
  );

  assert.match(outlinePage, /searchParams\.get\("auto"\) === "1"/);
  assert.match(outlinePage, /template:\s*template\.id/);
  assert.match(outlinePage, /router\.replace\(`\/presentation\?/);
  assert.match(presentationPage, /searchParams\.get\("auto"\) === "1"/);
  assert.match(presentationPage, /searchParams\.get\("template"\)/);
  assert.match(presentationPage, /useAutomaticPresentationGeneration/);
  assert.match(bootstrapHook, /PresentationGenerationApi\.getOutlines/);
  assert.match(bootstrapHook, /useOutlineStreaming/);
  assert.match(bootstrapHook, /PresentationGenerationApi\.presentationPrepare/);
  assert.match(bootstrapHook, /layout:\s*templateId/);
  assert.doesNotMatch(bootstrapHook, /DEFAULT_TEMPLATE_ID/);
  assert.match(
    bootstrapHook,
    /\/presentation\?id=\$\{presentationId\}&stream=true&type=standard/,
  );
});

test("automatic flow uses the outline page only as a template picker", async () => {
  const outlinePage = await read(
    "app/(presentation-generator)/outline/components/OutlinePage.tsx",
  );
  const templateSelection = await read(
    "app/(presentation-generator)/outline/components/TemplateSelection.tsx",
  );

  assert.match(outlinePage, /autoGenerate/);
  assert.doesNotMatch(outlinePage, /autoSubmitPresentation/);
  assert.doesNotMatch(templateSelection, /autoSelect/);
});
