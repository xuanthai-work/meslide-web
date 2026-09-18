import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("lint ceiling ratchets remaining warnings and only stays or goes down", async () => {
  const pkg = JSON.parse(await read("package.json"));
  const match = String(pkg.scripts.lint).match(/--max-warnings\s+(\d+)/);
  assert.ok(match, "lint script must pass --max-warnings");
  assert.ok(
    Number(match[1]) <= 19,
    "warning ceiling must not rise above the current no-img-element baseline",
  );
});

test("web CI stays aligned with npm run check plus build and Cypress", async () => {
  const workflow = await read(".github/workflows/test.yml");
  for (const command of [
    "npm ci",
    "npm test",
    "npm run check:i18n-copy",
    "npm run typecheck",
    "npm run lint",
    "npm run deadcode",
    "npm run build",
    "npx cypress run --component --browser electron",
  ]) {
    assert.match(workflow, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(workflow, /GSLIDE_FEATURE_SMART_MODE:\s*"true"/);
  assert.match(workflow, /GSLIDE_FEATURE_COMMUNITY:\s*"true"/);
});

test("Knip ignoreDependencies keep an owner comment", async () => {
  const knip = await read("knip.jsonc");
  assert.match(knip, /postcss\.config\.mjs/);
  assert.match(knip, /next\.config\.mjs/);
  assert.match(knip, /Owner: web platform/);
  for (const name of ["postcss", "postcss-load-config", "sharp"]) {
    const block = knip.slice(
      knip.indexOf("ignoreDependencies"),
      knip.lastIndexOf("]"),
    );
    assert.match(block, new RegExp(`"${name}"`));
  }
});
