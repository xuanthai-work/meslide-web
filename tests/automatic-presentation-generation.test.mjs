import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("new presentations carry the resolved template from upload", async () => {
  const upload = await read("app/(presentation-generator)/upload/components/UploadPage.tsx");
  const documents = await read("app/(presentation-generator)/documents-preview/components/DocumentPreviewPage.tsx");

  assert.match(upload, /return `\/presentation\?\$\{params\.toString\(\)\}`/);
  assert.match(upload, /auto:\s*"1"/);
  assert.match(upload, /template: templateId/);
  assert.match(upload, /getGenerationDestination\(createResponse\.id, templateId\)/);
  assert.match(documents, /router\.replace\(`\/presentation\?/);
  assert.doesNotMatch(`${upload}\n${documents}`, /\/outline\?/);
});

test("legacy automatic links without a template return to upload", async () => {
  const route = await read("app/(presentation-generator)/presentation/page.tsx");
  const page = await read("app/(presentation-generator)/presentation/components/PresentationPage.tsx");
  const bootstrap = await read("app/(presentation-generator)/presentation/hooks/useAutomaticPresentationGeneration.ts");

  assert.match(route, /params\.get\("auto"\) === "1" && !params\.get\("template"\)\?\.trim\(\)/);
  assert.match(route, /router\.replace\("\/upload"\)/);
  assert.doesNotMatch(page, /PresentationTemplatePicker|showTemplatePicker|suggested_template/);
  assert.doesNotMatch(
    `${route}\n${bootstrap}`,
    /router\.(?:push|replace)\([^)]*["'`]\/outline/,
  );
});

test("automatic generation streams outlines in the background", async () => {
  const bootstrap = await read(
    "app/(presentation-generator)/presentation/hooks/useAutomaticPresentationGeneration.ts",
  );
  const hooks = await read(
    "app/(presentation-generator)/presentation/hooks/index.ts",
  );

  assert.match(bootstrap, /useBackgroundOutlineStream/);
  assert.match(bootstrap, /draftCount:\s*0/);
  assert.doesNotMatch(bootstrap, /\/outline\/hooks\//);
  assert.match(hooks, /useBackgroundOutlineStream/);
});

test("automatic generation skips the no-stream slide fetch", async () => {
  const page = await read("app/(presentation-generator)/presentation/components/PresentationPage.tsx");
  const streaming = await read("app/(presentation-generator)/presentation/hooks/usePresentationStreaming.ts");

  assert.match(page, /skipSlideFetch:\s*autoGenerate/);
  assert.match(streaming, /if \(!stream\)/);
  assert.match(streaming, /if \(!skipSlideFetch\) \{\s*fetchUserSlides\(\);\s*\}/);
});

test("automatic generation keeps recovery controls clear of the page overlay", async () => {
  const page = await read("app/(presentation-generator)/presentation/components/PresentationPage.tsx");

  assert.match(
    page,
    /show=\{loadingState\.isLoading && !isStreaming && !autoGenerate\}/,
  );
});
