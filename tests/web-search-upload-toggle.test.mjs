import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const UPLOAD_PAGE_PATH =
  "app/(presentation-generator)/upload/components/UploadPage.tsx";
const CONFIG_SELECTS_PATH =
  "app/(presentation-generator)/upload/components/ConfigurationSelects.tsx";
const WEB_SEARCH_SETTINGS_PATH =
  "app/(presentation-generator)/(dashboard)/settings/WebSearchProvider.tsx";
const SETTINGS_PAGE_PATH =
  "app/(presentation-generator)/(dashboard)/settings/SettingPage.tsx";

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

test("settings web search keeps max results and drops the on/off and SearXNG URL fields", async () => {
  const settings = await read(WEB_SEARCH_SETTINGS_PATH);

  assert.match(settings, /settings\.webSearch\.maxResults/);
  assert.match(settings, /data-testid=["']web-search-max-results["']/);
  assert.doesNotMatch(settings, /WEB_GROUNDING/);
  assert.doesNotMatch(settings, /SEARXNG_BASE_URL/);
  assert.doesNotMatch(settings, /searxngBaseUrl/);
});

test("settings summary no longer reports a global web search on/off", async () => {
  const settingsPage = await read(SETTINGS_PAGE_PATH);

  assert.doesNotMatch(settingsPage, /llmConfig\.WEB_GROUNDING/);
  assert.doesNotMatch(settingsPage, /settings\.summary\.webSearchDisabled/);
});

test("AI image generation is hidden from settings tabs and the upload chip is gone", async () => {
  const sidebar = await read(
    "app/(presentation-generator)/(dashboard)/settings/SettingSideBar.tsx",
  );
  const settingsPage = await read(SETTINGS_PAGE_PATH);
  const uploadPage = await read(UPLOAD_PAGE_PATH);

  assert.doesNotMatch(sidebar, /id:\s*["']image-provider["']/);
  assert.doesNotMatch(settingsPage, /\{imageSummary\}/);
  assert.doesNotMatch(uploadPage, /CurrentConfig/);
});
