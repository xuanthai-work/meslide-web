import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = path.resolve(import.meta.dirname, "..");

registerHooks({
  resolve(specifier, context, nextResolve) {
    const tryCandidates = (base) => {
      for (const candidate of [
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.js`,
        `${base}/index.ts`,
      ]) {
        if (!existsSync(candidate)) continue;
        return {
          url: pathToFileURL(candidate).href,
          shortCircuit: true,
          format: "module-typescript",
        };
      }
      return null;
    };

    if (specifier.startsWith("@/")) {
      return (
        tryCandidates(path.join(root, specifier.slice(2))) ??
        nextResolve(specifier, context)
      );
    }
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL &&
      !/\.[cm]?[jt]sx?$/.test(specifier)
    ) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      return (
        tryCandidates(path.resolve(parentDir, specifier)) ??
        nextResolve(specifier, context)
      );
    }
    return nextResolve(specifier, context);
  },
});

test("arrow keys map to the correct nudge vector", async () => {
  const { arrowNudgeDelta } = await import(
    "../components/slide-editor/surface/useTemplateV2Keyboard.ts"
  );

  assert.deepEqual(arrowNudgeDelta("ArrowLeft", false), { dx: -1, dy: 0 });
  assert.deepEqual(arrowNudgeDelta("ArrowRight", false), { dx: 1, dy: 0 });
  assert.deepEqual(arrowNudgeDelta("ArrowUp", false), { dx: 0, dy: -1 });
  assert.deepEqual(arrowNudgeDelta("ArrowDown", false), { dx: 0, dy: 1 });
});

test("holding shift nudges by 10px", async () => {
  const { arrowNudgeDelta } = await import(
    "../components/slide-editor/surface/useTemplateV2Keyboard.ts"
  );

  assert.deepEqual(arrowNudgeDelta("ArrowLeft", true), { dx: -10, dy: 0 });
  assert.deepEqual(arrowNudgeDelta("ArrowRight", true), { dx: 10, dy: 0 });
  assert.deepEqual(arrowNudgeDelta("ArrowUp", true), { dx: 0, dy: -10 });
  assert.deepEqual(arrowNudgeDelta("ArrowDown", true), { dx: 0, dy: 10 });
});

test("non-arrow keys never nudge", async () => {
  const { arrowNudgeDelta } = await import(
    "../components/slide-editor/surface/useTemplateV2Keyboard.ts"
  );

  assert.equal(arrowNudgeDelta("a", false), null);
  assert.equal(arrowNudgeDelta("Enter", true), null);
  assert.equal(arrowNudgeDelta("Delete", false), null);
});

test("the keyboard hook isolates text editing and batches history", () => {
  const source = readFileSync(
    path.join(root, "components/slide-editor/surface/useTemplateV2Keyboard.ts"),
    "utf8",
  );

  assert.match(source, /isEditableTarget\(event\.target\)/);
  assert.match(source, /isInlineEditing\?\.\(\)/);
  assert.match(source, /pushHistory = !isNudgingRef\.current/);
  assert.match(source, /isNudgingRef\.current = false/);
  assert.match(source, /addEventListener\("keyup", handleArrowKeyUp, true\)/);
});

test("the shortcut table exposes the nudge and nudge-large chords", async () => {
  const { EDITOR_SHORTCUT_SECTIONS } = await import(
    "../components/slide-editor/shortcuts/editorShortcuts.ts"
  );

  const shortcuts = EDITOR_SHORTCUT_SECTIONS.flatMap(
    (section) => section.shortcuts,
  );
  const nudge = shortcuts.find((shortcut) => shortcut.id === "nudge");
  const nudgeLarge = shortcuts.find((shortcut) => shortcut.id === "nudge-large");

  assert.ok(nudge, "nudge shortcut must exist");
  assert.ok(nudgeLarge, "nudge-large shortcut must exist");
  assert.deepEqual(nudge.chords, [
    ["ArrowLeft"],
    ["ArrowRight"],
    ["ArrowUp"],
    ["ArrowDown"],
  ]);
  assert.deepEqual(nudgeLarge.chords, [
    ["Shift", "ArrowLeft"],
    ["Shift", "ArrowRight"],
    ["Shift", "ArrowUp"],
    ["Shift", "ArrowDown"],
  ]);
});
