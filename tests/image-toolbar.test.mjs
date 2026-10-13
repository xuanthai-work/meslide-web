import assert from "node:assert/strict";
import test from "node:test";

const fitModule = () => import("../components/slide-editor/images/image-fit.ts");

test("sizeForAspectRatio preserves area and matches the requested ratio", async () => {
  const { sizeForAspectRatio } = await fitModule();

  const wide = sizeForAspectRatio(400, 300, 16 / 9);
  assert.ok(wide);
  assert.equal(wide.width, Math.round(wide.height * (16 / 9)));
  const wideArea = wide.width * wide.height;
  assert.ok(Math.abs(wideArea - 400 * 300) / (400 * 300) < 0.02);

  const square = sizeForAspectRatio(400, 300, 1);
  assert.deepEqual(square, { width: 346, height: 346 });

  const portrait = sizeForAspectRatio(600, 200, 9 / 16);
  assert.ok(portrait);
  assert.equal(portrait.height, Math.round(portrait.width / (9 / 16)));
});

test("sizeForAspectRatio handles degenerate inputs safely", async () => {
  const { sizeForAspectRatio } = await fitModule();

  assert.equal(sizeForAspectRatio(0, 300, 1), null);
  assert.equal(sizeForAspectRatio(400, 0, 16 / 9), null);
  assert.equal(sizeForAspectRatio(400, 300, 0), null);
  assert.equal(sizeForAspectRatio(400, 300, -1), null);
  assert.equal(sizeForAspectRatio(400, 300, Number.NaN), null);
  assert.equal(sizeForAspectRatio(400, 300, Number.POSITIVE_INFINITY), null);
});

test("sizeForNaturalRatio keeps the area and the natural ratio", async () => {
  const { sizeForNaturalRatio } = await fitModule();

  const size = sizeForNaturalRatio(400, 300, 1920, 1080);
  assert.ok(size);
  assert.ok(Math.abs(size.width / size.height - 1920 / 1080) < 1e-6);
  const area = size.width * size.height;
  assert.ok(Math.abs(area - 400 * 300) / (400 * 300) < 1e-6);

  assert.equal(sizeForNaturalRatio(400, 300, 0, 0), null);
  assert.equal(sizeForNaturalRatio(400, 300, Number.NaN, 1080), null);
  assert.equal(sizeForNaturalRatio(400, 0, 1920, 1080), null);
});

test("imageNaturalRatio falls back to 1 for missing or empty sizes", async () => {
  const { imageNaturalRatio } = await fitModule();

  assert.equal(imageNaturalRatio(null), 1);
  assert.equal(imageNaturalRatio({ width: 0, height: 10 }), 1);
  assert.equal(imageNaturalRatio({ width: 10, height: 0 }), 1);
  assert.equal(imageNaturalRatio({ width: 16, height: 9 }), 16 / 9);
});
