import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const UPLOAD_PAGE_PATH =
  "app/(presentation-generator)/upload/components/UploadPage.tsx";
const CONFIG_SELECTS_PATH =
  "app/(presentation-generator)/upload/components/ConfigurationSelects.tsx";

test("upload config defaults web search on and does not inherit WEB_GROUNDING", async () => {
  const uploadPage = await read(UPLOAD_PAGE_PATH);
  const outlinePage = await read(
    "app/(presentation-generator)/outline/components/OutlinePage.tsx",
  );

  assert.match(uploadPage, /webSearch:\s*true/);
  assert.match(outlinePage, /webSearch:\s*true/);
  assert.doesNotMatch(
    uploadPage,
    /webSearch:\s*!!llmConfig\.WEB_GROUNDING/,
  );
  assert.doesNotMatch(
    uploadPage,
    /llmConfig\?\.WEB_GROUNDING/,
  );
});

test("configuration selects expose a per-presentation web search toggle", async () => {
  const configSelects = await read(CONFIG_SELECTS_PATH);

  assert.match(configSelects, /data-testid=["']web-search-toggle["']/);
  assert.match(configSelects, /onConfigChange\(\s*["']webSearch["']/);
});

test("provider settings UI is removed and the upload chip is gone", async () => {
  const uploadPage = await read(UPLOAD_PAGE_PATH);
  await assert.rejects(
    read("app/(presentation-generator)/(dashboard)/settings/SettingPage.tsx"),
  );
  assert.doesNotMatch(uploadPage, /CurrentConfig/);
});
