/**
 * UploadPage Component
 * 
 * This component handles the presentation generation upload process, allowing users to:
 * - Configure presentation settings (slides, language)
 * - Enter an idea plus optional AI instructions, or paste a full outline
 * - Upload supporting documents
 * 
 * @component
 */

"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { clearOutlines, setPresentationId } from "@/store/slices/presentationGeneration";
import { OutlineComposer, type OutlinePhase } from "./OutlineComposer";
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
  detectSlideCountFromText,
  parseLimitedSlideCount,
} from "@/utils/presentationLimits";
import { useT } from "@/i18n/provider";
import { useFeatureFlags } from "@/components/FeatureFlagsProvider";
import { GSlideButton, GSlideStudioTitle } from "@/components/gslide";
import { UploadTemplatePicker } from "./UploadTemplatePicker";
import { useTemplateSummaries } from "../../hooks/useTemplateSummaries";
import { resolveTemplateForCreate } from "../services/template-selection";

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
  const { defaultTemplates, loading: templatesLoading, error: templatesError, retry: retryTemplates } = useTemplateSummaries();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [confirmedTemplateId, setConfirmedTemplateId] = useState<string | null>(null);
  const createInFlightRef = useRef(false);
  const templateReady = !templatesLoading && !templatesError &&
    defaultTemplates.some((item) => item.id === selectedTemplateId);
  const handlePreviewSelection = useCallback((id: string | null) => {
    setSelectedTemplateId(id);
    setConfirmedTemplateId((confirmed) => confirmed === id ? confirmed : null);
  }, []);
  const handleConfirmSelection = useCallback((id: string) => {
    setSelectedTemplateId(id);
    setConfirmedTemplateId(id);
  }, []);
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

  // --- AI outline generation ------------------------------------------
  // `config.instructions` (box 1) is the idea and never overwritten by the
  // AI. The result lands in `config.prompt` (box 2), the outline the user
  // then edits by hand and creates from. Nothing here gates Create: the
  // outline is an optional accelerator, not a required step.
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewritePhase, setRewritePhase] = useState<OutlinePhase | null>(null);
  const [rewriteError, setRewriteError] = useState<string | null>(null);

  // "Follow the outline exactly" — the checkbox that promotes a slide count
  // detected in box 2 over the slide-count dropdown.
  const [strictOutline, setStrictOutline] = useState(false);

  // One AbortController for the latest in-flight request plus a
  // monotonically increasing request ID. Starting a newer generation (or
  // leaving the page) aborts the previous request, and the ID check below
  // discards its response even when the abort arrives too late for the
  // fetch to reject. The same controller covers the document preparation
  // (upload + decompose) that a document-aware outline performs first.
  const rewriteAbortRef = useRef<AbortController | null>(null);
  const rewriteRequestIdRef = useRef(0);

  // --- Document preparation cache ---------------------------------------
  // `preparedDocumentsRef` holds the decomposed set for the current file
  // fingerprint and language; `uploadedOriginalsRef` holds the uploaded
  // originals per fingerprint so a language change re-decomposes without
  // re-uploading. Both keys are derived, never stored as flags. A ref (not
  // state) is enough: async flows only ever read the latest set, and nothing
  // renders from it.
  const preparedDocumentsRef = useRef<PreparedDocumentSet | null>(null);
  const uploadedOriginalsRef = useRef<{
    fileFingerprint: string;
    paths: string[];
  } | null>(null);

  const invalidatePreparedDocuments = () => {
    preparedDocumentsRef.current = null;
    uploadedOriginalsRef.current = null;
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
    preparedDocumentsRef.current = prepared;
    return prepared;  };

  const sourcePrompt = config.prompt.trim();
  const hasContentInput = sourcePrompt.length > 0;
  const hasAttachedDocuments = files.length > 0;
  // An outline that numbers its own slides is a better source of the slide
  // count than the dropdown, but only when the user asks to follow it
  // exactly — otherwise the configured count still wins.
  const detectedSlidesCount = useMemo(
    () => detectSlideCountFromText(sourcePrompt),
    [sourcePrompt]
  );
  const effectiveSlides =
    (strictOutline && detectedSlidesCount) || parseLimitedSlideCount(config.slides);
  // The AI outline is an accelerator, never a prerequisite: Create opens as
  // soon as box 2 has content or a document is attached.
  const isCreateDisabled =
    !templateReady ||
    !selectedTemplateId ||
    isRewriting ||
    loadingState.isLoading ||
    (!hasContentInput && !hasAttachedDocuments);

  // The action label follows the active preparation phase so the user can
  // tell what is actually happening before the AI call itself runs.
  const rewriteActionLabel = isRewriting
    ? rewritePhase === "uploading_documents"
      ? t("upload.prompt.rewrite.phaseUploading")
      : rewritePhase === "reading_documents"
        ? t("upload.prompt.rewrite.phaseReading")
        : t("upload.prompt.rewrite.loading")
    : rewriteError
      ? t("upload.prompt.rewrite.retryAction")
      : t("upload.outline.action");

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

  /**
   * Edits to either box retire an in-flight outline: a response computed
   * from text the user has since changed must never land. The request ID is
   * bumped as a fallback for providers that cannot cancel an already
   * completed response, and a stale error is dropped so the next attempt
   * starts clean.
   */
  const handleComposerTextChange = (
    key: "prompt" | "instructions",
    value: string
  ) => {
    if (isRewriting) {
      rewriteRequestIdRef.current += 1;
      rewriteAbortRef.current?.abort();
      rewriteAbortRef.current = null;
      setIsRewriting(false);
      setRewritePhase(null);
    }
    setRewriteError(null);
    handleConfigChange(key, value);
  };

  /**
   * A changed file set invalidates any in-flight outline: the active work
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
   * Generates an outline with AI from box 1 (the idea and any instructions)
   * plus the selected documents, and writes the result straight into box 2.
   * Box 1 is never overwritten. The previous box-2 text is forwarded as
   * `previousPrompt` so a second run refines the current outline instead of
   * starting over. Documents are prepared (upload + decompose) first when the
   * document-aware flag is on; the decomposed paths ground the request. On
   * failure the user sees a localized fallback, never the raw API error.
   */
  const handleGenerateOutline = async () => {
    if (isRewriting) return;

    const idea = config.instructions.trim();
    const previousOutline = config.prompt.trim();
    // With no typed idea the attached file names are the only signal the
    // user gave, so they seed the request instead of sending nothing.
    const seedSource =
      idea || files.map((file) => file.name).join(", ") || config.prompt.trim();
    if (!seedSource) return;

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
    // outline generation.
    let phase: OutlinePhase = "rewriting";
    const applyPhase = (next: OutlinePhase) => {
      phase = next;
      setRewritePhase(next);
    };
    const hadDocuments = files.length > 0;

    try {
      // Prepare the selected documents once per file set and language; the
      // decomposed text paths ground the outline on the server. When the
      // document-aware flag is off, preparation is skipped and the request
      // falls back to the prompt-only body that the API has always supported.
      let filePaths: string[] | undefined;
      if (hadDocuments && documentAwareRewrite) {
        const prepared = await ensureDocumentsPrepared(
          controller.signal,
          applyPhase
        );
        if (requestId !== rewriteRequestIdRef.current) return;
        filePaths = documentPathsOf(prepared);
      }

      const requestOutline = (paths?: string[]) =>
        PresentationGenerationApi.rewritePrompt({
          prompt: seedSource,
          previousPrompt: previousOutline || undefined,
          language: config.language,
          nSlides: effectiveSlides ?? null,
          filePaths: paths,
          signal: controller.signal,
        });

      let result: string;
      try {
        applyPhase("rewriting");
        result = await requestOutline(filePaths);
      } catch (error) {
        // An expired server-side document is healed once through the
        // normal safe path: drop the caches, re-prepare the same local
        // files, and retry.
        if (!filePaths || !isStaleDocumentError(error)) throw error;
        invalidatePreparedDocuments();
        const prepared = await ensureDocumentsPrepared(
          controller.signal,
          applyPhase
        );
        if (requestId !== rewriteRequestIdRef.current) return;
        applyPhase("rewriting");
        result = await requestOutline(documentPathsOf(prepared));
      }

      if (requestId !== rewriteRequestIdRef.current) return;
      handleConfigChange("prompt", result);
      notify.success(
        t("upload.outline.successTitle"),
        t("upload.outline.successDescription")
      );
    } catch (error: unknown) {
      if (requestId !== rewriteRequestIdRef.current) return;
      // Raw error text is for the console only; the UI gets the localized
      // fallback and keeps whatever the user had already typed. Preparation
      // failures (upload/decompose) get their own message.
      console.error("Error generating outline", error);
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

  const getGenerationDestination = (presentationId: string, templateId: string) => {
    const params = new URLSearchParams({
      id: presentationId,
      auto: "1",
      template: templateId,
    });
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

    if (!hasContentInput && !hasAttachedDocuments) {
      notify.warning(
        t("upload.validation.inputRequiredTitle"),
        t("upload.validation.inputRequiredDescription")
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
    // never start a Create while an outline request or a previous Create is
    // active.
    if (createInFlightRef.current || isRewriting || loadingState.isLoading || !templateReady) return;
    if (!validateConfiguration()) return;
    createInFlightRef.current = true;
    setLoadingState({
      isLoading: true,
      message: t("upload.status.preparingOutline"),
      showProgress: true,
    });

    // Capture the exact configuration being submitted. From this point on,
    // neither an edit to either box nor another settings change can alter
    // the content used by the in-flight generation request. Box 2 becomes
    // `content`, box 1 rides along as `instructions`.
    const generationConfig: PresentationConfig = {
      ...config,
      prompt: sourcePrompt,
    };
    const candidateSnapshot = [...defaultTemplates];
    const confirmedSnapshot = confirmedTemplateId;

    try {
      const templateId = await resolveTemplateForCreate({
        prompt: generationConfig.prompt,
        confirmedTemplateId: confirmedSnapshot,
        templates: candidateSnapshot,
      });
      const hasUploadedAssets = files.length > 0;

      if (hasUploadedAssets) {
        await handleDocumentProcessing(generationConfig, templateId);
      } else {
        await handleDirectPresentationGeneration(generationConfig, templateId);
      }
    } catch (error) {
      handleGenerationError(error);
    } finally {
      createInFlightRef.current = false;
    }
  };

  /**
   * Handles document processing: reuses the prepared document set (or
   * prepares it now for document-only creation) instead of uploading and
   * decomposing again, then creates the presentation.
   */
  const handleDocumentProcessing = async (
    generationConfig: PresentationConfig,
    templateId: string,
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
      // controls whether those documents also ground the AI outline.
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
        n_slides: effectiveSlides ?? null,
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
      const destination = getGenerationDestination(createResponse.id, templateId);
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
    templateId: string,
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
      n_slides: effectiveSlides ?? null,
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
    const destination = getGenerationDestination(createResponse.id, templateId);
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
            <OutlineComposer
              idea={config.instructions}
              onIdeaChange={(value) =>
                handleComposerTextChange("instructions", value)
              }
              content={config.prompt}
              onContentChange={(value) =>
                handleComposerTextChange("prompt", value)
              }
              detectedSlidesCount={detectedSlidesCount}
              strictOutline={strictOutline}
              onStrictOutlineChange={setStrictOutline}
              actionLabel={rewriteActionLabel}
              isGenerating={isRewriting}
              onGenerate={handleGenerateOutline}
              canGenerate={!!(config.instructions.trim() || files.length > 0)}
              phase={rewritePhase}
              error={rewriteError}
              onRetry={handleGenerateOutline}
              onSubmit={handleGeneratePresentation}
              disabled={loadingState.isLoading}
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
              />
            </OutlineComposer>
            <div className="flex w-full justify-center pt-2">
              <UploadTemplatePicker
                templates={defaultTemplates}
                loading={templatesLoading}
                error={templatesError}
                retry={retryTemplates}
                selectedTemplateId={selectedTemplateId}
                isConfirmed={confirmedTemplateId !== null && confirmedTemplateId === selectedTemplateId}
                onSelectionChange={handlePreviewSelection}
                onConfirmSelection={handleConfirmSelection}
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
