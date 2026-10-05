import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testsDir, "..");

const source = readFileSync(
  path.join(
    root,
    "app/(presentation-generator)/presentation/components/PresentationActions.tsx"
  ),
  "utf8"
);

function componentBody(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `component ${name} must exist`);
  return source.slice(start, start + 4500);
}

test("BlockGroupCard tracks its card element and previous expanded state", () => {
  const body = componentBody("BlockGroupCard");
  assert.match(
    body,
    /const cardRef = useRef<HTMLElement \| null>\(null\);/,
    "BlockGroupCard must hold a cardRef to its section element"
  );
  assert.match(
    body,
    /const wasExpandedRef = useRef\(false\);/,
    "BlockGroupCard must remember whether the card was expanded"
  );
  assert.match(
    body,
    /ref=\{cardRef\}/,
    "cardRef must be attached to the card element"
  );
});

test("BlockGroupCard cards carry a scroll top padding", () => {
  const body = componentBody("BlockGroupCard");
  assert.match(
    body,
    /scroll-mt-4/,
    "the card section must reserve a scroll margin so the top is not flush"
  );
});

test("BlockGroupCard scrolls the card back into view when it collapses", () => {
  const body = componentBody("BlockGroupCard");
  const effectStart = body.indexOf("useEffect(() => {");
  assert.notEqual(effectStart, -1, "an expanded-effect must exist");
  const effect = body.slice(
    effectStart,
    body.indexOf("}, [expanded]);", effectStart)
  );
  assert.match(
    effect,
    /wasExpandedRef\.current && !expanded/,
    "the scroll must trigger on the expanded -> collapsed transition"
  );
  assert.match(
    effect,
    /cardRef\.current\?\.scrollIntoView/,
    "the collapse must scroll the card into view"
  );
  assert.match(effect, /behavior:\s*"smooth"/);
  assert.match(effect, /block:\s*"start"/);
  assert.match(
    effect,
    /wasExpandedRef\.current = expanded;/,
    "the previous state must be synced after each change"
  );
});

test("the collapse effect keeps re-render scope minimal", () => {
  const body = componentBody("BlockGroupCard");
  const effectStart = body.indexOf("useEffect(() => {");
  const effect = body.slice(
    effectStart,
    body.indexOf("}, [expanded]);", effectStart)
  );
  assert.ok(!effect.includes("onInsertBlock"));
  assert.ok(!effect.includes("group."));
});
