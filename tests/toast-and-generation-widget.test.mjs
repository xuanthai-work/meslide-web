import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testsDir, "..");

const sonnerSource = readFileSync(
  path.join(root, "components/ui/sonner.tsx"),
  "utf8"
);
const generationStatusSource = readFileSync(
  path.join(root, "app/(presentation-generator)/components/GenerationStatusBar.tsx"),
  "utf8"
);
const presentationPageSource = readFileSync(
  path.join(
    root,
    "app/(presentation-generator)/presentation/components/PresentationPage.tsx"
  ),
  "utf8"
);

test("the toast close affordance is an X icon, not the Got it! label", () => {
  assert.ok(
    sonnerSource.includes("close: <X aria-hidden=\"true\" className=\"h-4 w-4\" />"),
    "defaultIcons.close must render the X icon"
  );
  assert.ok(
    !sonnerSource.includes("Got it!"),
    "the Got it! label must be removed from the close button"
  );
});

test("the toast CSS hides the close button whenever an action button exists", () => {
  const rule = sonnerSource.indexOf(
    "[data-sonner-toast]:has([data-button]) [data-close-button]"
  );
  assert.notEqual(rule, -1, "the :has([data-button]) close-hide rule must exist");
  const block = sonnerSource.slice(rule, rule + 200);
  assert.match(block, /display:\s*none\s*!important/);
});

test("the toast card styles use pastel diagonal stripes for every type", () => {
  for (const type of ["success", "info", "warning", "error"]) {
    const rule = sonnerSource.indexOf(
      `[data-sonner-toast][data-type="${type}"] {`
    );
    assert.notEqual(rule, -1, `a gradient rule for ${type} must exist`);
    const block = sonnerSource.slice(rule, sonnerSource.indexOf("}", rule));
    assert.match(
      block,
      /repeating-linear-gradient\(135deg/,
      `${type} must carry the diagonal stripe texture`
    );
    assert.match(
      block,
      /linear-gradient\(to right/,
      `${type} must carry the pastel horizontal gradient`
    );
  }
  assert.match(sonnerSource, /border-radius:\s*14px\s*!important/);
});

test("GenerationStatusBar renders the floating pill widget itself", () => {
  assert.ok(
    generationStatusSource.includes('data-testid="generation-status-widget"'),
    "the widget must render data-testid generation-status-widget"
  );
  assert.ok(
    generationStatusSource.includes("generation-status-widget"),
    "the widget must carry the generation-status-widget class hook"
  );
  assert.ok(
    generationStatusSource.includes("pointer-events-auto"),
    "the pill must re-enable pointer events for its buttons"
  );
  assert.ok(
    !generationStatusSource.includes("notify"),
    "the widget must not publish through the global Sonner toaster"
  );
  assert.ok(
    !generationStatusSource.includes("GENERATION_TOAST_ID"),
    "the old stable toast ID must be removed"
  );
});

test("GenerationStatusBar shows Dừng while generating and Thử lại after failure", () => {
  assert.match(
    generationStatusSource,
    /actions\.push\("stop"\)/,
    "generating must surface the Dừng action"
  );
  assert.match(generationStatusSource, /"Tiếp tục chờ"/);
  assert.match(generationStatusSource, /"Thử lại"/);
  assert.match(generationStatusSource, /"Dừng"/);
  assert.ok(
    !generationStatusSource.includes("aria-label=\"Close\""),
    "the widget must never render a close X button"
  );
  assert.match(
    generationStatusSource,
    /window\.confirm/,
    "the stop confirmation flow must be preserved"
  );
  assert.match(
    generationStatusSource,
    /needsCancelConfirm/,
    "the cancel-confirm helper must still guard the stop action"
  );
});

test("PresentationPage mounts the widget inside the gray canvas container", () => {
  const canvasAnchor = presentationPageSource.indexOf("presentationCanvasRef");
  assert.notEqual(canvasAnchor, -1);
  const afterCanvas = presentationPageSource.slice(canvasAnchor);
  assert.match(
    afterCanvas,
    /absolute right-4 top-4 z-30 pointer-events-none/,
    "the widget wrapper must sit in the canvas top-right corner"
  );
  const wrapperIndex = presentationPageSource.indexOf(
    "absolute right-4 top-4 z-30 pointer-events-none"
  );
  assert.ok(
    wrapperIndex > canvasAnchor,
    "the wrapper must appear after the canvas ref container opens"
  );
  const rootRenderIndex = presentationPageSource.indexOf("{generationStatusToast}");
  const canvasContainerIndex = presentationPageSource.indexOf(
    'className="relative h-full min-w-0 flex-1 px-3 pb-6 pt-[18px] md:px-0 max-md:ml-3"'
  );
  assert.ok(
    rootRenderIndex > canvasContainerIndex,
    "the widget must be mounted inside the gray canvas container"
  );
  assert.equal(
    presentationPageSource.split("{generationStatusToast}").length - 1,
    1,
    "generationStatusToast must be rendered exactly once"
  );
});
