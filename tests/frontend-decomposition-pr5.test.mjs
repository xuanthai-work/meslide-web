import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Konva slide overlays and stage are split from the surface router", async () => {
  const source = await readFile(
    new URL(
      "../components/slide-editor/surface/TemplateV2KonvaSlide.tsx",
      import.meta.url
    ),
    "utf8"
  );
  assert.match(
    source,
    /from "@\/components\/slide-editor\/surface\/TemplateV2KonvaOverlays"/
  );
  assert.match(
    source,
    /from "@\/components\/slide-editor\/surface\/TemplateV2KonvaStage"/
  );
  assert.match(
    source,
    /from "@\/components\/slide-editor\/surface\/useTemplateV2Keyboard"/
  );
  assert.match(
    source,
    /from "@\/components\/slide-editor\/surface\/useTemplateV2AlignmentDrag"/
  );
});

test("Template V2 HTML serialization keeps a public adapter over split modules", async () => {
  const adapter = await readFile(
    new URL("../lib/template-v2-json-to-html.ts", import.meta.url),
    "utf8"
  );
  const shared = await readFile(
    new URL("../lib/template-v2-html-shared.ts", import.meta.url),
    "utf8"
  );
  const chart = await readFile(
    new URL("../lib/template-v2-html-chart.ts", import.meta.url),
    "utf8"
  );

  assert.match(adapter, /export function templateV2UiToHtml\(/);
  assert.match(
    adapter,
    /export \{\s*TEMPLATE_V2_HTML_HEIGHT,\s*TEMPLATE_V2_HTML_WIDTH,/s
  );
  assert.match(adapter, /from "@\/lib\/template-v2-html-shared"/);
  assert.match(adapter, /from "@\/lib\/template-v2-html-chart"/);
  assert.match(shared, /export const TEMPLATE_V2_HTML_WIDTH/);
  assert.match(chart, /export function renderChart\(/);
  assert.match(chart, /__GSLIDE_JSON_CHARTS__/);
});

test("Chat session loading lives in a dedicated hook", async () => {
  const source = await readFile(
    new URL(
      "../app/(presentation-generator)/presentation/components/Chat.tsx",
      import.meta.url
    ),
    "utf8"
  );
  assert.match(source, /from "\.\/chat\/useChatSession"/);
  assert.match(source, /from "\.\/chat\/ChatEditorLayout"/);
  assert.match(source, /from "\.\/chat\/ChatPresentationLayout"/);
  assert.doesNotMatch(source, /setIsHistoryLoading/);
});
