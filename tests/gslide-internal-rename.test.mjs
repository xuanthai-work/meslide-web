import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const nextRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readNext(relativePath) {
  return readFile(path.join(nextRoot, relativePath), "utf8");
}

test("web package name is gslide-web", async () => {
  const nextPkg = JSON.parse(await readNext("package.json"));
  assert.equal(nextPkg.name, "gslide-web");
});

test("blank-slide event and clipboard write GSlide names", async () => {
  const blank = await readNext(
    "app/(presentation-generator)/_shared/blank-slide-prompt-event.ts",
  );
  assert.match(blank, /GSLIDE_BLANK_SLIDE_PROMPT_EVENT/);
  assert.match(blank, /"gslide:blank-slide-prompt"/);
  assert.doesNotMatch(blank, /presenton:blank-slide-prompt/);

  const clipboard = await readNext("components/slide-editor/clipboard/useClipboard.ts");
  assert.match(clipboard, /GSLIDE_TEMPLATE_V2:/);
  assert.match(clipboard, /PRESENTON_TEMPLATE_V2:/);
  assert.match(clipboard, /application\/x-gslide-template-v2/);
  const payload = await readNext("components/slide-editor/clipboard/clipboard.ts");
  assert.match(payload, /"gslide\/template-v2"/);
});

test("persisted runtime identifiers are GSlide without Presenton leftovers", async () => {
  const html = [
    await readNext("lib/template-v2-json-to-html.ts"),
    await readNext("lib/template-v2-html-shared.ts"),
    await readNext("lib/template-v2-html-chart.ts"),
  ].join("\n");
  assert.match(html, /\.gslide-math/);
  assert.match(html, /data-gslide-chart/);
  assert.match(html, /data-gslide-math/);
  assert.match(html, /__GSLIDE_JSON_CHARTS__/);
  assert.match(html, /gslideFormat/);
  assert.match(html, /gslideBarRadius/);
  assert.match(html, /gslidePosition/);
  assert.match(html, /gslideOutsideColor/);
  assert.doesNotMatch(html, /presenton-math/);
  assert.doesNotMatch(html, /data-presenton-chart/);
  assert.doesNotMatch(html, /__PRESENTON_JSON_CHARTS__/);
  assert.doesNotMatch(html, /presentonFormat/);
  assert.doesNotMatch(html, /presentonBarRadius/);

  const preview = await readNext(
    "app/(presentation-generator)/components/TemplateV2HtmlSlidePreview.tsx",
  );
  assert.match(preview, /GSlideChartGlobalState/);
  assert.match(preview, /__GSLIDE_JSON_CHARTS__/);
  assert.doesNotMatch(preview, /PresentonChartGlobalState/);
  assert.doesNotMatch(preview, /presentonFormat/);
  assert.doesNotMatch(preview, /data-presenton-chart/);

  const model = await readNext("components/slide-editor/model/model.ts");
  assert.match(model, /__gslide_manual_position/);
  assert.doesNotMatch(model, /__presenton_manual_position/);

  const events = await readNext("components/slide-editor/events/events.ts");
  assert.match(events, /"gslide:template-v2-insert-elements"/);
  assert.doesNotMatch(events, /presenton:template-v2-/);

  const charts = await readNext("lib/chart-browser.ts");
  assert.match(charts, /__GSLIDE_CHART_BROWSER_RUNTIME__/);
  assert.match(charts, /data-gslide-chart-runtime/);
  assert.match(charts, /dataset\.gslideChartRuntime/);
  assert.doesNotMatch(charts, /PRESENTON_CHART_BROWSER/);
  assert.doesNotMatch(charts, /data-presenton-chart-runtime/);

  const tailwind = await readNext("lib/tailwind-browser.ts");
  assert.match(tailwind, /data-gslide-tailwind-browser/);
  assert.doesNotMatch(tailwind, /data-presenton-tailwind-browser/);

});

test("remaining editor and preview identifiers are GSlide", async () => {
  const preview = await readNext(
    "app/(presentation-generator)/components/TemplateV2HtmlSlidePreview.tsx",
  );
  assert.match(preview, /dataset\.gslideCharts/);
  assert.match(preview, /dataset\.gslideChartRendered/);
  assert.doesNotMatch(preview, /dataset\.presentonCharts/);
  assert.doesNotMatch(preview, /dataset\.presentonChartRendered/);

  const injection = await readNext(
    "app/(presentation-generator)/components/useSmartChartInjection.ts",
  );
  assert.match(injection, /dataset\.gslideChartRendered/);
  assert.doesNotMatch(injection, /dataset\.presentonChartRendered/);

  const editor = await readNext(
    "components/slide-editor/text/TiptapInlineTextEditor.tsx",
  );
  assert.match(editor, /"gslide:commit-template-v2-inline-text"/);
  assert.match(editor, /"gslide:latex-run-focus"/);
  assert.doesNotMatch(editor, /presenton:commit-template-v2-inline-text/);
  assert.doesNotMatch(editor, /presenton:latex-run-focus/);

  const page = await readNext(
    "app/(presentation-generator)/presentation/components/PresentationPage.tsx",
  );
  assert.match(page, /gslide:editor-navigation-hint:v1/);
  assert.doesNotMatch(page, /presenton:editor-navigation-hint/);

  const chat = await readNext(
    "app/(presentation-generator)/presentation/components/chat/chat-utils.ts",
  );
  assert.match(chat, /gslide:chat:/);
  assert.doesNotMatch(chat, /presenton:chat:/);

  const tailwindRuntime = await readNext(
    "components/runtime/TailwindBrowserRuntime.tsx",
  );
  assert.match(tailwindRuntime, /gslide:tailwind-runtime-ready/);
  assert.match(tailwindRuntime, /gslide:tailwind-runtime-request/);
  assert.doesNotMatch(tailwindRuntime, /presenton:tailwind-runtime-/);
});
