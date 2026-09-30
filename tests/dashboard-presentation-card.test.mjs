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

test("dashboard deck cards expose a quick present button that enters present mode", async () => {
  const card = await read(
    "app/(presentation-generator)/(dashboard)/dashboard/components/PresentationCard.tsx",
  );

  // Present mode is a query-param state on the editor route, not a separate route.
  assert.match(
    card,
    /router\.push\(`\/presentation\?id=\$\{id\}&mode=present&slide=0`\)/,
  );
  // The card body itself is clickable, so the button must not bubble to it.
  assert.match(card, /const handleQuickPresent = \(e: React\.MouseEvent\) => \{[\s\S]*?e\.stopPropagation\(\);/);
  // Hidden for decks that cannot render and for empty decks.
  assert.match(card, /\{!isUnsupported && hasSlides && \(/);
});

test("quick present copy is inlined in Vietnamese", async () => {
  const card = await read(
    "app/(presentation-generator)/(dashboard)/dashboard/components/PresentationCard.tsx",
  );

  assert.match(card, /content=\{"Trình chiếu nhanh"\}/);
  assert.match(card, /aria-label=\{"Trình chiếu nhanh bộ slide này"\}/);
});
