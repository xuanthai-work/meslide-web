import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";

import { useT } from "@/i18n/provider";
import type { GenerationLifecycleState } from "@/lib/generation-lifecycle";
import {
  clearOutlines,
  clearPresentationData,
  setOutlines,
} from "@/store/slices/presentationGeneration";
import type { RootState } from "@/store/store";
import { limitOutlines } from "@/utils/presentationLimits";
import { useOutlineStreaming } from "../../outline/hooks/useOutlineStreaming";
import { PresentationGenerationApi } from "../../services/api/presentation-generation";

type BootstrapPhase =
  | "idle"
  | "checking"
  | "outlining"
  | "preparing"
  | "failed"
  | "complete";

/**
 * Runs the former outline-page checkpoint in the background.
 *
 * The generated outline is still persisted and remains the source of truth for
 * slide generation. The user still chooses a template first, but the normal
 * creation flow no longer asks them to review or approve the outline.
 */
export function useAutomaticPresentationGeneration(
  presentationId: string,
  enabled: boolean,
  templateId: string | null,
) {
  const dispatch = useDispatch();
  const router = useRouter();
  const t = useT();
  const outlines = useSelector(
    (state: RootState) => state.presentationGeneration.outlines,
  );
  const [phase, setPhase] = useState<BootstrapPhase>(
    enabled ? "checking" : "idle",
  );
  const [outlineStreamEnabled, setOutlineStreamEnabled] = useState(false);
  const [hasPersistedOutline, setHasPersistedOutline] = useState(false);
  const [failureMessage, setFailureMessage] = useState("");
  const [hydrationAttempt, setHydrationAttempt] = useState(0);
  const prepareInFlightRef = useRef(false);
  const preparedRef = useRef(false);
  const cancelledByUserRef = useRef(false);

  const outlineStream = useOutlineStreaming(
    presentationId,
    enabled && outlineStreamEnabled,
  );

  useEffect(() => {
    if (!enabled) {
      setPhase("idle");
      setOutlineStreamEnabled(false);
      return;
    }

    if (!templateId) {
      setPhase("idle");
      setOutlineStreamEnabled(false);
      return;
    }

    let cancelled = false;
    cancelledByUserRef.current = false;
    preparedRef.current = false;
    prepareInFlightRef.current = false;
    setPhase("checking");
    setFailureMessage("");
    setHasPersistedOutline(false);
    setOutlineStreamEnabled(false);
    dispatch(clearOutlines());

    void PresentationGenerationApi.getOutlines(presentationId)
      .then((response) => {
        if (cancelled) return;
        const persistedOutlines = limitOutlines(response?.slides ?? []);
        if (persistedOutlines.length > 0) {
          dispatch(setOutlines(persistedOutlines));
          setHasPersistedOutline(true);
          setPhase("outlining");
          return;
        }
        setPhase("outlining");
        setOutlineStreamEnabled(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof Error
            ? error.message
            : t("outline.toast.connectFailed.description");
        setFailureMessage(message);
        setPhase("failed");
      });

    return () => {
      cancelled = true;
    };
  }, [dispatch, enabled, hydrationAttempt, presentationId, t, templateId]);

  const outlineReady =
    hasPersistedOutline || outlineStream.lifecycle === "complete";

  useEffect(() => {
    if (
      !enabled ||
      !templateId ||
      phase !== "outlining" ||
      !outlineReady ||
      outlines.length === 0 ||
      prepareInFlightRef.current ||
      preparedRef.current
    ) {
      return;
    }

    prepareInFlightRef.current = true;
    setPhase("preparing");
    setFailureMessage("");

    void PresentationGenerationApi.presentationPrepare({
      presentation_id: presentationId,
      outlines: limitOutlines(outlines),
      layout: templateId,
    })
      .then(() => {
        if (cancelledByUserRef.current) return;
        preparedRef.current = true;
        setPhase("complete");
        dispatch(clearPresentationData());
        router.replace(
          `/presentation?id=${presentationId}&stream=true`,
        );
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error
            ? error.message
            : t("outline.toast.generationError.fallbackDescription");
        setFailureMessage(message);
        setPhase("failed");
      })
      .finally(() => {
        prepareInFlightRef.current = false;
      });
  }, [
    dispatch,
    enabled,
    outlineReady,
    outlines,
    phase,
    presentationId,
    router,
    t,
    templateId,
  ]);

  const retry = useCallback(() => {
    if (phase === "failed") {
      setFailureMessage("");
      if (outlines.length > 0) {
        setPhase("outlining");
      } else {
        setHydrationAttempt((attempt) => attempt + 1);
      }
      return;
    }
    outlineStream.retry();
  }, [outlineStream, outlines.length, phase]);

  const cancel = useCallback(async () => {
    cancelledByUserRef.current = true;
    await outlineStream.cancel();
    router.replace(`/presentation?id=${presentationId}&auto=1`);
  }, [outlineStream, presentationId, router]);

  let lifecycle: GenerationLifecycleState = outlineStream.lifecycle;
  let statusMessage = outlineStream.statusMessage;

  if (!enabled || phase === "idle" || phase === "complete") {
    lifecycle = phase === "complete" ? "complete" : "idle";
  } else if (phase === "checking") {
    lifecycle = "connecting";
    statusMessage = t("outline.status.preparing");
  } else if (phase === "preparing") {
    lifecycle = "generating";
    statusMessage = t("outline.loading.generatingPresentationData");
  } else if (phase === "failed") {
    lifecycle = "failed";
    statusMessage =
      failureMessage || t("outline.toast.generationError.fallbackDescription");
  }

  return {
    active: enabled && phase !== "idle" && phase !== "complete",
    lifecycle,
    statusMessage,
    draftCount: outlines.length,
    canKeepWaiting:
      phase === "outlining" && outlineStream.canKeepWaiting,
    cancel,
    keepWaiting: outlineStream.keepWaiting,
    retry,
  };
}
