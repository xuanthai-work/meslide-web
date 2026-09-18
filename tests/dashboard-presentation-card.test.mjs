import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("dashboard deck cards hide generation mode tags", async () => {
  const card = await read(
    "app/(presentation-generator)/(dashboard)/dashboard/components/PresentationCard.tsx",
  );

  assert.match(card, /const presentationModeForRouting/);
  assert.match(card, /type=\$\{presentationModeForRouting\}/);
  assert.doesNotMatch(card, />\s*\{presentationModeForRouting\}\s*</);
  assert.doesNotMatch(card, /font-semibold capitalize shadow-sm backdrop-blur-sm/);
});
