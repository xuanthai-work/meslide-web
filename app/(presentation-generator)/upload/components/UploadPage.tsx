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
import { motion, type Variants } from "motion/react";
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
import { useFeatureFlags } from "@/components/FeatureFlagsProvider";
import { GSlideButton, GSlideStudioTitle } from "@/components/gslide";
import { UploadTemplatePicker } from "./UploadTemplatePicker";
import { useTemplateSummaries } from "../../hooks/useTemplateSummaries";
import { resolveTemplateForCreate } from "../services/template-selection";
import {
  PresentationPreparingModal,
  computePreparingStep,
} from "../../components/PresentationPreparingModal";
import { useAutomaticPresentationGeneration } from "../../presentation/hooks/useAutomaticPresentationGeneration";

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

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
};

const UploadPage = () => {
  const { documentAwareRewrite } = useFeatureFlags();
  const dispatch = useDispatch();

  const [files, setFiles] = useState<File[]>([]);
  const { defaultTemplates, loading: templatesLoading, error: templatesError, retry: retryTemplates } = useTemplateSummaries();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [confirmedTemplateId, setConfirmedTemplateId] = useState<string | null>(null);
  const createInFlightRef = useRef(false);
  const templateReady = !templatesLoading && !templatesError && defaultTemplates.length > 0;
  const handlePreviewSelection = useCallback((id: string | null) => {
    setSelectedTemplateId(id);
  }, []);
  const handleConfirmSelection = useCallback((id: string | null) => {
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

  const [loadingState] = useState<LoadingState>({
    isLoading: false,
    message: "",
    duration: 4,
    showProgress: false,
    extra_info: "",
  });

  const [activePresentationId, setActivePresentationId] = useState<string | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [isPreparingModalOpen, setIsPreparingModalOpen] = useState(false);
  const [isCreatingPresentation, setIsCreatingPresentation] = useState(false);
  const [preparingError, setPreparingError] = useState<string | null>(null);
  const preparingAbortControllerRef = useRef<AbortController | null>(null);
  const [maxStep, setMaxStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  const automaticGeneration = useAutomaticPresentationGeneration(
    activePresentationId || "",
    !!activePresentationId,
    activeTemplateId,
  );

  const computedStep = computePreparingStep({
    isCreating: isCreatingPresentation,
    phase: automaticGeneration.phase,
    statusCode: automaticGeneration.statusCode,
  });

  useEffect(() => {
    setMaxStep((current) => (computedStep > current ? computedStep : current));
  }, [computedStep]);

  const currentPreparingStep = isPreparingModalOpen
    ? (Math.max(maxStep, computedStep) as 1 | 2 | 3 | 4 | 5)
    : 1;

  const currentPreparingError =
    preparingError ||
    (automaticGeneration.lifecycle === "failed"
      ? automaticGeneration.statusMessage
      : null);

  // --- AI outline generation ------------------------------------------
  // `config.instructions` (box 1) is the idea and never overwritten by the
  // AI. The result lands in `config.prompt` (box 2), the outline the user
  // then edits by hand and creates from. Nothing here gates Create: the
  // outline is an optional accelerator, not a required step.
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewritePhase, setRewritePhase] = useState<OutlinePhase | null>(null);
  const [rewriteError, setRewriteError] = useState<string | null>(null);

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
    return prepared;
  };

  const sourcePrompt = config.prompt.trim();
  const hasContentInput = sourcePrompt.length > 0;
  const hasAttachedDocuments = files.length > 0;
  // Purely informational: an outline that numbers its own slides always
  // keeps that sequence (the backend pins it), so showing the count just
  // tells the user what to expect before they create.
  const detectedSlidesCount = useMemo(
    () => detectSlideCountFromText(sourcePrompt),
    [sourcePrompt]
  );
  // The AI outline is an accelerator, never a prerequisite: Create opens as
  // soon as box 2 has content or a document is attached.
  const isCreateDisabled =
    !templateReady ||
    isRewriting ||
    loadingState.isLoading ||
    isPreparingModalOpen ||
    (!hasContentInput && !hasAttachedDocuments);

  // The action label follows the active preparation phase so the user can
  // tell what is actually happening before the AI call itself runs.
  const rewriteActionLabel = isRewriting
    ? rewritePhase === "uploading_documents"
      ? "Đang tải tài liệu lên..."
      : rewritePhase === "reading_documents"
        ? "Đang đọc tài liệu..."
        : "Đang viết lại..."
    : rewriteError
      ? "Thử lại"
      : "Viết lại";

  // Abort the in-flight rewrite or preparing when the component unmounts.
  useEffect(() => {
    return () => {
      rewriteRequestIdRef.current += 1;
      rewriteAbortRef.current?.abort();
      preparingAbortControllerRef.current?.abort();
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
          nSlides: parseLimitedSlideCount(config.slides),
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
        "Đã tạo dàn ý từ AI",
        "Bạn có thể chỉnh sửa nội dung bên dưới trước khi tạo slide."
      );
    } catch (error: unknown) {
      if (requestId !== rewriteRequestIdRef.current) return;
      // Raw error text is for the console only; the UI gets the localized
      // fallback and keeps whatever the user had already typed. Preparation
      // failures (upload/decompose) get their own message.
      console.error("Error generating outline", error);
      setRewriteError(
        phase === "rewriting"
          ? "Đã xảy ra lỗi khi tạo dàn ý. Hãy thử lại; nội dung bạn đã nhập vẫn được giữ nguyên."
          : "Đã xảy ra lỗi khi chuẩn bị tài liệu. Hãy kiểm tra các tệp và thử lại; nội dung bạn đã nhập vẫn được giữ nguyên."
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

  /**
   * Validates the current configuration and files
   * @returns boolean indicating if the configuration is valid
   */
  const validateConfiguration = (): boolean => {
    if (!config.language) {
      notify.warning("Cần chọn ngôn ngữ", "Vui lòng chọn ngôn ngữ.");
      return false;
    }

    if (files.length > 0 && config.language === LanguageType.Auto) {
      notify.warning("Cần chọn ngôn ngữ", "Vui lòng chọn ngôn ngữ trước khi xử lý tài liệu đã tải lên.");
      return false;
    }

    if (!hasContentInput && !hasAttachedDocuments) {
      notify.warning(
        "Cần có nội dung đầu vào",
        "Hãy nhập lời nhắc hoặc tải tài liệu lên."
      );
      return false;
    }
    return true;
  };

  const handleCancelPreparing = useCallback(async () => {
    preparingAbortControllerRef.current?.abort();
    preparingAbortControllerRef.current = null;
    if (activePresentationId) {
      await automaticGeneration.cancel();
    }
    setIsPreparingModalOpen(false);
    setIsCreatingPresentation(false);
    setActivePresentationId(null);
    setActiveTemplateId(null);
    setPreparingError(null);
    setMaxStep(1);
    createInFlightRef.current = false;
  }, [activePresentationId, automaticGeneration]);

  /**
   * Handles the presentation generation process
   */
  const handleGeneratePresentation = useCallback(async () => {
    // Keyboard submissions run the same eligibility checks as the button:
    // never start a Create while an outline request, modal, or previous Create is active.
    if (
      createInFlightRef.current ||
      isRewriting ||
      loadingState.isLoading ||
      isPreparingModalOpen ||
      !templateReady
    )
      return;
    if (!validateConfiguration()) return;

    createInFlightRef.current = true;
    setIsPreparingModalOpen(true);
    setIsCreatingPresentation(true);
    setPreparingError(null);
    setMaxStep(1);

    const controller = new AbortController();
    preparingAbortControllerRef.current = controller;

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

      if (controller.signal.aborted) return;

      const hasUploadedAssets = files.length > 0;
      let documentPaths: string[] = [];
      let preparedDocuments: PreparedDocumentSet | null = null;

      if (hasUploadedAssets) {
        preparedDocuments = await ensureDocumentsPrepared(controller.signal);
        documentPaths = documentPathsOf(preparedDocuments);
      }

      if (controller.signal.aborted) return;

      const selectedLanguage = generationConfig.language ?? null;

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

      if (controller.signal.aborted) return;

      dispatch(
        setPptGenUploadState({
          config: generationConfig,
          files: preparedDocuments?.documents ?? [],
        }),
      );
      dispatch(clearOutlines());
      dispatch(setPresentationId(createResponse.id));

      // Không gọi router.push ở đây. Kích hoạt hook chạy outline stream tại chỗ:
      setMaxStep(2);
      setIsCreatingPresentation(false);
      setActiveTemplateId(templateId);
      setActivePresentationId(createResponse.id);
    } catch (error: any) {
      if (controller.signal.aborted) return;
      console.error("Error creating presentation", error);
      invalidatePreparedDocuments();
      setIsCreatingPresentation(false);
      setPreparingError(
        error?.message || "Đã xảy ra lỗi khi bắt đầu tạo bài thuyết trình.",
      );
    } finally {
      createInFlightRef.current = false;
    }
  }, [
    config,
    confirmedTemplateId,
    defaultTemplates,
    dispatch,
    files,
    isPreparingModalOpen,
    isRewriting,
    loadingState.isLoading,
    sourcePrompt,
    templateReady,
  ]);

  const handleRetryPreparing = useCallback(() => {
    setPreparingError(null);
    if (activePresentationId) {
      automaticGeneration.retry();
    } else {
      void handleGeneratePresentation();
    }
  }, [activePresentationId, automaticGeneration, handleGeneratePresentation]);

  return (
    <Wrapper className="w-full">
      <OverlayLoader
        show={loadingState.isLoading}
        text={loadingState.message}
        showProgress={loadingState.showProgress}
        duration={loadingState.duration}
        extra_info={loadingState.extra_info}
      />
      <PresentationPreparingModal
        isOpen={isPreparingModalOpen}
        currentStep={currentPreparingStep}
        hasAttachedDocs={files.length > 0}
        onCancel={handleCancelPreparing}
        error={currentPreparingError}
        onRetry={handleRetryPreparing}
      />
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="mx-auto flex min-h-[100dvh] max-w-[760px] flex-col px-4 pb-10 lg:max-w-[820px] xl:max-w-[940px] 2xl:max-w-[1100px]"
      >
        <motion.div variants={itemVariants}>
          <GSlideStudioTitle
            title={"G-SLIDE"}
            description={"Biến lời nhắc hoặc tài liệu thành bài thuyết trình bằng AI"}
            compact
            className="pt-6 sm:pt-8 2xl:pt-12"
          />
        </motion.div>
        <motion.div
          variants={itemVariants}
          className="mt-8 flex flex-wrap items-center justify-center gap-2"
        >
          <ConfigurationSelects
            compact
            config={config}
            onConfigChange={handleConfigChange}
          />
        </motion.div>

        <div className="mt-8 flex flex-col gap-2.5">
            <motion.div variants={itemVariants}>
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
            </motion.div>
            <div className="flex w-full justify-center pt-2">
              <UploadTemplatePicker
                templates={defaultTemplates}
                loading={templatesLoading}
                error={templatesError}
                retry={retryTemplates}
                selectedTemplateId={selectedTemplateId}
                confirmedTemplateId={confirmedTemplateId}
                isConfirmed={confirmedTemplateId !== null && defaultTemplates.some((item) => item.id === confirmedTemplateId)}
                onSelectionChange={handlePreviewSelection}
                onConfirmSelection={handleConfirmSelection}
                disabled={loadingState.isLoading}
              />
            </div>
            {/* Explicit, visible Create action below the composer, centered.
                Ctrl/Cmd+Enter still calls handleGeneratePresentation. */}
            <motion.div
              variants={itemVariants}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="flex w-full justify-center transform-gpu"
            >
              <GSlideButton
                type="button"
                disabled={isCreateDisabled || loadingState.isLoading}
                aria-busy={loadingState.isLoading}
                aria-label={"Tạo bài thuyết trình"}
                onClick={handleGeneratePresentation}
                data-testid="generate-presentation-button"
                className="whitespace-nowrap px-5 py-3"
              >
                {"Tạo bài thuyết trình"}
              </GSlideButton>
            </motion.div>
        </div>

      </motion.div>
    </Wrapper>
  );
};

export default UploadPage;
