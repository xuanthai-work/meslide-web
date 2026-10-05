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

function functionBody(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `function ${name} must exist`);
  const end = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, end === -1 ? source.length : end);
}

test("isLightHexColor classifies light and dark hex colors", () => {
  const body = functionBody("isLightHexColor");
  assert.ok(body.includes('hex.length === 3'), "must support 3-digit hex");
  assert.ok(body.includes("hex.length === 6"), "must support 6-digit hex");
  assert.match(body, /0\.299 \* r \+ 0\.587 \* g \+ 0\.114 \* b > 160/);
  assert.match(body, /if \(!colorStr \|\| typeof colorStr !== "string"\) return false;/);
});

test("resolveBlockPreviewBackground picks dark background for white-text blocks", () => {
  const body = functionBody("resolveBlockPreviewBackground");
  assert.match(
    body,
    /collectBlockColors\(raw\)/,
    "must scan the block raw content for colors"
  );
  assert.match(
    body,
    /lightColors\.length > darkColors\.length && lightColors\.length > 0/,
    "light colors dominating must switch to the dark background"
  );
  assert.match(body, /"#18181B"/, "the dark contrast background is #18181B");
  assert.match(body, /"#FFFFFF"/, "the light fallback background is #FFFFFF");
  const collect = functionBody("collectBlockColors");
  for (const key of ["color", "fill", "stroke"]) {
    assert.ok(collect.includes(`"${key}"`), `collectBlockColors must read ${key}`);
  }
});

test("blockPreviewLayout assigns the background into the preview layout", () => {
  const body = functionBody("blockPreviewLayout");
  assert.match(body, /background = "#FFFFFF"/, "the default background is white");
  assert.match(
    body,
    /^\s*background,\s*$/m,
    "the layout object must carry the background field"
  );
  assert.match(body, /components: \[block\.raw\]/);
});

test("BlockThumbnail renders the preview with the resolved background", () => {
  const start = source.indexOf("function BlockThumbnail(");
  assert.notEqual(start, -1, "BlockThumbnail must exist");
  const body = source.slice(start, source.indexOf("function BlockVariantButton", start));
  assert.match(
    body,
    /resolveBlockPreviewBackground\(block\.raw\)/,
    "BlockThumbnail must resolve the contrast background from the block"
  );
  assert.match(
    body,
    /blockPreviewLayout\(block, previewBg\)/,
    "the resolved background must flow into the layout"
  );
  assert.match(
    body,
    /style=\{\{ backgroundColor: previewBg \}\}/,
    "the preview shell must use the resolved background"
  );
  assert.ok(
    !/className="template-block-preview[^"]*bg-white/.test(body),
    "the preview shell must not be hard-coded to bg-white anymore"
  );
});

test("the forced gray hover background is gone", () => {
  assert.ok(
    !source.includes("#a2a2a3"),
    "the CSS must not force background #a2a2a3 on hover"
  );
  assert.match(
    source,
    /\.template-block-variant:hover \.template-block-preview \{\s*\n\s*filter: brightness\(1\.08\);/,
    "hover must use a subtle brightness lift instead"
  );
});
