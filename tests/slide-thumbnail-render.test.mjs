import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const CARD_PATH =
  "app/(presentation-generator)/presentation/components/SlideThumbnailCard.tsx";

async function readCard() {
  return readFile(new URL(`../${CARD_PATH}`, import.meta.url), "utf8");
}

test("slide thumbnail card renders the Konva canvas, not the HTML preview", async () => {
  const source = await readCard();

  assert.doesNotMatch(source, /TemplateV2HtmlSlidePreview/);
  assert.doesNotMatch(source, /shouldRenderTemplateV2HtmlPreview/);
  assert.match(source, /V1ContentRender/);
  assert.match(source, /isEditMode=\{false\}/);
});

test("slide thumbnail card keeps near-viewport culling", async () => {
  const source = await readCard();

  assert.match(source, /useNearViewport/);
  assert.match(source, /isNearViewport/);
  assert.match(source, /data-slide-thumbnail-active/);
});

test("slide thumbnail card no longer depends on presentationVersion", async () => {
  const source = await readCard();

  assert.doesNotMatch(source, /presentationVersion/);
});
