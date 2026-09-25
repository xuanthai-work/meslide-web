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
 * Task 6 — UploadPage rewrite orchestration contract (source assertions in
 * the established UploadPage test style; the behavioral interaction tests
 * land with the dedicated test task). Pins the load-bearing invariants:
 * one AbortController + a monotonically increasing request ID so a
 * superseded or too-late response is discarded, freshness derived from the
 * captured source, the user-safe localized error (raw error text goes to
 * the console only), and the source prompt never being overwritten.
 */
test("UploadPage orchestrates the rewrite with abort and request-ID freshness guards", async () => {
  const page = await read(UPLOAD_PAGE_PATH);
  const handlerStart = page.indexOf("const handleRewritePrompt");
  const handlerEnd = page.indexOf("const getGenerationDestination");
  assert.ok(handlerStart !== -1, "handleRewritePrompt is missing");
  const handler = page.slice(handlerStart, handlerEnd);

  // Plan-mandated orchestration state.
  assert.match(page, /const \[rewrittenPrompt, setRewrittenPrompt\] = useState\(""\)/);
  assert.match(page, /const \[rewrittenFromContextKey, setRewrittenFromContextKey\] = useState\(""\)/);
  assert.match(page, /const \[isRewriting, setIsRewriting\] = useState\(false\)/);
  assert.match(page, /const \[rewriteError, setRewriteError\] = useState<string \| null>\(null\)/);

  // Freshness is derived by comparing the stored request-time context key
  // with the live one — never stored as a separate flag.
  assert.match(page, /const sourcePrompt = config\.prompt\.trim\(\)/);
  assert.match(page, /const rewriteContextKey = \[/);
  assert.match(
    page,
    /isRewriteFresh =\s*[\s\S]*rewrittenFromContextKey === rewriteContextKey/
  );
  // The key covers every active rewrite input. File selection participates
  // only while document-aware rewrite is enabled.
  const keyStart = page.indexOf("const rewriteContextKey = [");
  const keyEnd = page.indexOf('].join("::")', keyStart);
  assert.ok(keyStart !== -1 && keyEnd !== -1, "rewriteContextKey is missing");
  const contextKey = page.slice(keyStart, keyEnd);
  assert.match(contextKey, /sourcePrompt/);
  assert.match(contextKey, /config\.language/);
  assert.match(contextKey, /parseLimitedSlideCount\(config\.slides\) \?\? "auto"/);
  assert.match(
    contextKey,
    /documentAwareRewrite \? fileFingerprint\(files\) : "prompt-only"/,
  );
  // Settings that are not rewrite inputs never invalidate a result.
  for (const excluded of ["tone", "verbosity", "theme", "generationMode"]) {
    assert.doesNotMatch(contextKey, new RegExp(excluded));
  }

  // One AbortController plus a monotonically increasing request ID.
  assert.match(page, /useRef<AbortController \| null>\(null\)/);
  assert.match(handler, /const requestId = \+\+rewriteRequestIdRef\.current;/);

  // Starting a newer rewrite aborts the in-flight one first.
  assert.match(
    handler,
    /rewriteAbortRef\.current\?\.abort\(\);\s*const controller = new AbortController\(\)/
  );
  // The request ID check discards superseded responses and errors even
  // when the abort arrives too late for the fetch to reject.
  assert.match(handler, /if \(requestId !== rewriteRequestIdRef\.current\) return;/);

  // The context key is captured at request start and stored only after
  // success, together with the result.
  assert.match(handler, /const source = config\.prompt\.trim\(\);/);
  assert.match(handler, /const previous = rewrittenPrompt\.trim\(\);/);
  assert.match(handler, /previousPrompt: previous \|\| undefined/);
  assert.match(handler, /const contextKey = rewriteContextKey;/);
  assert.match(
    handler,
    /setRewrittenPrompt\(result\);\s*[\s\S]*setRewrittenFromContextKey\(contextKey\);/
  );

  // The request follows the generation boundary rules for language and
  // slide count, and forwards the abort signal.
  assert.match(handler, /language: config\.language,/);
  assert.match(handler, /nSlides: parseLimitedSlideCount\(config\.slides\),/);
  assert.match(handler, /signal: controller\.signal,/);

  // The user sees the localized fallback; the raw error text is
  // console-only, and any previous result is kept on failure. A failed
  // preparation gets its own message, distinct from a failed rewrite.
  assert.match(
    handler,
    /phase === "rewriting"\s*\?\s*"upload\.prompt\.rewrite\.errorFallback"\s*:\s*"upload\.prompt\.rewrite\.preparationErrorFallback"/
  );
  assert.match(handler, /console\.error\("Error rewriting prompt", error\)/);

  // The source prompt is never overwritten with the response.
  assert.doesNotMatch(handler, /setConfig/);

  // The in-flight rewrite is aborted on unmount.
  assert.match(
    page,
    /return \(\) => \{\s*rewriteRequestIdRef\.current \+= 1;\s*rewriteAbortRef\.current\?\.abort\(\);/
  );

  // Clearing the editable source must keep the last rewrite visible. It is
  // derived as stale until the user rewrites the new source, so users can
  // delete and replace their original text without losing the AI result.
  assert.doesNotMatch(
    page,
    /if \(sourcePrompt\) return;[\s\S]{0,400}setRewrittenPrompt\(""\)/
  );

  // Button wiring: duplicate submissions disabled while the same request
  // is active, aria-busy while loading, and the label follows the state
  // machine (loading / retry / update / action).
  assert.match(
    page,
    /disabled=\{!promptRequiresRewrite \|\| isRewriting\}/
  );
  assert.match(page, /aria-busy=\{isRewriting\}/);
  assert.match(page, /onClick=\{handleRewritePrompt\}/);
  for (const key of ["loading", "retryAction", "updateAction", "action"]) {
    assert.match(page, new RegExp(`upload\\.prompt\\.rewrite\\.${key}`));
  }

  // The result panel receives the orchestrated state, and its retry path
  // runs the same rewrite flow.
  assert.match(
    page,
    /value=\{rewrittenPrompt\}\s*onChange=\{setRewrittenPrompt\}\s*keptOpen=\{rewrittenFromContextKey\.length > 0\}\s*isLoading=\{isRewriting\}\s*phase=\{rewritePhase\}\s*isStale=\{isRewriteStale\}\s*error=\{rewriteError\}/
  );
  assert.match(page, /onRetry=\{handleRewritePrompt\}/);
});

/**
 * Task 7 — generation must consume the latest rewrite produced from the
 * current source. Prompt-less document/community creation stays available,
 * while every path containing source text requires a fresh rewrite.
 */
test("UploadPage validates freshness and snapshots the rewritten prompt for generation", async () => {
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

  // A prompt-plus-document submission needs both a fresh rewrite and, when
  // document-aware rewrite is enabled, the prepared set it was grounded in.
  assert.match(
    validation,
    /promptRequiresRewrite &&\s*\(!isRewriteFresh \|\| !preparedDocumentsMatchSelection\)/
  );
  assert.match(validation, /upload\.prompt\.rewrite\.requiredTitle/);
  assert.match(validation, /upload\.prompt\.rewrite\.requiredDescription/);

  assert.match(
    generation,
    /const generationConfig: PresentationConfig = \{[\s\S]*prompt: promptRequiresRewrite \? rewrittenPrompt\.trim\(\) : ""/,
  );
  assert.match(generation, /handleDocumentProcessing\(generationConfig, templateId\)/);
  assert.match(generation, /handleDirectPresentationGeneration\(generationConfig, templateId\)/);
  assert.match(generation, /resolveTemplateForCreate\(/);

  // Selected documents are always prepared for generation. The rollout flag
  // gates rewrite grounding only and must never remove Create file paths.
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

test("Create eligibility preserves prompt-less inputs and does not block attachments", async () => {
  const page = await read(UPLOAD_PAGE_PATH);
  const supportingDoc = await read(SUPPORTING_DOC_PATH);

  assert.match(
    page,
    /const hasPromptlessGenerationInput = files\.length > 0/,
  );
  assert.match(
    page,
    /promptRequiresRewrite\s*\? !isRewriteFresh \|\| !preparedDocumentsMatchSelection\s*:\s*!hasPromptlessGenerationInput/,
  );
  // The prepared set must match the current file fingerprint and language.
  assert.match(
    page,
    /preparedDocuments\.decompositionKey ===\s*decompositionKeyFor\(fileFingerprint\(files\), config\.language\)/
  );
  assert.match(
    page,
    /const preparedDocumentsMatchSelection =\s*!documentAwareRewrite \|\|/,
  );
  // Redesign 2026-09-16: the explicit Create button lives on UploadPage and
  // is gated on the same `isCreateDisabled` flag the validation flow uses.
  assert.match(page, /disabled=\{isCreateDisabled \|\| loadingState\.isLoading\}/);
  assert.match(page, /onClick=\{handleGeneratePresentation\}/);
  assert.match(page, /upload\.create\.label/);

  // Rewrite eligibility disables only Create; users can still select the
  // attachment that makes a prompt-less flow valid. The attachment panel
  // exposes only the selection state — Create moved out.
  assert.match(supportingDoc, /type="file"[\s\S]*disabled=\{disabled\}/);
});

test("source edits invalidate in-flight rewrites before updating config", async () => {
  const page = await read(UPLOAD_PAGE_PATH);
  const start = page.indexOf("const handleSourcePromptChange");
  const end = page.indexOf("const handleGenerationModeChange");
  const handler = page.slice(start, end);

  assert.ok(start !== -1, "handleSourcePromptChange is missing");
  assert.match(handler, /rewriteRequestIdRef\.current \+= 1/);
  assert.match(handler, /rewriteAbortRef\.current\?\.abort\(\)/);
  assert.match(handler, /handleConfigChange\("prompt", value\)/);
  assert.match(page, /onChange=\{handleSourcePromptChange\}/);
});

test("prompt rewrite catalogs stay symmetric and the upload hero renders once", async () => {
  const [vi, en, page] = await Promise.all([
    read("i18n/locales/vi.ts"),
    read("i18n/locales/en.ts"),
    read(UPLOAD_PAGE_PATH),
  ]);
  const keys = [
    "sourceLabel",
    "sourcePlaceholder",
    "action",
    "loading",
    "outputLabel",
    "emptyHint",
    "staleBadge",
    "staleHelper",
    "updateAction",
    "retryAction",
    "errorTitle",
    "errorFallback",
    "requiredTitle",
    "requiredDescription",
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
 * through the existing polite live region with localized strings, and the
 * loading label follows the active phase. Abort paths clear the phase, and
 * duplicate submissions are prevented while work is active.
 */
test("rewrite progress surfaces preparation phases accessibly", async () => {
  const [page, panel, vi, en] = await Promise.all([
    read(UPLOAD_PAGE_PATH),
    read("app/(presentation-generator)/upload/components/RewrittenPrompt.tsx"),
    read("i18n/locales/vi.ts"),
    read("i18n/locales/en.ts"),
  ]);
  const handlerStart = page.indexOf("const handleRewritePrompt");
  const handlerEnd = page.indexOf("const getGenerationDestination");
  const handler = page.slice(handlerStart, handlerEnd);

  // Explicit phase state covering the three preparation phases.
  assert.match(page, /const \[rewritePhase, setRewritePhase\] = useState<RewritePhase \| null>\(null\)/);
  assert.match(
    panel,
    /export type RewritePhase =\s*\|\s*"uploading_documents"\s*\|\s*"reading_documents"\s*\|\s*"rewriting"/
  );

  // Preparation reports each step that actually runs; cache hits report
  // nothing, and the rewrite call always ends in the rewriting phase.
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

  // Phase changes are announced through the existing polite live region.
  assert.match(panel, /aria-live="polite"/);
  assert.match(panel, /upload\.prompt\.rewrite\.aria\.uploading/);
  assert.match(panel, /upload\.prompt\.rewrite\.aria\.reading/);

  // Localized status/error strings exist in both catalogs.
  for (const catalog of [vi, en]) {
    for (const key of ["phaseUploading", "phaseReading", "preparationErrorFallback"]) {
      assert.match(catalog, new RegExp(`\\b${key}:`), `catalog misses ${key}`);
    }
    assert.match(catalog, /uploading: "/);
    assert.match(catalog, /reading: "/);
  }

  // Duplicate submissions are prevented while a rewrite or Create is active.
  assert.match(page, /if \(createInFlightRef\.current \|\| isRewriting \|\| loadingState\.isLoading \|\| !templateReady\) return;/);

  // Aborting an in-flight rewrite clears the phase along with the flag.
  const filesHandlerStart = page.indexOf("const handleFilesChange");
  const filesHandlerEnd = page.indexOf("const handleRewritePrompt");
  const filesHandler = page.slice(filesHandlerStart, filesHandlerEnd);
  assert.match(
    filesHandler,
    /setIsRewriting\(false\);\s*setRewritePhase\(null\);/
  );
});

/**
 * Task 8 — document-aware rewrite is gated behind a feature flag for the
 * first rollout. When the flag is off, the rewrite and Create paths skip
 * preparation so the prompt-only body stays byte-compatible with the API
 * that has always existed. The flag defaults to off; nothing reaches the
 * rewrite in tests that mount UploadPage without overriding the flag.
 */
test("document-aware rewrite is gated behind a feature flag defaulting off", async () => {
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
  // consulted in both the rewrite handler and the Create-time preparation.
  // The handler must not call ensureDocumentsPrepared when the flag is off
  // AND files are attached; the prompt-only path stays as the API contract.
  const handlerStart = page.indexOf("const handleRewritePrompt");
  const handlerEnd = page.indexOf("const getGenerationDestination");
  const handler = page.slice(handlerStart, handlerEnd);
  assert.match(
    handler,
    /if \(hadDocuments && documentAwareRewrite\) \{[\s\S]*ensureDocumentsPrepared/
  );
});

/**
 * Redesign 2026-09-16 — the upload composer was recomposed so prompt and
 * documents appear as inputs first, the rewritten prompt sits between them,
 * and Create is an explicit visible text action below the output. The
 * attachment panel is attachment-only (no submit/submitDisabled), exposes a
 * typed usage mode that drives truthful helper copy, and renders a section
 * label and an "Optional" indicator.
 */
test("redesign: UploadPage composes prompt → attachments → rewrite → output → Create", async () => {
  const page = await read(UPLOAD_PAGE_PATH);
  // DOM order must match the visual order so keyboard navigation follows
  // the same mental model.
  const promptIdx = page.indexOf("<PromptInput");
  const attachmentsIdx = page.indexOf("<SupportingDoc");
  const rewriteButtonIdx = page.indexOf('data-testid="rewrite-action-button"');
  const outputIdx = page.indexOf("<RewrittenPrompt");
  const createIdx = page.indexOf('data-testid="generate-presentation-button"');
  assert.ok(promptIdx !== -1, "PromptInput is missing");
  assert.ok(attachmentsIdx !== -1, "SupportingDoc is missing");
  assert.ok(rewriteButtonIdx !== -1, "rewrite button is missing");
  assert.ok(outputIdx !== -1, "RewrittenPrompt is missing");
  assert.ok(createIdx !== -1, "Create button is missing");
  assert.ok(promptIdx < attachmentsIdx, "prompt comes before attachments");
  assert.ok(attachmentsIdx < rewriteButtonIdx, "attachments come before rewrite");
  assert.ok(rewriteButtonIdx < outputIdx, "rewrite comes before output");
  assert.ok(outputIdx < createIdx, "output comes before Create");

  // Attachments and the rewrite action live inside the composer. Bare Enter
  // rewrites; Shift+Enter stays a newline; Ctrl/Cmd+Enter still creates.
  const promptEnd = page.indexOf("</PromptInput>");
  assert.ok(promptEnd > promptIdx, "PromptInput is not closed");
  const composer = page.slice(promptIdx, promptEnd);
  assert.match(composer, /<SupportingDoc/);
  assert.match(composer, /data-testid="rewrite-action-button"/);
  assert.match(composer, /onRewrite=\{handleRewritePrompt\}/);
});

test("redesign: Create is an explicit visible text action bound to handleGeneratePresentation", async () => {
  const page = await read(UPLOAD_PAGE_PATH);
  // The new Create button lives on UploadPage (not in SupportingDoc) and
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
  // The same `isCreateDisabled` flag still drives the disabled state, so
  // prompt-only rewrite freshness and document-aware prep continue to gate
  // Create exactly as before.
  assert.match(createButton, /disabled=\{isCreateDisabled \|\| loadingState\.isLoading\}/);
  assert.match(createButton, /whitespace-nowrap/);
  assert.match(page, /flex w-full justify-center/);
  assert.doesNotMatch(page, /sm:justify-end/);
});

test("composer: Enter rewrites and Shift+Enter inserts a newline", async () => {
  const promptInput = await read(
    "app/(presentation-generator)/upload/components/PromptInput.tsx",
  );
  assert.match(promptInput, /onRewrite\?: \(\) => void/);
  assert.match(promptInput, /if \(event\.shiftKey \|\| event\.altKey\) return/);
  assert.match(promptInput, /onRewrite\?\.\(\)/);
  assert.match(promptInput, /onSubmit\?\.\(\)/);
  assert.match(promptInput, /isComposing/);
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

test("redesign: RewrittenPrompt renders a compact empty state and a grounded helper", async () => {
  const [panel, page] = await Promise.all([
    read("app/(presentation-generator)/upload/components/RewrittenPrompt.tsx"),
    read(UPLOAD_PAGE_PATH),
  ]);
  // Compact empty state: no result, not loading, no error, not stale.
  assert.match(panel, /isCompactEmpty/);
  assert.match(panel, /data-compact-empty=\{isCompactEmpty \? "true" : undefined\}/);
  assert.match(panel, /upload\.prompt\.rewrite\.emptyTitle/);
  // The output textarea only renders when the panel is expanded so the
  // empty state does not dominate the composer.
  assert.match(panel, /!isCompactEmpty && \(\s*<div className="flex min-h-0/);
  // Grounded helper appears only for fresh, non-stale, non-error rewrites.
  assert.match(panel, /groundedDocumentCount\?: number/);
  assert.match(panel, /showGroundedHelper/);
  assert.match(panel, /upload\.prompt\.rewrite\.groundedSummary/);
  assert.match(panel, /data-testid="rewritten-prompt-grounded-helper"/);
  // The result can be edited by hand. It stays read-only only while a rewrite
  // is in flight, or when the parent does not provide an editor callback.
  assert.match(panel, /onChange\?: \(value: string\) => void/);
  assert.match(panel, /readOnly=\{isLoading \|\| !onChange\}/);
  assert.match(page, /onChange=\{setRewrittenPrompt\}/);
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
    "emptyTitle",
    "groundedSummary",
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
