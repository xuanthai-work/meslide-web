import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");

registerHooks({
  resolve(specifier, context, nextResolve) {
    const tryCandidates = (base) => {
      for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, `${base}/index.ts`]) {
        if (!existsSync(candidate)) continue;
        return {
          url: pathToFileURL(candidate).href,
          shortCircuit: true,
          format: candidate.endsWith(".mjs") ? "module" : "module-typescript",
        };
      }
      return null;
    };
    if (specifier.startsWith("@/")) {
      return tryCandidates(path.join(root, specifier.slice(2))) ?? nextResolve(specifier, context);
    }
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL &&
      !/\.[cm]?[jt]sx?$/.test(specifier)
    ) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      return tryCandidates(path.resolve(parentDir, specifier)) ?? nextResolve(specifier, context);
    }
    return nextResolve(specifier, context);
  },
});

const notes = {
  name: "notes.pdf",
  size: 1200,
  lastModified: 10,
  type: "application/pdf",
};

test("a language change reuses the upload and a new file uploads again", async () => {
  const { LanguageType } = await import("../app/(presentation-generator)/upload/language.ts");
  const {
    decompositionKeyFor,
    fileFingerprint,
    planDocumentPreparation,
  } = await import("../app/(presentation-generator)/upload/services/document-preparation.ts");
  const fingerprint = fileFingerprint([notes]);
  const english = decompositionKeyFor(fingerprint, LanguageType.English);
  const vietnamese = decompositionKeyFor(fingerprint, LanguageType.Vietnamese);
  assert.notEqual(english, vietnamese);
  assert.equal(fileFingerprint([notes]), fingerprint);

  assert.equal(
    planDocumentPreparation({
      fileFingerprint: fingerprint,
      decompositionKey: english,
      cachedDecompositionKey: english,
      uploadedFingerprint: fingerprint,
    }),
    "use-cache",
  );
  assert.equal(
    planDocumentPreparation({
      fileFingerprint: fingerprint,
      decompositionKey: vietnamese,
      cachedDecompositionKey: english,
      uploadedFingerprint: fingerprint,
    }),
    "decompose",
  );
  const renamed = fileFingerprint([{ ...notes, name: "other.pdf" }]);
  assert.equal(
    planDocumentPreparation({
      fileFingerprint: renamed,
      decompositionKey: decompositionKeyFor(renamed, LanguageType.English),
      cachedDecompositionKey: english,
      uploadedFingerprint: fingerprint,
    }),
    "upload-and-decompose",
  );
});

test("documents above 100 MB are rejected and the create body stays on the current wire", async () => {
  const { LanguageType } = await import("../app/(presentation-generator)/upload/language.ts");
  const {
    BLANK_PRESENTATION_PATH,
    PRESENTATION_UPLOAD_MAX_BYTES,
    buildCreatePresentationBody,
    exceedsPresentationUploadLimit,
  } = await import("../app/(presentation-generator)/upload/services/document-preparation.ts");
  assert.equal(PRESENTATION_UPLOAD_MAX_BYTES, 100 * 1024 * 1024);
  assert.equal(exceedsPresentationUploadLimit(PRESENTATION_UPLOAD_MAX_BYTES), false);
  assert.equal(exceedsPresentationUploadLimit(PRESENTATION_UPLOAD_MAX_BYTES + 1), true);

  assert.deepEqual(
    buildCreatePresentationBody({
      content: "Outline this",
      n_slides: 80,
      file_paths: ["/tmp/notes.pdf"],
      language: LanguageType.Vietnamese,
      tone: "professional",
      verbosity: "standard",
      instructions: null,
      web_search: true,
    }),
    {
      content: "Outline this",
      n_slides: 50,
      file_paths: ["/tmp/notes.pdf"],
      language: "Vietnamese (Tiếng Việt)",
      tone: "professional",
      verbosity: "standard",
      instructions: null,
      include_table_of_contents: true,
      include_title_slide: true,
      web_search: true,
    },
  );
  assert.equal(BLANK_PRESENTATION_PATH, "/api/v1/ppt/presentation/create/blank");
});

test("markdown attachments are accepted and the file input advertises them", async () => {
  const {
    SUPPORTED_DOCUMENT_ACCEPT,
    SUPPORTED_DOCUMENT_EXTENSIONS,
    isAllowedDocumentName,
  } = await import(
    "../app/(presentation-generator)/upload/services/supported-documents.ts"
  );

  for (const name of ["notes.md", "notes.markdown", "READ ME.MD", "a/b/c.markdown"]) {
    assert.equal(isAllowedDocumentName(name), true, name);
  }
  // Every format the picker already accepted keeps working.
  for (const name of [
    "deck.pdf",
    "notes.txt",
    // Gating is on the real suffix, so a markdown file named .md.txt is a .txt.
    "notes.md.txt",
    "deck.pptx",
    "report.xlsx",
    "table.csv",
    "photo.JPEG",
    "scan.webp",
  ]) {
    assert.equal(isAllowedDocumentName(name), true, name);
  }
  for (const name of ["archive.zip", "legacy.doc", "movie.mp4", "archive.tar.gz", "md", ""]) {
    assert.equal(isAllowedDocumentName(name), false, name);
  }
  assert.equal(isAllowedDocumentName(null), false);
  assert.equal(isAllowedDocumentName(undefined), false);

  assert.ok(SUPPORTED_DOCUMENT_EXTENSIONS.includes(".md"));
  assert.ok(SUPPORTED_DOCUMENT_EXTENSIONS.includes(".markdown"));
  assert.equal(
    SUPPORTED_DOCUMENT_ACCEPT,
    SUPPORTED_DOCUMENT_EXTENSIONS.join(","),
  );
  assert.ok(SUPPORTED_DOCUMENT_ACCEPT.includes(".md"));
  assert.ok(SUPPORTED_DOCUMENT_ACCEPT.includes(".markdown"));
});

test("SupportingDoc gates attachments through the shared extension list", async () => {
  const supportingDoc = readFileSync(
    path.resolve(
      "app/(presentation-generator)/upload/components/SupportingDoc.tsx",
    ),
    "utf8",
  );
  // The component must not keep a second, drifting copy of the whitelist.
  assert.doesNotMatch(supportingDoc, /const ALLOWED_EXTENSIONS/);
  assert.match(supportingDoc, /isAllowedDocumentName/);
  assert.match(supportingDoc, /function isAllowedFile\([\s\S]*isAllowedDocumentName\(file\.name\)/);
  assert.match(supportingDoc, /accept=\{ACCEPT\}/);
  assert.match(supportingDoc, /candidates\.filter\(isAllowedFile\)/);
});

test("an outline that numbers its own slides reports that count", async () => {
  const { detectSlideCountFromText, MAX_NUMBER_OF_SLIDES } = await import(
    "../utils/presentationLimits.ts"
  );

  // Every separator a pasted Markdown outline realistically uses.
  for (const separator of ["\n", ":", " - ", " \u2014 ", "\r\n"]) {
    const outline = ["## Slide 1", "## Slide 2", "## Slide 3"]
      .map((line) => `${line}${separator}Body`)
      .join("\n");
    assert.equal(detectSlideCountFromText(outline), 3, JSON.stringify(separator));
  }
  // A marker alone on its line must count, not just one followed by text.
  assert.equal(detectSlideCountFromText("## Slide 1\n## Slide 2\n"), 2);
  assert.equal(detectSlideCountFromText("# Slide 01:\n## Slide 2:\n"), 2);
  assert.equal(detectSlideCountFromText("Slide 1\nSlide 2\nSlide 3"), 3);

  // Cross-references inside prose are not slide markers, so an incidental
  // mention can never pin the count.
  assert.equal(detectSlideCountFromText("See (Slide 3) and (Slide 10)."), null);
  assert.equal(detectSlideCountFromText("- Slide 1 is a good start\n- Slide 2 too\n"), null);
  // One marker is prose, not an outline.
  assert.equal(detectSlideCountFromText("## Slide 1 - only one"), null);
  assert.equal(detectSlideCountFromText("Build a quarterly deck"), null);
  assert.equal(detectSlideCountFromText(""), null);
  assert.equal(detectSlideCountFromText(null), null);
  assert.equal(detectSlideCountFromText(undefined), null);

  // Gapped or restarted numbering falls back to the number of markers seen
  // rather than inventing the missing slides.
  assert.equal(detectSlideCountFromText("Slide 1\nSlide 3\nSlide 7"), 3);
  assert.equal(detectSlideCountFromText("Slide 1\nSlide 1\nSlide 2"), 2);

  // The count is clamped like every other slide count on the page.
  const huge = Array.from(
    { length: MAX_NUMBER_OF_SLIDES + 30 },
    (_, index) => `## Slide ${index + 1}`,
  ).join("\n");
  assert.equal(detectSlideCountFromText(huge), MAX_NUMBER_OF_SLIDES);
});

