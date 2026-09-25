/**
 * UploadPage Component
 * 
 * This component handles the presentation generation upload process, allowing users to:
 * - Configure presentation settings (slides, language)
 * - Input prompts
 * - Upload supporting documents
 * 
 * @component
 */

"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { clearOutlines, setPresentationId } from "@/store/slices/presentationGeneration";
import { PromptInput } from "./PromptInput";
import { RewrittenPrompt, type RewritePhase } from "./RewrittenPrompt";
import { LanguageType, PresentationConfig, ToneType, VerbosityType } from "../type";
import SupportingDoc from "./SupportingDoc";
import { notify } from "@/components/ui/sonner";
import { ApiError } from "../../services/api/api-error-handler";
import { PresentationGenerationApi } from "../../services/api/presentation-generation";
import {
  type PreparedDocumentSet,
  decompositionKeyFor,
  documentPathsOf,
  fileFingerprint,
  planDocumentPreparation,
} from "../services/document-preparation";
import { OverlayLoader } from "@/components/ui/overlay-loader";
import Wrapper from "@/components/Wrapper";
import { setPptGenUploadState } from "@/store/slices/presentationGenUpload";
import { ConfigurationSelects } from "./ConfigurationSelects";
import {
  clampSlideCountValue,
  parseLimitedSlideCount,
} from "@/utils/presentationLimits";
import { useT } from "@/i18n/provider";
import { useFeatureFlags } from "@/components/FeatureFlagsProvider";
import { GSlideButton, GSlideStudioTitle } from "@/components/gslide";
import { UploadTemplatePicker } from "./UploadTemplatePicker";

// Types for loading state
interface LoadingState {
  isLoading: boolean;
  message: string;
  duration?: number;
  showProgress?: boolean;
  extra_info?: string;
}

// Coded server errors meaning "the prepared documents expired server-side".
// On these the same local files are re-prepared once through the normal
// upload/decompose path instead of failing hard.
const STALE_DOCUMENT_ERROR_CODES = new Set([
  "error.prompt_rewrite.document_not_found",
  "error.prompt_rewrite.document_invalid",
  "error.document_profile.document_not_found",
  "error.document_profile.document_invalid",
]);

const isStaleDocumentError = (error: unknown): boolean => {
  return (
    error instanceof ApiError &&
    error.code !== undefined &&
    STALE_DOCUMENT_ERROR_CODES.has(error.code)
  );
};

const UploadPage = () => {
  const t = useT();
  const { documentAwareRewrite } = useFeatureFlags();
  const router = useRouter();
  const dispatch = useDispatch();

  const [files, setFiles] = useState<File[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateReady, setTemplateReady] = useState(false);
  const [config, setConfig] = useState<PresentationConfig>({
    slides: null,
    language: LanguageType.Vietnamese,
    prompt: "",
    tone: ToneType.Default,
    verbosity: VerbosityType.Standard,
    instructions: "",
    webSearch: true,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedPrompt = params.get("prompt")?.trim();
    if (requestedPrompt) {
      setConfig((current) => ({ ...current, prompt: requestedPrompt }));
    }
  }, []);

  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false,
    message: "",
    duration: 4,
    showProgress: false,
    extra_info: "",
  });

  // --- AI prompt rewrite orchestration ---------------------------------
  // `config.prompt` stays the source idea and is never overwritten by a
  // rewrite. The result below can be edited by hand; Create uses that text.
  // Freshness is
  // derived from a deterministic context key covering every input the
  // rewrite consumes — normalized prompt, language, parsed slide count, and
  // the selected file fingerprint. Tone, verbosity, theme, and other
  // settings that are not inputs to the rewrite never invalidate it.
  const [rewrittenPrompt, setRewrittenPrompt] = useState("");
  const [rewrittenFromContextKey, setRewrittenFromContextKey] = useState("");
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewritePhase, setRewritePhase] = useState<RewritePhase | null>(null);
  const [rewriteError, setRewriteError] = useState<string | null>(null);

  // One AbortController for the latest in-flight request plus a
  // monotonically increasing request ID. Starting a newer rewrite (or
  // leaving the page) aborts the previous request, and the ID check below
  // discards its response even when the abort arrives too late for the
  // fetch to reject. The same controller covers the document preparation
  // (upload + decompose) that a document-aware rewrite performs first.
  const rewriteAbortRef = useRef<AbortController | null>(null);
  const rewriteRequestIdRef = useRef(0);

  // --- Document preparation cache ---------------------------------------
  // `preparedDocuments` holds the decomposed set for the current file
  // fingerprint and language; `uploadedOriginalsRef` holds the uploaded
  // originals per fingerprint so a language change re-decomposes without
  // re-uploading. Both keys are derived, never stored as flags.
  const [preparedDocuments, setPreparedDocuments] =
    useState<PreparedDocumentSet | null>(null);
  // Mirror ref: async flows (including the stale-document retry) must read
  // the latest prepared set without waiting for a re-render.
  const preparedDocumentsRef = useRef<PreparedDocumentSet | null>(null);
  const uploadedOriginalsRef = useRef<{
    fileFingerprint: string;
    paths: string[];
  } | null>(null);

  const setPreparedDocumentsThroughRef = (prepared: PreparedDocumentSet) => {
    preparedDocumentsRef.current = prepared;
    setPreparedDocuments(prepared);
  };

  const invalidatePreparedDocuments = () => {
    preparedDocumentsRef.current = null;
    uploadedOriginalsRef.current = null;
    setPreparedDocuments(null);
  };

  /**
   * Uploads and decomposes the selected files only on a cache miss and
   * returns the prepared document set. Uploads are cached per ordered file
   * fingerprint; decomposition is cached per fingerprint plus the
   * normalized presentation language, so switching language reuses the
   * uploaded originals while regenerating the extracted text. `onPhase`
   * reports each step that actually runs — cache hits report nothing.
   */
  const ensureDocumentsPrepared = async (
    signal: AbortSignal,
    onPhase?: (phase: "uploading_documents" | "reading_documents") => void
  ): Promise<PreparedDocumentSet> => {
    const fingerprint = fileFingerprint(files);
    const decompositionKeyValue = decompositionKeyFor(fingerprint, config.language);

    const cached = preparedDocumentsRef.current;
    const step = planDocumentPreparation({
      fileFingerprint: fingerprint,
      decompositionKey: decompositionKeyValue,
      cachedDecompositionKey: cached?.decompositionKey ?? null,
      uploadedFingerprint: uploadedOriginalsRef.current?.fileFingerprint ?? null,
    });
    if (step === "use-cache" && cached) {
      return cached;
    }

    if (step === "upload-and-decompose") {
      onPhase?.("uploading_documents");
      const uploadedPaths = (await PresentationGenerationApi.uploadDoc(
        files,
        signal
      )) as string[];
      uploadedOriginalsRef.current = {
        fileFingerprint: fingerprint,
        paths: uploadedPaths,
      };
    }

    onPhase?.("reading_documents");
    const documents = await PresentationGenerationApi.decomposeDocuments(
      uploadedOriginalsRef.current?.paths ?? [],
      config.language,
      signal
    );
    const prepared: PreparedDocumentSet = {
      fileFingerprint: fingerprint,
      decompositionKey: decompositionKeyValue,
      uploadedPaths: uploadedOriginalsRef.current?.paths ?? [],
      documents,
    };
    setPreparedDocumentsThroughRef(prepared);
    return prepared;
  };

  const sourcePrompt = config.prompt.trim();
  const hasRewriteResult = rewrittenPrompt.trim().length > 0;
  // Deterministic context key over every input the rewrite consumes. Any
  // change to one of these inputs makes the stored result stale by
  // comparison; settings that are not rewrite inputs (tone, verbosity,
  // theme, generation mode) are deliberately excluded so they never
  // invalidate an otherwise valid result.
  const rewriteContextKey = [
    sourcePrompt,
    (config.language ?? "").trim().toLowerCase(),
    parseLimitedSlideCount(config.slides) ?? "auto",
    documentAwareRewrite ? fileFingerprint(files) : "prompt-only",
  ].join("::");
  const isRewriteFresh =
    hasRewriteResult && rewrittenFromContextKey === rewriteContextKey;
  const isRewriteStale = hasRewriteResult && !isRewriteFresh;
  const promptRequiresRewrite = sourcePrompt.length > 0;
  const hasPromptlessGenerationInput = files.length > 0;
  // Only a document-aware rewrite requires a prepared set before Create. If
  // the flag is off, the rewrite is prompt-only and document preparation is
  // deferred to the normal generation path.
  const preparedDocumentsMatchSelection =
    !documentAwareRewrite ||
    files.length === 0 ||
    (preparedDocuments !== null &&
      preparedDocuments.decompositionKey ===
        decompositionKeyFor(fileFingerprint(files), config.language));
  const isCreateDisabled =
    !templateReady ||
    !selectedTemplateId ||
    isRewriting ||
    (promptRequiresRewrite
      ? !isRewriteFresh || !preparedDocumentsMatchSelection
      : !hasPromptlessGenerationInput);

  // The action label follows the active preparation phase so the user can
  // tell what is actually happening before the rewrite itself runs.
  const rewriteActionLabel = isRewriting
    ? rewritePhase === "uploading_documents"
      ? t("upload.prompt.rewrite.phaseUploading")
      : rewritePhase === "reading_documents"
        ? t("upload.prompt.rewrite.phaseReading")
        : t("upload.prompt.rewrite.loading")
    : rewriteError
      ? t("upload.prompt.rewrite.retryAction")
      : isRewriteStale
        ? t("upload.prompt.rewrite.updateAction")
        : t("upload.prompt.rewrite.action");

  // Abort the in-flight rewrite when the component unmounts.
  useEffect(() => {
    return () => {
      rewriteRequestIdRef.current += 1;
      rewriteAbortRef.current?.abort();
    };
  }, []);

  const handleConfigChange = (key: keyof PresentationConfig, value: unknown) => {
    const nextValue =
      key === "slides" && typeof value === "string"
        ? clampSlideCountValue(value)
        : value;
    setConfig((prev) => ({ ...prev, [key]: nextValue } as PresentationConfig));
  };

  const handleSourcePromptChange = (value: string) => {
    const nextSource = value.trim();

    // A response for text that is no longer current must never become usable.
    // Abort eagerly on edit and invalidate the request ID as a fallback for
    // providers that cannot cancel an already-completed response.
    if (isRewriting && nextSource !== sourcePrompt) {
      rewriteRequestIdRef.current += 1;
      rewriteAbortRef.current?.abort();
      rewriteAbortRef.current = null;
      setIsRewriting(false);
      setRewritePhase(null);
    }

    if (nextSource !== sourcePrompt) {
      setRewriteError(null);
    }
    handleConfigChange("prompt", value);
  };

  /**
   * A changed file set invalidates any in-flight rewrite: the active work
   * was grounded in files that are no longer selected, so it is aborted and
   * its request ID retired before the new selection lands. Preparation
   * caches invalidate themselves through their derived keys.
   */
  const handleFilesChange = (nextFiles: File[]) => {
    if (isRewriting) {
      rewriteRequestIdRef.current += 1;
      rewriteAbortRef.current?.abort();
      rewriteAbortRef.current = null;
      setIsRewriting(false);
      setRewritePhase(null);
    }
    setFiles(nextFiles);
  };

  /**
   * Rewrites the current source prompt with AI. When documents are selected,
   * they are prepared (upload + decompose) first and the decomposed texts
   * ground the rewrite. The response only fills the read-only result panel
   * below the source field — the source prompt itself is never overwritten.
   * A previous result stays visible if a refresh fails; the user then sees a
   * localized fallback, never the raw API error.
   */
  const handleRewritePrompt = async () => {
    // Capture the context key at the START of the request: it covers the
    // exact inputs this response is computed from, and freshness compares
    // it against the live key once it is stored after success.
    const source = config.prompt.trim();
    const previous = rewrittenPrompt.trim();
    const contextKey = rewriteContextKey;
    if (!source || isRewriting) return;

    // Supersede any older request: abort it, and bump the ID so its late
    // response is discarded even if the abort arrives too late.
    rewriteAbortRef.current?.abort();
    const controller = new AbortController();
    rewriteAbortRef.current = controller;
    const requestId = ++rewriteRequestIdRef.current;

    setIsRewriting(true);
    setRewriteError(null);
    // The active phase drives the loading label, the live-region
    // announcement, and — on failure — which localized fallback the user
    // sees: a failed preparation is reported differently from a failed
    // rewrite.
    let phase: RewritePhase = "rewriting";
    const applyPhase = (next: RewritePhase) => {
      phase = next;
      setRewritePhase(next);
    };
    const hadDocuments = files.length > 0;

    try {
      // Prepare the selected documents once per file set and language; the
      // decomposed text paths ground the rewrite on the server. When the
      // document-aware flag is off, preparation is skipped and the
      // request falls back to the prompt-only body that the API has
      // always supported.
      let filePaths: string[] | undefined;
      if (hadDocuments && documentAwareRewrite) {
        const prepared = await ensureDocumentsPrepared(
          controller.signal,
          applyPhase
        );
        if (requestId !== rewriteRequestIdRef.current) return;
        filePaths = documentPathsOf(prepared);
      }

      let result: string;
      try {
        applyPhase("rewriting");
        result = await PresentationGenerationApi.rewritePrompt({
          prompt: source,
          previousPrompt: previous || undefined,
          language: config.language,
          nSlides: parseLimitedSlideCount(config.slides),
          filePaths,
          signal: controller.signal,
        });
      } catch (error) {
        // An expired server-side document is healed once through the
        // normal safe path: drop the caches, re-prepare the same local
        // files, and retry the rewrite.
        if (!filePaths || !isStaleDocumentError(error)) throw error;
        invalidatePreparedDocuments();
        const prepared = await ensureDocumentsPrepared(
          controller.signal,
          applyPhase
        );
        if (requestId !== rewriteRequestIdRef.current) return;
        applyPhase("rewriting");
        result = await PresentationGenerationApi.rewritePrompt({
          prompt: source,
          previousPrompt: previous || undefined,
          language: config.language,
          nSlides: parseLimitedSlideCount(config.slides),
          filePaths: documentPathsOf(prepared),
          signal: controller.signal,
        });
      }

      if (requestId !== rewriteRequestIdRef.current) return;
      setRewrittenPrompt(result);
      // Store the captured context key only after success so freshness
      // stays derived from what the current inputs actually are.
      setRewrittenFromContextKey(contextKey);
    } catch (error: unknown) {
      if (requestId !== rewriteRequestIdRef.current) return;
      // Raw error text is for the console only; the UI gets the localized
      // fallback and keeps any previous result visible. Preparation
      // failures (upload/decompose) get their own message.
      console.error("Error rewriting prompt", error);
      setRewriteError(
        t(
          phase === "rewriting"
            ? "upload.prompt.rewrite.errorFallback"
            : "upload.prompt.rewrite.preparationErrorFallback"
        )
      );
    } finally {
      // Only the latest request may flip the loading flag off, so a slow
      // superseded request cannot re-enable the button mid-flight.
      if (requestId === rewriteRequestIdRef.current) {
        setIsRewriting(false);
        setRewritePhase(null);
      }
    }
  };

  const getGenerationDestination = (presentationId: string) => {
    const params = new URLSearchParams({
      id: presentationId,
      auto: "1",
    });
    if (selectedTemplateId) params.set("template", selectedTemplateId);
    return `/presentation?${params.toString()}`;
  };

  /**
   * Validates the current configuration and files
   * @returns boolean indicating if the configuration is valid
   */
  const validateConfiguration = (): boolean => {
    if (!config.language) {
      notify.warning(t("upload.validation.languageRequiredTitle"), t("upload.validation.selectLanguage"));
      return false;
    }

    if (files.length > 0 && config.language === LanguageType.Auto) {
      notify.warning(t("upload.validation.languageRequiredTitle"), t("upload.validation.selectLanguageForDocuments"));
      return false;
    }

    if (
      !sourcePrompt &&
      files.length === 0
    ) {
      notify.warning(
        t("upload.validation.inputRequiredTitle"),
        t("upload.validation.inputRequiredDescription")
      );
      return false;
    }

    if (
      promptRequiresRewrite &&
      (!isRewriteFresh || !preparedDocumentsMatchSelection)
    ) {
      notify.warning(
        t("upload.prompt.rewrite.requiredTitle"),
        t("upload.prompt.rewrite.requiredDescription"),
      );
      return false;
    }
    return true;
  };

  /**
   * Handles the presentation generation process
   */
  const handleGeneratePresentation = async () => {
    // Keyboard submissions run the same eligibility checks as the button:
    // never start a Create while a rewrite or a previous Create is active.
    if (isRewriting || loadingState.isLoading || !templateReady || !selectedTemplateId) return;
    if (!validateConfiguration()) return;

    // Capture the exact configuration being submitted. From this point on,
    // neither a source edit nor another settings change can alter the prompt
    // used by the in-flight document/direct generation request.
    const generationConfig: PresentationConfig = {
      ...config,
      prompt: promptRequiresRewrite ? rewrittenPrompt.trim() : "",
    };

    try {
      const hasUploadedAssets = files.length > 0;

      if (hasUploadedAssets) {
        await handleDocumentProcessing(generationConfig);
      } else {
        await handleDirectPresentationGeneration(generationConfig);
      }
    } catch (error) {
      handleGenerationError(error);
    }
  };

  /**
   * Handles document processing: reuses the prepared document set (or
   * prepares it now for document-only creation) instead of uploading and
   * decomposing again, then creates the presentation.
   */
  const handleDocumentProcessing = async (
    generationConfig: PresentationConfig,
  ) => {
    setLoadingState({
      isLoading: true,
      message: t("upload.status.processingDocuments"),
      showProgress: true,
      duration: 90,
      extra_info: files.length > 0 ? t("upload.status.largeDocumentsHint") : "",
    });

    const selectedLanguage = generationConfig.language ?? null;
    const preparationController = new AbortController();

    try {
      // Generation always consumes selected documents. The feature flag only
      // controls whether those documents also ground the earlier rewrite.
      const prepared = await ensureDocumentsPrepared(
        preparationController.signal,
      );
      const documentPaths = documentPathsOf(prepared);

      setLoadingState({
        isLoading: true,
        message: t("upload.status.generatingOutline"),
        showProgress: true,
        duration: 40,
        extra_info: "",
      });

      const createResponse = await PresentationGenerationApi.createPresentation({
        content: generationConfig.prompt,
        n_slides: parseLimitedSlideCount(generationConfig.slides),
        file_paths: documentPaths,
        language: selectedLanguage,
        tone: generationConfig.tone,
        verbosity: generationConfig.verbosity,
        instructions: generationConfig.instructions || null,
        web_search: !!generationConfig.webSearch,
      });

      dispatch(setPptGenUploadState({
        config: generationConfig,
        files: prepared?.documents ?? [],
      }));
      dispatch(clearOutlines());
      dispatch(setPresentationId(createResponse.id));
      const destination = getGenerationDestination(createResponse.id);
      router.push(destination);
    } catch (error) {
      // The prepared server-side files may be stale; drop the caches so the
      // next attempt re-prepares from the still-selected local files.
      invalidatePreparedDocuments();
      throw error;
    }
  };

  /**
   * Handles direct presentation generation without documents
   */
  const handleDirectPresentationGeneration = async (
    generationConfig: PresentationConfig,
  ) => {
      setLoadingState({
        isLoading: true,
        message: t("upload.status.preparingOutline"),
      showProgress: true,
      duration: 30,
    });

    const selectedLanguage = generationConfig.language ?? null;

    const createResponse = await PresentationGenerationApi.createPresentation({
      content: generationConfig.prompt,

      n_slides: parseLimitedSlideCount(generationConfig.slides),
      file_paths: [],
      language: selectedLanguage,
      tone: generationConfig.tone,
      verbosity: generationConfig.verbosity,
      instructions: generationConfig.instructions || null,
      web_search: !!generationConfig.webSearch,
    });

    dispatch(setPptGenUploadState({
      config: generationConfig,
      files: [],
    }));
    dispatch(clearOutlines());
    dispatch(setPresentationId(createResponse.id));
    const destination = getGenerationDestination(createResponse.id);
    router.push(destination);
  };

  /**
   * Handles errors during presentation generation
   */
  const handleGenerationError = (error: any) => {
    console.error("Error in upload page", error);
    setLoadingState({
      isLoading: false,
      message: "",
      duration: 0,
      showProgress: false,
    });
    notify.error(
      t("upload.error.generationTitle"),
      error.message || t("upload.error.generationFallback")
    );
  };

  return (
    <Wrapper className="w-full">
      <OverlayLoader
        show={loadingState.isLoading}
        text={loadingState.message}
        showProgress={loadingState.showProgress}
        duration={loadingState.duration}
        extra_info={loadingState.extra_info}
      />
      <div className="mx-auto flex min-h-[100dvh] max-w-[760px] flex-col px-4 pb-10 lg:max-w-[780px] xl:max-w-[900px]">
        <GSlideStudioTitle
          title={t("upload.hero.title")}
          description={t("upload.hero.subtitle")}
          compact
          className="pt-10 sm:pt-12 2xl:pt-14"
        />
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <ConfigurationSelects
            compact
            config={config}
            onConfigChange={handleConfigChange}
          />
        </div>

        <div className="mt-8 flex flex-col gap-2.5">
            <PromptInput
              value={config.prompt}
              onChange={handleSourcePromptChange}
              onSubmit={handleGeneratePresentation}
              onRewrite={handleRewritePrompt}
            >
              <SupportingDoc
                files={files}
                onFilesChange={handleFilesChange}
                disabled={loadingState.isLoading}
                usageMode={
                  files.length === 0
                    ? "none"
                    : documentAwareRewrite
                      ? "doc_aware"
                      : "presentation_only"
                }
                action={
                  // Inside the composer, bottom-right. Bare Enter calls the
                  // same handler. Ctrl/Cmd+Enter still creates the presentation.
                  // The label follows the rewrite state machine: loading while
                  // in flight, retry after an error, update when a stale result
                  // exists, and the base action otherwise.
                  <GSlideButton
                    type="button"
                    disabled={!promptRequiresRewrite || isRewriting}
                    aria-busy={isRewriting}
                    onClick={handleRewritePrompt}
                    data-testid="rewrite-action-button"
                    className="ml-auto h-8 shrink-0 whitespace-nowrap px-3.5 py-1.5"
                  >
                    {rewriteActionLabel}
                  </GSlideButton>
                }
              />
            </PromptInput>
            <RewrittenPrompt
              value={rewrittenPrompt}
              onChange={setRewrittenPrompt}
              keptOpen={rewrittenFromContextKey.length > 0}
              isLoading={isRewriting}
              phase={rewritePhase}
              isStale={isRewriteStale}
              error={rewriteError}
              onRetry={handleRewritePrompt}
              groundedDocumentCount={
                documentAwareRewrite && !isRewriteStale
                  ? files.length
                  : 0
              }
            />
            <div className="flex w-full justify-center pt-2">
              <UploadTemplatePicker
                selectedTemplateId={selectedTemplateId}
                onSelectionChange={setSelectedTemplateId}
                onAvailabilityChange={setTemplateReady}
                disabled={loadingState.isLoading}
              />
            </div>
            {/* Explicit, visible Create action below the composer, centered.
                Ctrl/Cmd+Enter still calls handleGeneratePresentation. */}
            <div className="flex w-full justify-center">
              <GSlideButton
                type="button"
                disabled={isCreateDisabled || loadingState.isLoading}
                aria-busy={loadingState.isLoading}
                aria-label={t("upload.create.ariaLabel")}
                onClick={handleGeneratePresentation}
                data-testid="generate-presentation-button"
                className="whitespace-nowrap px-5 py-3"
              >
                {t("upload.create.label")}
              </GSlideButton>
            </div>
        </div>

      </div>
    </Wrapper>
  );
};

export default UploadPage;
