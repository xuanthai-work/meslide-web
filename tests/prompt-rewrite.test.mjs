import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const CLIENT_PATH =
  "app/(presentation-generator)/services/api/presentation-generation.ts";
const UPLOAD_PAGE_PATH =
  "app/(presentation-generator)/upload/components/UploadPage.tsx";
const OUTLINE_COMPOSER_PATH =
  "app/(presentation-generator)/upload/components/OutlineComposer.tsx";
const SUPPORTING_DOC_PATH =
  "app/(presentation-generator)/upload/components/SupportingDoc.tsx";

/**
 * Task 4 — prompt-rewrite API boundary contract. `rewritePrompt` must POST to
 * `/api/v1/ppt/prompt/rewrite` through the shared helpers, serialize the
 * camelCase params to the backend wire names (`n_slides`, legacy language
 * display string), forward an optional AbortSignal, and reject empty rewrite
 * payloads.
 */

/**
 * The API client cannot be imported directly by the strip-only test runner:
 * its dependency chain includes non-erasable `enum` syntax
 * (`upload/type.ts`) and `@/` path aliases that Node does not resolve. The
 * behavioral tests therefore run the real module in a child Node process
 * with `--experimental-transform-types` (enum transform) plus a resolve hook
 * that maps `@/…` to the repo root and adds TS extensions to extensionless
 * relative specifiers — then assert against a stubbed global `fetch`.
 */
const DRIVER = String.raw`
import { registerHooks } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

registerHooks({
  resolve: function (specifier, context, nextResolve) {
    function tryCandidates(base) {
      const candidates = [
        base + ".ts",
        base + ".tsx",
        base + ".js",
        base + ".mjs",
        base + "/index.ts",
      ];
      for (const candidate of candidates) {
        if (existsSync(candidate)) {
          return {
            url: pathToFileURL(candidate).href,
            shortCircuit: true,
            format: "module-typescript",
          };
        }
      }
      return null;
    }

    let resolved = null;
    if (specifier.startsWith("@/")) {
      resolved = tryCandidates(path.join(root, specifier.slice(2)));
    } else if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL &&
      !/\.[cm]?[jt]sx?$/.test(specifier)
    ) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      resolved = tryCandidates(path.resolve(parentDir, specifier));
    }
    return resolved ?? nextResolve(specifier, context);
  },
});

const scenario = process.env.REWRITE_TEST_SCENARIO;
const payloads = {
  valid: { rewritten_prompt: "REWRITTEN PROMPT" },
  empty: { rewritten_prompt: "" },
  whitespace: { rewritten_prompt: "   \n\t " },
  missing: {},
};

let currentSignal = null;
const calls = [];

globalThis.fetch = async (url, init) => {
  calls.push({
    url: String(url),
    method: init.method,
    headers: init.headers,
    body: JSON.parse(init.body),
    cache: init.cache,
    signalForwarded:
      !!currentSignal && init.signal === currentSignal,
  });
  const response = {
    ok: true,
    status: 200,
    json: async () => payloads[scenario] ?? payloads.valid,
  };
  currentSignal = null;
  return response;
};

const mod = await import(
  pathToFileURL(
    path.join(
      root,
      "app/(presentation-generator)/services/api/presentation-generation.ts"
    )
  ).href
);

if (scenario === "request") {
  const controller = new AbortController();
  currentSignal = controller.signal;
  const result = await mod.PresentationGenerationApi.rewritePrompt({
    prompt: "Xin chao",
    language: "vietnamese",
    nSlides: 12,
    signal: controller.signal,
  });
  const defaultsResult = await mod.PresentationGenerationApi.rewritePrompt({
    prompt: "plain prompt",
  });
  const clampedResult = await mod.PresentationGenerationApi.rewritePrompt({
    prompt: "clamped",
    nSlides: 99,
  });
  const revisionResult = await mod.PresentationGenerationApi.rewritePrompt({
    prompt: "Xin chao",
    previousPrompt: "  Bản trước  ",
  });
  console.log(
    JSON.stringify({
      ok: true,
      calls,
      result,
      defaultsResult,
      clampedResult,
      revisionResult,
    })
  );
} else {
  try {
    await mod.PresentationGenerationApi.rewritePrompt({
      prompt: "Xin chao",
    });
    console.log(JSON.stringify({ ok: true, rejected: false }));
  } catch (error) {
    console.log(
      JSON.stringify({
        ok: true,
        rejected: true,
        name: error.name,
        message: error.message,
      })
    );
  }
}
`;

function runScenario(scenario) {
  const child = spawnSync(
    process.execPath,
    [
      "--experimental-transform-types",
      "--no-warnings",
      "--input-type=module",
      "-e",
      DRIVER,
    ],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      encoding: "utf8",
      env: { ...process.env, REWRITE_TEST_SCENARIO: scenario },
    }
  );
  assert.equal(child.status, 0, `driver stderr: ${child.stderr}`);
  const output = child.stdout
    .split("\n")
    .filter((line) => line.startsWith("{"))
    .pop();
  return JSON.parse(output);
}

test("rewritePrompt targets the prompt rewrite endpoint through the shared helpers", async () => {
  const source = await read(CLIENT_PATH);
  const methodStart = source.indexOf("static async rewritePrompt");
  const methodEnd = source.indexOf("static async createBlankPresentation");
  assert.ok(methodStart !== -1, "rewritePrompt method is missing");
  const method = source.slice(methodStart, methodEnd);

  assert.match(method, /getApiUrl\(`\/api\/v1\/ppt\/prompt\/rewrite`\)/);
  assert.match(method, /method:\s*"POST"/);
  assert.match(method, /headers:\s*getHeader\(\)/);
  assert.match(method, /ApiResponseHandler\.handleResponse/);
  // The camelCase params are serialized to the backend wire names.
  assert.match(method, /n_slides:\s*limitedSlideCount/);
  assert.match(method, /language:\s*toLegacyLanguageValue\(language\)/);
  // The optional AbortSignal is forwarded to fetch.
  assert.match(method, /signal,?\s*\n/);
  // An empty rewrite result is rejected, not surfaced to the caller.
  assert.match(method, /rewritten_prompt/);
  assert.match(method, /\.trim\(\)/);
  // The client never touches upload state.
  assert.doesNotMatch(method, /dispatch|useDispatch|store\./);
});

test("rewritePrompt sends the documented request and returns the rewritten text", async () => {
  const run = runScenario("request");

  assert.equal(run.result, "REWRITTEN PROMPT");
  assert.equal(run.calls.length, 4);

  const [request, defaults, clamped, revision] = run.calls;

  assert.ok(request.url.endsWith("/api/v1/ppt/prompt/rewrite"));
  assert.equal(request.method, "POST");
  assert.equal(request.cache, "no-cache");
  assert.equal(request.headers["Content-Type"], "application/json");
  assert.equal(request.signalForwarded, true);
  assert.deepEqual(request.body, {
    prompt: "Xin chao",
    language: "Vietnamese (Tiếng Việt)",
    n_slides: 12,
  });

  // Omitted options serialize to null on the wire, not `undefined`.
  assert.deepEqual(defaults.body, {
    prompt: "plain prompt",
    language: null,
    n_slides: null,
  });
  assert.equal(defaults.signalForwarded, false);

  // Slide counts above MAX_NUMBER_OF_SLIDES are clamped, as in createPresentation.
  assert.equal(clamped.body.n_slides, 50);
  assert.equal(request.body.previous_prompt, undefined);
  assert.equal(run.revisionResult, "REWRITTEN PROMPT");
  assert.deepEqual(revision.body, {
    prompt: "Xin chao",
    language: null,
    n_slides: null,
    previous_prompt: "Bản trước",
  });
});

test("rewritePrompt rejects an empty rewritten_prompt", async () => {
  const run = runScenario("empty");
  assert.equal(run.rejected, true);
  assert.match(run.message, /rewritten prompt/i);
});

test("rewritePrompt rejects a whitespace-only rewritten_prompt", async () => {
  const run = runScenario("whitespace");
  assert.equal(run.rejected, true);
  assert.match(run.message, /rewritten prompt/i);
});

test("rewritePrompt rejects a response without rewritten_prompt", async () => {
  const run = runScenario("missing");
  assert.equal(run.rejected, true);
  assert.match(run.message, /rewritten prompt/i);
});

/**
 * Task 6 — outline-generation orchestration contract (source assertions in
 * the established UploadPage test style). Pins the load-bearing invariants:
 * one AbortController + a monotonically increasing request ID so a
 * superseded or too-late response is discarded, the user-safe localized
 * error (raw error text goes to the console only), and the idea in box 1
 * never being overwritten by the result written into box 2.
 */
test("UploadPage orchestrates outline generation with abort and request-ID guards", async () => {
  const page = await read(UPLOAD_PAGE_PATH);
  const handlerStart = page.indexOf("const handleGenerateOutline");
  const handlerEnd = page.indexOf("const getGenerationDestination");
  assert.ok(handlerStart !== -1, "handleGenerateOutline is missing");
  const handler = page.slice(handlerStart, handlerEnd);

  // Plan-mandated orchestration state. There is no separate result buffer:
  // the outline lands in `config.prompt` (box 2) and stays user-editable.
  assert.match(page, /const \[isRewriting, setIsRewriting\] = useState\(false\)/);
  assert.match(page, /const \[rewriteError, setRewriteError\] = useState<string \| null>\(null\)/);
  assert.doesNotMatch(
    page,
    /rewrittenPrompt|rewrittenFromContextKey|isRewriteFresh|isRewriteStale/
  );

  // One AbortController plus a monotonically increasing request ID.
  assert.match(page, /useRef<AbortController \| null>\(null\)/);
  assert.match(handler, /const requestId = \+\+rewriteRequestIdRef\.current;/);

  // Starting a newer request aborts the in-flight one first.
  assert.match(
    handler,
    /rewriteAbortRef\.current\?\.abort\(\);\s*const controller = new AbortController\(\)/
  );
  // The request ID check discards superseded responses and errors even
  // when the abort arrives too late for the fetch to reject.
  assert.match(handler, /if \(requestId !== rewriteRequestIdRef\.current\) return;/);

  // Box 1 seeds the request; with no idea the attached file names do. The
  // current box-2 text rides along so a second run refines instead of
  // starting over.
  assert.match(handler, /const idea = config\.instructions\.trim\(\);/);
  assert.match(handler, /const previousOutline = config\.prompt\.trim\(\);/);
  assert.match(
    handler,
    /idea \|\| files\.map\(\(file\) => file\.name\)\.join\(", "\) \|\| config\.prompt\.trim\(\);/
  );
  assert.match(handler, /previousPrompt: previousOutline \|\| undefined/);
  assert.match(handler, /if \(!seedSource\) return;/);

  // The request follows the generation boundary rules for language and the
  // effective slide count, and forwards the abort signal.
  assert.match(handler, /language: config\.language,/);
  assert.match(handler, /nSlides: parseLimitedSlideCount\(config\.slides\),/);
  assert.match(handler, /signal: controller\.signal,/);

  // The user sees the localized fallback; the raw error text is
  // console-only. A failed preparation gets its own message, distinct from
  // a failed outline generation.
  assert.match(
    handler,
    /phase === "rewriting"\s*\?\s*"upload\.prompt\.rewrite\.errorFallback"\s*:\s*"upload\.prompt\.rewrite\.preparationErrorFallback"/
  );
  assert.match(handler, /console\.error\("Error generating outline", error\)/);

  // The result is written into box 2, never over the idea in box 1, and the
  // user is told where to find it.
  assert.match(handler, /handleConfigChange\("prompt", result\);/);
  assert.doesNotMatch(handler, /handleConfigChange\("instructions"/);
  assert.match(handler, /t\("upload\.outline\.successTitle"\)/);
  assert.match(handler, /t\("upload\.outline\.successDescription"\)/);

  // The in-flight request is aborted on unmount.
  assert.match(
    page,
    /return \(\) => \{\s*rewriteRequestIdRef\.current \+= 1;\s*rewriteAbortRef\.current\?\.abort\(\);/
  );

  // Button wiring: duplicate submissions disabled while the same request is
  // active, aria-busy while loading, and the label follows the phase.
  assert.match(page, /onGenerate=\{handleGenerateOutline\}/);
  for (const key of ["phaseUploading", "phaseReading", "loading", "retryAction"]) {
    assert.match(page, new RegExp(`upload\\.prompt\\.rewrite\\.${key}`));
  }
  assert.match(page, /upload\.outline\.action/);

  // The composer receives the orchestrated state, and its retry path runs
  // the same outline flow.
  assert.match(
    page,
    /actionLabel=\{rewriteActionLabel\}\s*isGenerating=\{isRewriting\}\s*onGenerate=\{handleGenerateOutline\}/
  );
  assert.match(page, /onRetry=\{handleGenerateOutline\}/);
});

/**
 * Task 7 — generation must consume box 2 verbatim. Creating is never gated
 * on the AI outline: box-2 content or an attached document is enough, and
 * both generation branches submit the same snapshot.
 */
test("UploadPage snapshots the outline for generation and never requires a rewrite", async () => {
  const page = await read(UPLOAD_PAGE_PATH);
  const validationStart = page.indexOf("const validateConfiguration");
  const generationStart = page.indexOf("const handleGeneratePresentation");
  const documentStart = page.indexOf("const handleDocumentProcessing");
  const directStart = page.indexOf("const handleDirectPresentationGeneration");
  const errorStart = page.indexOf("const handleGenerationError");

  assert.ok(validationStart !== -1, "validateConfiguration is missing");
  assert.ok(generationStart !== -1, "handleGeneratePresentation is missing");

  const validation = page.slice(validationStart, generationStart);
  const generation = page.slice(generationStart, documentStart);
  const documentGeneration = page.slice(documentStart, directStart);
  const directGeneration = page.slice(directStart, errorStart);

  // The mandatory-rewrite gate is gone: validation only requires a language
  // and something to build the presentation from.
  assert.match(validation, /if \(!hasContentInput && !hasAttachedDocuments\) \{/);
  assert.doesNotMatch(validation, /requiredTitle|requiredDescription|isRewriteFresh/);

  assert.match(
    generation,
    /const generationConfig: PresentationConfig = \{[\s\S]*prompt: sourcePrompt,/,
  );
  assert.match(generation, /handleDocumentProcessing\(generationConfig, templateId\)/);
  assert.match(generation, /handleDirectPresentationGeneration\(generationConfig, templateId\)/);
  assert.match(generation, /resolveTemplateForCreate\(/);

  // Selected documents are always prepared for generation. The rollout flag
  // gates outline grounding only and must never remove Create file paths.
  assert.match(
    documentGeneration,
    /const prepared = await ensureDocumentsPrepared\(\s*preparationController\.signal,?\s*\)/,
  );
  assert.doesNotMatch(documentGeneration, /documentAwareRewrite/);

  for (const branch of [documentGeneration, directGeneration]) {
    assert.match(branch, /content: generationConfig\.prompt/);
    assert.match(branch, /config: generationConfig/);
    assert.doesNotMatch(branch, /content: config\??\.prompt/);
  }
});

test("Create eligibility never requires an AI rewrite and does not block attachments", async () => {
  const page = await read(UPLOAD_PAGE_PATH);
  const supportingDoc = await read(SUPPORTING_DOC_PATH);

  // Box-2 content or an attached document opens Create immediately; the AI
  // outline is an accelerator, not a prerequisite.
  assert.match(page, /const hasContentInput = sourcePrompt\.length > 0;/);
  assert.match(page, /const hasAttachedDocuments = files\.length > 0;/);
  assert.match(page, /\(!hasContentInput && !hasAttachedDocuments\);/);
  // Template availability and an in-flight request still gate Create.
  assert.match(page, /!templateReady \|\|/);
  assert.match(page, /isRewriting \|\|/);
  // The former freshness gate is gone entirely.
  assert.doesNotMatch(
    page,
    /promptRequiresRewrite|isRewriteFresh|preparedDocumentsMatchSelection/
  );
  // The explicit Create button is gated on the same `isCreateDisabled` flag.
  assert.match(page, /disabled=\{isCreateDisabled \|\| loadingState\.isLoading\}/);
  assert.match(page, /onClick=\{handleGeneratePresentation\}/);
  assert.match(page, /upload\.create\.label/);

  // Create eligibility never disables the attachment picker, so users can
  // still add the document that makes a content-free flow valid.
  assert.match(supportingDoc, /type="file"[\s\S]*disabled=\{disabled\}/);
});

test("edits to either box invalidate in-flight outline requests before updating config", async () => {
  const page = await read(UPLOAD_PAGE_PATH);
  const start = page.indexOf("const handleComposerTextChange");
  const end = page.indexOf("const handleFilesChange");
  const handler = page.slice(start, end);

  assert.ok(start !== -1, "handleComposerTextChange is missing");
  assert.match(handler, /rewriteRequestIdRef\.current \+= 1/);
  assert.match(handler, /rewriteAbortRef\.current\?\.abort\(\)/);
  assert.match(handler, /handleConfigChange\(key, value\)/);
  // Both boxes feed the request, so both must retire it.
  assert.match(
    page,
    /onIdeaChange=\{\(value\) =>\s*handleComposerTextChange\("instructions", value\)\s*\}/
  );
  assert.match(
    page,
    /onContentChange=\{\(value\) =>\s*handleComposerTextChange\("prompt", value\)\s*\}/
  );
});

test("an outline that numbers its own slides reports that count to the user", async () => {
  const page = await read(UPLOAD_PAGE_PATH);
  const composer = await read(OUTLINE_COMPOSER_PATH);

  // The count is derived from box 2 purely to show the user what to expect:
  // the backend always pins a numbered outline's sequence, so there is no
  // opt-in control to expose.
  assert.match(page, /const detectedSlidesCount = useMemo\(/);
  assert.match(page, /\(\) => detectSlideCountFromText\(sourcePrompt\)/);
  assert.match(page, /detectedSlidesCount=\{detectedSlidesCount\}/);
  assert.doesNotMatch(page, /strictOutline|effectiveSlides/);
  assert.doesNotMatch(composer, /strictOutline|type="checkbox"/);
  // The slide-count dropdown still drives the request when there is no
  // outline to defer to.
  assert.equal(
    page.match(/n_slides: parseLimitedSlideCount\(generationConfig\.slides\),/g)?.length,
    2,
    "both generation branches submit the configured slide count",
  );
  assert.match(page, /nSlides: parseLimitedSlideCount\(config\.slides\),/);
});

test("outline catalogs stay symmetric and the upload hero renders once", async () => {
  const [vi, en, page] = await Promise.all([
    read("i18n/locales/vi.ts"),
    read("i18n/locales/en.ts"),
    read(UPLOAD_PAGE_PATH),
  ]);
  const keys = [
    "ideaLabel",
    "ideaPlaceholder",
    "optionalPill",
    "contentLabel",
    "contentPlaceholder",
    "action",
    "loading",
    "successTitle",
    "successDescription",
    "orDivider",
    "detectedCount",
    "phaseUploading",
    "phaseReading",
    "retryAction",
    "errorFallback",
  ];

  for (const key of keys) {
    const keyPattern = new RegExp(`\\b${key}:`);
    assert.match(vi, keyPattern, `Vietnamese catalog misses ${key}`);
    assert.match(en, keyPattern, `English catalog misses ${key}`);
  }

  assert.equal(
    page.match(/<GSlideStudioTitle/g)?.length,
    1,
    "UploadPage must render exactly one hero",
  );
});

/**
 * Task 6 — preparation is represented as explicit phases
 * (`uploading_documents`, `reading_documents`, `rewriting`), announced
 * through a polite live region with localized strings, and the loading
 * label follows the active phase. Abort paths clear the phase, and
 * duplicate submissions are prevented while work is active.
 */
test("outline progress surfaces preparation phases accessibly", async () => {
  const [page, composer, vi, en] = await Promise.all([
    read(UPLOAD_PAGE_PATH),
    read(OUTLINE_COMPOSER_PATH),
    read("i18n/locales/vi.ts"),
    read("i18n/locales/en.ts"),
  ]);
  const handlerStart = page.indexOf("const handleGenerateOutline");
  const handlerEnd = page.indexOf("const getGenerationDestination");
  const handler = page.slice(handlerStart, handlerEnd);

  // Explicit phase state covering the three preparation phases.
  assert.match(page, /const \[rewritePhase, setRewritePhase\] = useState<OutlinePhase \| null>\(null\)/);
  assert.match(
    composer,
    /export type OutlinePhase =\s*\|\s*"uploading_documents"\s*\|\s*"reading_documents"\s*\|\s*"rewriting"/
  );

  // Preparation reports each step that actually runs; cache hits report
  // nothing, and the outline call always ends in the rewriting phase.
  assert.match(
    page,
    /onPhase\?: \(phase: "uploading_documents" \| "reading_documents"\) => void/
  );
  assert.match(page, /onPhase\?\.\("uploading_documents"\)/);
  assert.match(page, /onPhase\?\.\("reading_documents"\)/);
  assert.equal(handler.match(/applyPhase\("rewriting"\)/g)?.length, 2);
  assert.match(page, /setRewritePhase\(null\);/);

  // The loading label follows the active phase.
  assert.match(page, /upload\.prompt\.rewrite\.phaseUploading/);
  assert.match(page, /upload\.prompt\.rewrite\.phaseReading/);

  // Phase changes are announced through a polite live region.
  assert.match(composer, /aria-live="polite"/);
  assert.match(composer, /upload\.prompt\.rewrite\.aria\.uploading/);
  assert.match(composer, /upload\.prompt\.rewrite\.aria\.reading/);

  // Localized status/error strings exist in both catalogs.
  for (const catalog of [vi, en]) {
    for (const key of ["phaseUploading", "phaseReading", "preparationErrorFallback"]) {
      assert.match(catalog, new RegExp(`\\b${key}:`), `catalog misses ${key}`);
    }
    assert.match(catalog, /uploading: "/);
    assert.match(catalog, /reading: "/);
  }

  // Duplicate submissions are prevented while an outline request or a
  // Create is active.
  assert.match(page, /if \(createInFlightRef\.current \|\| isRewriting \|\| loadingState\.isLoading \|\| !templateReady\) return;/);

  // Aborting an in-flight request clears the phase along with the flag.
  const filesHandlerStart = page.indexOf("const handleFilesChange");
  const filesHandlerEnd = page.indexOf("const handleGenerateOutline");
  const filesHandler = page.slice(filesHandlerStart, filesHandlerEnd);
  assert.match(
    filesHandler,
    /setIsRewriting\(false\);\s*setRewritePhase\(null\);/
  );
});

/**
 * Task 8 — document-aware outline generation is gated behind a feature flag
 * for the first rollout. When the flag is off, the outline and Create paths
 * skip preparation so the prompt-only body stays byte-compatible with the
 * API that has always existed. The flag defaults to off; nothing reaches the
 * outline in tests that mount UploadPage without overriding the flag.
 */
test("document-aware outline generation is gated behind a feature flag defaulting off", async () => {
  const [flags, page] = await Promise.all([
    read("lib/feature-flags.ts"),
    read(UPLOAD_PAGE_PATH),
  ]);
  // The flag is declared on the FeatureFlags interface and has a default.
  assert.match(flags, /documentAwareRewrite: boolean/);
  assert.match(flags, /documentAwareRewrite: false/);
  // The flag is resolved from a dedicated environment variable so the
  // rollout can be enabled independently of smart mode.
  assert.match(
    flags,
    /GSLIDE_FEATURE_DOCUMENT_AWARE_REWRITE/
  );
  // UploadPage reads the flag and gates preparation on it. The flag is
  // consulted in both the outline handler and the Create-time preparation.
  // The handler must not call ensureDocumentsPrepared when the flag is off
  // AND files are attached; the prompt-only path stays as the API contract.
  const handlerStart = page.indexOf("const handleGenerateOutline");
  const handlerEnd = page.indexOf("const getGenerationDestination");
  const handler = page.slice(handlerStart, handlerEnd);
  assert.match(
    handler,
    /if \(hadDocuments && documentAwareRewrite\) \{[\s\S]*ensureDocumentsPrepared/
  );
});

/**
 * Redesign 2026-09-28 — the composer is two boxes: box 1 takes the idea and
 * owns the AI outline action, box 2 takes the outline or detailed content
 * that becomes the presentation. The attachment panel sits inside the
 * composer (so the whole group is a drop target) and Create is an explicit
 * visible text action below it.
 */
test("redesign: UploadPage composes idea → outline → attachments → Create", async () => {
  const page = await read(UPLOAD_PAGE_PATH);
  // DOM order must match the visual order so keyboard navigation follows
  // the same mental model.
  const composerIdx = page.indexOf("<OutlineComposer");
  const ideaIdx = page.indexOf("idea={config.instructions}");
  const contentIdx = page.indexOf("content={config.prompt}");
  const attachmentsIdx = page.indexOf("<SupportingDoc");
  const createIdx = page.indexOf('data-testid="generate-presentation-button"');
  assert.ok(composerIdx !== -1, "OutlineComposer is missing");
  assert.ok(ideaIdx !== -1, "box 1 is missing");
  assert.ok(contentIdx !== -1, "box 2 is missing");
  assert.ok(attachmentsIdx !== -1, "SupportingDoc is missing");
  assert.ok(createIdx !== -1, "Create button is missing");
  assert.ok(ideaIdx < contentIdx, "the idea comes before the outline");
  assert.ok(contentIdx < attachmentsIdx, "the outline comes before attachments");
  assert.ok(attachmentsIdx < createIdx, "attachments come before Create");

  // Attachments live inside the composer, which is also the drop target.
  const composerEnd = page.indexOf("</OutlineComposer>");
  assert.ok(composerEnd > composerIdx, "OutlineComposer is not closed");
  const composer = page.slice(composerIdx, composerEnd);
  assert.match(composer, /<SupportingDoc/);
  assert.match(composer, /onGenerate=\{handleGenerateOutline\}/);
  assert.match(composer, /onSubmit=\{handleGeneratePresentation\}/);
});

test("redesign: Create is an explicit visible text action bound to handleGeneratePresentation", async () => {
  const page = await read(UPLOAD_PAGE_PATH);
  // The Create button lives on UploadPage (not in SupportingDoc) and
  // reuses the existing orchestration. The test id is preserved so
  // Cypress and integration tests stay stable.
  const createMatch = page.match(
    /<GSlideButton[^>]*data-testid="generate-presentation-button"[\s\S]*?<\/GSlideButton>/,
  );
  assert.ok(createMatch, "Create button is missing");
  const createButton = createMatch[0];
  assert.match(createButton, /onClick=\{handleGeneratePresentation\}/);
  assert.match(createButton, /aria-label=\{t\("upload\.create\.ariaLabel"\)\}/);
  assert.match(createButton, /\{t\("upload\.create\.label"\)\}/);
  // The same `isCreateDisabled` flag drives the disabled state, so template
  // selection and in-flight work continue to gate Create.
  assert.match(createButton, /disabled=\{isCreateDisabled \|\| loadingState\.isLoading\}/);
  assert.match(createButton, /whitespace-nowrap/);
  assert.match(page, /flex w-full justify-center/);
  assert.doesNotMatch(page, /sm:justify-end/);
});

test("composer: Ctrl/Cmd+Enter creates and Shift+Enter inserts a newline", async () => {
  const composer = await read(OUTLINE_COMPOSER_PATH);
  assert.match(composer, /onSubmit\?: \(\) => void/);
  assert.match(composer, /if \(event\.shiftKey \|\| event\.altKey\) return/);
  assert.match(composer, /if \(!event\.metaKey && !event\.ctrlKey\) return;/);
  assert.match(composer, /onSubmit\?\.\(\)/);
  assert.match(composer, /isComposing/);
});

test("redesign: SupportingDoc is attachment-only with a typed usage mode", async () => {
  const supportingDoc = await read(SUPPORTING_DOC_PATH);
  // No submit button lives inside SupportingDoc anymore.
  assert.doesNotMatch(supportingDoc, /onSubmit/);
  assert.doesNotMatch(supportingDoc, /submitDisabled/);
  assert.doesNotMatch(supportingDoc, /generate-presentation-button/);
  // The visible section label and the optional indicator are rendered.
  assert.match(supportingDoc, /upload\.files\.sectionLabel/);
  assert.match(supportingDoc, /upload\.files\.optionalIndicator/);
  // The label and the heading are tied together via aria-labelledby.
  assert.match(supportingDoc, /aria-labelledby="attachments-uploader-label"/);
  assert.match(supportingDoc, /id="attachments-uploader-label"/);
  assert.match(supportingDoc, /<h2/);
  // The typed usage mode drives the helper copy so the parent stays in
  // charge of feature-flag truthfulness.
  assert.match(supportingDoc, /usageMode\?: SupportingDocUsageMode/);
  assert.match(supportingDoc, /export type SupportingDocUsageMode/);
  assert.match(supportingDoc, /"none" \| "doc_aware" \| "presentation_only"/);
  // File selection controls, validation, chip remove, and the file input
  // data-testid are preserved. The input stays visually hidden without
  // being removed from keyboard navigation.
  assert.match(supportingDoc, /data-testid="file-upload-input"/);
  assert.match(supportingDoc, /type="file"\s+className="sr-only"/);
  assert.doesNotMatch(supportingDoc, /type="file"\s+className="hidden"/);
  assert.match(supportingDoc, /data-testid="remove-file-button"/);
  assert.match(supportingDoc, /data-testid="file-list"/);
  assert.match(supportingDoc, /MAX_SUPPORTED_FILES/);
  assert.match(supportingDoc, /isAllowedFile/);
});

test("redesign: SupportingDoc renders the right helper copy per usage mode", async () => {
  const supportingDoc = await read(SUPPORTING_DOC_PATH);
  // The component must look up copy through the i18n catalog rather than
  // concatenating sentence fragments inline.
  assert.match(supportingDoc, /upload\.files\.emptyGuidance/);
  assert.match(supportingDoc, /upload\.files\.helperDocAware/);
  assert.match(supportingDoc, /upload\.files\.helperPresentationOnly/);
  // The empty-state copy is the default when no files are attached and
  // the wrong mode never shows a grounding claim.
  const helperBlock = supportingDoc.slice(
    supportingDoc.indexOf("const helperCopy"),
    supportingDoc.indexOf("return ("),
  );
  assert.match(helperBlock, /files\.length > 0/);
});

test("redesign: OutlineComposer numbers both boxes and renders the detected count", async () => {
  const composer = await read(OUTLINE_COMPOSER_PATH);
  // Two numbered cards: the ordinal lives in a badge, not in the copy, so
  // both labels stay reusable and translatable on their own.
  assert.match(composer, /function StepBadge\(\{ step \}: \{ step: number \}\)/);
  assert.match(composer, /<StepBadge step=\{1\} \/>/);
  assert.match(composer, /<StepBadge step=\{2\} \/>/);
  assert.match(composer, /data-purpose="idea-card"/);
  assert.match(composer, /data-purpose="outline-card"/);
  // Box 1 is optional and says so, and a dashed rule separates the two
  // paths: let the AI draft it, or paste it straight into box 2.
  assert.match(composer, /upload\.outline\.optionalPill/);
  assert.match(composer, /upload\.outline\.orDivider/);
  assert.match(composer, /border-dashed/);

  // Both boxes are labelled, and both are plain editable textareas.
  assert.match(composer, /htmlFor="outline-idea"/);
  assert.match(composer, /htmlFor="outline-content"/);
  assert.match(composer, /data-testid="idea-input"/);
  assert.match(composer, /data-testid="prompt-input"/);
  // The AI action sits on box 1 and reports busy while it runs; duplicate
  // submissions are refused while the same request is already in flight.
  assert.match(composer, /data-testid="rewrite-action-button"/);
  assert.match(composer, /disabled=\{!canGenerate \|\| isGenerating\}/);
  assert.match(composer, /aria-busy=\{isGenerating\}/);
  assert.match(composer, /onClick=\{onGenerate\}/);
  // The detected count is a badge that only renders when the outline
  // declares one, and it is not hard-coded copy.
  assert.match(composer, /data-testid="detected-slides-badge"/);
  assert.match(composer, /\{detectedSlidesCount \? \(/);
  assert.match(composer, /t\("upload\.outline\.detectedCount", \{\s*count: detectedSlidesCount,/);
  // A failure is reported inline with a retry that reuses the same flow.
  assert.match(composer, /data-testid="rewrite-error"/);
  assert.match(composer, /data-testid="rewrite-retry-button"/);
  // The composer is the drop target the attachment control binds to.
  assert.match(composer, /PromptComposerBoundaryContext\.Provider/);
  assert.match(composer, /data-testid="outline-composer"/);
});

test("redesign: new copy keys exist and remain symmetric across catalogs", async () => {
  const [vi, en] = await Promise.all([
    read("i18n/locales/vi.ts"),
    read("i18n/locales/en.ts"),
  ]);
  const newKeys = [
    "sectionLabel",
    "optionalIndicator",
    "emptyGuidance",
    "helperDocAware",
    "helperPresentationOnly",
  ];
  for (const key of newKeys) {
    const re = new RegExp(`\\b${key}:`);
    assert.match(vi, re, `vi.ts misses ${key}`);
    assert.match(en, re, `en.ts misses ${key}`);
  }
  // `upload.create.label` and `upload.create.ariaLabel` are new leaves.
  // The catalog encodes them under `upload: { create: { label, ariaLabel } }`
  // — assert that the leaf strings exist verbatim so a missing key fails
  // here even if the parity walker is not run. The exact wording is
  // intentional: "Tạo bài thuyết trình" / "Create presentation".
  assert.match(vi, /"Tạo bài thuyết trình"/);
  assert.match(en, /"Create presentation"/);
});
