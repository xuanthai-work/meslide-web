import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testsDir, "..");

const sidePanelSource = readFileSync(
  path.join(
    root,
    "app/(presentation-generator)/presentation/components/SidePanel.tsx"
  ),
  "utf8"
);
const keyboardSource = readFileSync(
  path.join(
    root,
    "components/slide-editor/surface/useTemplateV2Keyboard.ts"
  ),
  "utf8"
);

test("SidePanel honors e.defaultPrevented before deleting a slide", () => {
  assert.match(
    sidePanelSource,
    /if \(e\.defaultPrevented\) return;/,
    "handleKeyDown must return early when the event was already handled"
  );
});

test("SidePanel never deletes a slide when the event starts in the editor stage", () => {
  const isInEditorStage = /const isInEditorStage = Boolean\(/.test(
    sidePanelSource
  );
  assert.ok(isInEditorStage, "SidePanel must detect the canvas editor region");
  for (const selector of [
    "[data-presentation-slides-scroll-container]",
    ".konvajs-content",
    "[data-testid='slide-content']",
    ".slide-edit-stage",
    "[data-template-v2-selection-overlay]",
  ]) {
    assert.ok(
      sidePanelSource.includes(`target?.closest?.("${selector}")`),
      `SidePanel must exclude events from ${selector}`
    );
  }
  assert.match(
    sidePanelSource,
    /if \(isInEditorStage\) return;/,
    "editor-stage events must be excluded from slide deletion"
  );
});

test("SidePanel only deletes a slide from the thumbnail list", () => {
  assert.ok(
    sidePanelSource.includes(
      'target?.closest?.("[data-slide-thumbnail-scroll-container]")'
    ),
    "deletion must be tied to the thumbnail scroll container"
  );
  assert.ok(
    /aside\[aria-label='[^']+'/.test(sidePanelSource),
    "deletion must fall back to the slide-list aside"
  );
  assert.match(
    sidePanelSource,
    /if \(!isThumbnailListFocused\) return;/,
    "a target outside the thumbnail list must not trigger slide deletion"
  );
});

test("useTemplateV2Keyboard stops propagation when deleting a selection", () => {
  const deleteEffect = keyboardSource.slice(
    keyboardSource.indexOf('event.key !== "Delete"'),
    keyboardSource.indexOf("window.addEventListener(\"keydown\", handleKeyDown, true)")
  );
  assert.match(
    deleteEffect,
    /event\.stopPropagation\(\);/,
    "Delete/Backspace with an active selection must stop propagation"
  );
  assert.match(
    deleteEffect,
    /event\.preventDefault\(\);/,
    "Delete/Backspace with an active selection must prevent the default"
  );
});

test("useTemplateV2Keyboard registers the Delete handler in the capture phase", () => {
  assert.match(
    keyboardSource,
    /window\.addEventListener\("keydown", handleKeyDown, true\);/,
    "the canvas Delete handler must run in the capture phase"
  );
  assert.match(
    keyboardSource,
    /window\.removeEventListener\("keydown", handleKeyDown, true\);/,
    "the capture-phase listener must be removed symmetrically"
  );
});
