import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("new presentations enter the template stage on /presentation", async () => {
  const upload = await read("app/(presentation-generator)/upload/components/UploadPage.tsx");
  const documents = await read("app/(presentation-generator)/documents-preview/components/DocumentPreviewPage.tsx");

  assert.match(upload, /return `\/presentation\?\$\{params\.toString\(\)\}`/);
  assert.match(upload, /auto:\s*"1"/);
  assert.match(documents, /router\.replace\(`\/presentation\?/);
  assert.doesNotMatch(`${upload}\n${documents}`, /\/outline\?/);
});

test("presentation owns template selection before automatic generation", async () => {
  const page = await read("app/(presentation-generator)/presentation/components/PresentationPage.tsx");
  const picker = await read("app/(presentation-generator)/presentation/components/PresentationTemplatePicker.tsx");
  const bootstrap = await read("app/(presentation-generator)/presentation/hooks/useAutomaticPresentationGeneration.ts");

  assert.match(page, /autoGenerate\s*&&\s*!automaticTemplateId/);
  assert.match(page, /<PresentationTemplatePicker/);
  assert.match(picker, /template:\s*template\.id/);
  assert.match(picker, /router\.replace\(`\/presentation\?/);
  assert.doesNotMatch(
    `${picker}\n${bootstrap}`,
    /router\.(?:push|replace)\([^)]*["'`]\/outline/,
  );
});
