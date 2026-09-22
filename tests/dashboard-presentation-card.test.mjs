import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("dashboard deck cards hide generation mode tags", async () => {
  const card = await read(
    "app/(presentation-generator)/(dashboard)/dashboard/components/PresentationCard.tsx",
  );

  assert.match(card, /router\.push\(`\/presentation\?id=\$\{id\}`\)/);
  assert.doesNotMatch(card, /presentationModeForRouting|generation_mode|type=\$\{/);
  assert.doesNotMatch(card, /font-semibold capitalize shadow-sm backdrop-blur-sm/);
});
