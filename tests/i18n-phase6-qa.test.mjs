import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildSafeExportFileName } from "../utils/exportFilename.ts";
import {
  includesSearchText,
  normalizeSearchText,
} from "../utils/normalizeSearchText.ts";

const VIETNAMESE_GLYPHS =
  "ăâđêôơưĂÂĐÊÔƠƯáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ";

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function ttfHasCodePoint(buffer, codePoint) {
  const numTables = buffer.readUInt16BE(4);
  let cmapOffset = -1;
  for (let index = 0; index < numTables; index += 1) {
    const record = 12 + index * 16;
    if (buffer.toString("ascii", record, record + 4) === "cmap") {
      cmapOffset = buffer.readUInt32BE(record + 8);
      break;
    }
  }
  if (cmapOffset < 0) return false;

  const subtableCount = buffer.readUInt16BE(cmapOffset + 2);
  for (let index = 0; index < subtableCount; index += 1) {
    const record = cmapOffset + 4 + index * 8;
    const table = cmapOffset + buffer.readUInt32BE(record + 4);
    const format = buffer.readUInt16BE(table);

    if (format === 12) {
      const groupCount = buffer.readUInt32BE(table + 12);
      for (let group = 0; group < groupCount; group += 1) {
        const start = buffer.readUInt32BE(table + 16 + group * 12);
        const end = buffer.readUInt32BE(table + 20 + group * 12);
        if (codePoint >= start && codePoint <= end) return true;
      }
    }

    if (format === 4 && codePoint <= 0xffff) {
      const segmentCount = buffer.readUInt16BE(table + 6) / 2;
      const endCodes = table + 14;
      const startCodes = endCodes + segmentCount * 2 + 2;
      for (let segment = 0; segment < segmentCount; segment += 1) {
        const start = buffer.readUInt16BE(startCodes + segment * 2);
        const end = buffer.readUInt16BE(endCodes + segment * 2);
        if (codePoint >= start && codePoint <= end) return true;
      }
    }
  }
  return false;
}

test("bundled Inter contains the Vietnamese glyph repertoire", async () => {
  const font = await readFile(new URL("../app/fonts/Inter.ttf", import.meta.url));
  const missing = [...VIETNAMESE_GLYPHS].filter(
    (character) => !ttfHasCodePoint(font, character.codePointAt(0)),
  );
  assert.deepEqual(missing, []);
});

test("UI fonts use Vietnamese-capable Manrope first, not Syne", async () => {
  const [layout, globals, tailwind, sonner] = await Promise.all([
    source("app/layout.tsx"),
    source("app/globals.css"),
    source("tailwind.config.ts"),
    source("components/ui/sonner.tsx"),
  ]);
  assert.match(layout, /Manrope\([\s\S]*?subsets: \["latin", "vietnamese"\]/);
  assert.match(layout, /Unbounded\([\s\S]*?subsets: \["latin", "vietnamese"\]/);
  assert.doesNotMatch(layout, /Syne\s*\(/);
  assert.doesNotMatch(layout, /--font-syne/);
  assert.match(
    globals,
    /--gslide-font-ui:\s*var\(--font-manrope\),\s*var\(--font-inter\)/,
  );
  assert.match(globals, /font-family:\s*var\(--gslide-font-ui\)/);
  assert.match(tailwind, /syne:\s*\["var\(--gslide-font-ui\)"\]/);
  assert.match(tailwind, /instrument_sans:\s*\["var\(--gslide-font-ui\)"\]/);
  assert.match(sonner, /var\(--gslide-font-ui\)/);
  assert.doesNotMatch(sonner, /var\(--font-syne\)/);
});

test("search treats canonically equivalent Vietnamese text identically", () => {
  const nfc = "Cộng đồng thiết kế";
  const nfd = nfc.normalize("NFD");
  assert.notEqual(nfc, nfd);
  assert.equal(normalizeSearchText(nfd), normalizeSearchText(nfc));
  assert.equal(includesSearchText("MẪU CỘNG ĐỒNG", "mẫu cộng đồng"), true);
  assert.equal(includesSearchText(nfd, "thiết kế"), true);
});

test("export filenames preserve and normalize Vietnamese titles", () => {
  assert.equal(
    buildSafeExportFileName("  Chiến lược tăng trưởng 2026  ", "pptx"),
    "Chiến-lược-tăng-trưởng-2026.pptx",
  );
  assert.equal(
    buildSafeExportFileName("Định hướng quý I".normalize("NFD"), "pdf"),
    "Định-hướng-quý-I.pdf",
  );
  assert.equal(buildSafeExportFileName("../../", "pdf"), "presentation.pdf");
});

test("title save/export and narrow-width controls retain Phase 6 contracts", async () => {
  const [header, actionBar] = await Promise.all([
    source("app/(presentation-generator)/presentation/components/PresentationHeader.tsx"),
    source("app/(presentation-generator)/template-preview/components/editor/EditorActionBar.tsx"),
  ]);
  assert.match(header, /draftTitle\.normalize\("NFC"\)\.trim\(\)/);
  assert.match(header, /buildSafeExportFileName\(/);
  assert.match(header, /w-\[calc\(100vw-2rem\)\] max-w-\[360px\]/);
  assert.match(header, /hidden sm:inline/);
  assert.match(actionBar, /max-w-full[^"\n]*overflow-x-auto/);
  assert.doesNotMatch(header, /w-\[450px\]/);
});
