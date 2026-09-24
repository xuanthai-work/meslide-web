import assert from "node:assert/strict";
import { existsSync } from "node:fs";
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
