import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("gslide barrel exports studio primitives", async () => {
  const barrel = await read("components/gslide/index.ts");
  for (const name of [
    "GSlideStudioTitle",
    "GSlideStepRail",
    "GSlideFadeHeader",
    "GSlideDropCard",
  ]) {
    assert.match(barrel, new RegExp(name));
  }
});

test("CustomTemplatePage uses shared studio primitives", async () => {
  const source = await read(
    "app/(presentation-generator)/custom-template/CustomTemplatePage.tsx",
  );
  assert.match(source, /GSlideStudioTitle/);
  assert.match(source, /GSlideStepRail/);
  assert.match(source, /GSlideFadeHeader/);
  assert.match(source, /GSlideDropCard/);
  assert.match(source, /GSlideButton/);
  assert.doesNotMatch(source, /function TemplateStudioTitle/);
  assert.doesNotMatch(source, /function StudioTopBar/);
  assert.doesNotMatch(source, /function GradientPillButton/);
});

test("studio title uses Unbounded display and Manrope body, not Syne", async () => {
  const source = await read("components/gslide/GSlideStudioTitle.tsx");
  assert.match(source, /font-unbounded/);
  assert.doesNotMatch(source, /font-syne/);
});

test("upload page uses studio title keys and drop card", async () => {
  const source = await read(
    "app/(presentation-generator)/upload/components/UploadPage.tsx",
  );
  const routeShell = await read("app/(presentation-generator)/upload/page.tsx");
  assert.match(source, /GSlideStudioTitle/);
  assert.match(source, /upload\.hero\.title/);
  assert.match(source, /className="pt-10 sm:pt-12 2xl:pt-14"/);
  assert.match(source, /GSlideDropCard/);
  assert.doesNotMatch(source, /font-syne/);
  assert.doesNotMatch(routeShell, /upload\.hero\.(title|subtitle)/);
});

test("outline header is white hairline chrome without Syne", async () => {
  const header = await read(
    "app/(presentation-generator)/outline/components/OutlineStandardHeader.tsx",
  );
  assert.match(header, /font-unbounded/);
  assert.doesNotMatch(header, /font-syne/);
  assert.match(header, /--gslide-border/);
});

test("outline generate uses GSlideButton pill", async () => {
  const source = await read(
    "app/(presentation-generator)/outline/components/GenerateButton.tsx",
  );
  assert.match(source, /GSlideButton/);
  assert.doesNotMatch(source, /from "@\/components\/ui\/button"/);
});

test("dashboard action cards use 12px radius and token hairline", async () => {
  const source = await read(
    "app/(presentation-generator)/(dashboard)/dashboard/components/DashboardPage.tsx",
  );
  assert.match(source, /rounded-\[12px\]|rounded-xl/);
  assert.doesNotMatch(source, /font-syne/);
  assert.match(source, /GSlideHeader/);
});

test("templates page header uses GSlideHeader or Unbounded plus pill create", async () => {
  const source = await read(
    "app/(presentation-generator)/(dashboard)/templates/components/TemplatePanel.tsx",
  );
  assert.match(source, /GSlideHeader|font-unbounded/);
  assert.match(source, /rounded-full/);
  assert.doesNotMatch(source, /font-syne/);
});

test("community page does not use ice header height 105px or Syne", async () => {
  const source = await read(
    "app/(presentation-generator)/(dashboard)/community/components/CommunityPage.tsx",
  );
  assert.doesNotMatch(source, /min-h-\[105px\]/);
  assert.doesNotMatch(source, /font-syne/);
});

test("settings tabs use token accent without Syne", async () => {
  const source = await read(
    "app/(presentation-generator)/(dashboard)/settings/SettingSideBar.tsx",
  );
  assert.match(source, /--gslide-accent/);
  assert.doesNotMatch(source, /font-syne/);
});

test("theme panel generate control is a pill and body is not Syne", async () => {
  const source = await read(
    "app/(presentation-generator)/(dashboard)/theme/components/ThemePanel/index.tsx",
  );
  assert.match(source, /rounded-full/);
  assert.match(source, /GSlideHeader/);
  assert.doesNotMatch(source, /font-syne/);
  assert.doesNotMatch(source, /#BFDBFE/);
});

test("presentation header chrome is white hairline without Syne", async () => {
  const source = await read(
    "app/(presentation-generator)/presentation/components/PresentationHeader.tsx",
  );
  assert.doesNotMatch(source, /font-syne/);
  assert.match(source, /border-\[var\(--gslide-border\)\]|border-b/);
});

test("chat editor chrome does not use ice fills or Syne", async () => {
  const source = await read(
    "app/(presentation-generator)/presentation/components/chat/ChatEditorLayout.tsx",
  );
  assert.doesNotMatch(source, /font-syne/);
  assert.doesNotMatch(source, /#EFF6FF/);
  assert.doesNotMatch(source, /#BFDBFE/);
});

test("slide editor surface files are unchanged by studio chrome", async () => {
  const nodes = await read("components/slide-editor/surface/nodes.tsx");
  assert.doesNotMatch(nodes, /--gslide-bg/);
});
