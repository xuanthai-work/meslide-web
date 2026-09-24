'use client'
import { useEffect, useRef, useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { PresentationGenerationApi } from '../../services/api/presentation-generation';
import { addToHistory } from '@/store/slices/undoRedoSlice';
import type { PresentationData } from '@/store/slices/presentationGeneration';
import type { Slide } from '../../types/slide';
import type { AutoSaveSnapshot } from '../utils/autoSaveDiff';
import {
    acknowledgeSavedMetadata,
    acknowledgeSavedSlide,
    createAutoSaveSnapshot,
    getAutoSaveChanges,
    nextAutoSaveTick,
    queueAutoSaveTimer,
} from '../utils/autoSaveDiff';

interface UseAutoSaveOptions {
    debounceMs?: number;
    enabled?: boolean;
}

export const useAutoSave = ({
    debounceMs = 1000,
    enabled = true,
}: UseAutoSaveOptions = {}) => {
   
    const dispatch = useDispatch();
    const { presentationData, isStreaming, isLoading, isLayoutLoading } = useSelector(
        (state: RootState) => state.presentationGeneration
    );

    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const acknowledgedDataRef = useRef<AutoSaveSnapshot | null>(null);
    const latestDataRef = useRef<PresentationData | null>(presentationData);
    const autoSavePausedRef = useRef(true);
    const wasAutoSavePausedRef = useRef(false);
    const pendingSaveRef = useRef(false);
    const saveLatestRef = useRef<() => Promise<void>>(async () => undefined);
    const isSavingRef = useRef(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);

    const autoSavePaused =
        !enabled || isStreaming || isLoading || isLayoutLoading;

    useEffect(() => {
        latestDataRef.current = presentationData;
        autoSavePausedRef.current = autoSavePaused;
    }, [presentationData, autoSavePaused]);

    const saveLatest = useCallback(async () => {
        const data = latestDataRef.current;
        if (!data || autoSavePausedRef.current) return;
        if (isSavingRef.current) {
            pendingSaveRef.current = true;
            return;
        }

        const acknowledged = acknowledgedDataRef.current;
        if (!acknowledged || acknowledged.presentationId !== data.id) {
            acknowledgedDataRef.current = createAutoSaveSnapshot(data);
            return;
        }

        const changes = getAutoSaveChanges(acknowledged, data);
        if (
            !changes.structuralChange &&
            !changes.metadataChanged &&
            changes.changedSlides.length === 0
        ) return;

        try {
            isSavingRef.current = true;
            setIsSaving(true);
            console.log('🔄 Auto-saving presentation data...');

            if (changes.structuralChange) {
                // Serialize once after the debounce window. The API accepts the
                // serialized body and avoids a second whole-deck stringify.
                await PresentationGenerationApi.updatePresentationContent(
                    JSON.stringify(data)
                );
                acknowledgedDataRef.current = createAutoSaveSnapshot(data);
            } else {
                let firstError: unknown = null;
                let nextAcknowledged: AutoSaveSnapshot = {
                    ...acknowledged,
                    slideFingerprints: { ...acknowledged.slideFingerprints },
                };

                if (changes.metadataChanged) {
                    try {
                        await PresentationGenerationApi.updatePresentationContent({
                            id: data.id,
                            title: data.title,
                            theme: data.theme,
                        });
                        nextAcknowledged = acknowledgeSavedMetadata(nextAcknowledged, data);
                        acknowledgedDataRef.current = nextAcknowledged;
                    } catch (error) {
                        firstError = error;
                    }
                }

                for (const slide of changes.changedSlides) {
                    try {
                        await PresentationGenerationApi.updatePresentationSlide(
                            slide as unknown as Slide
                        );
                        nextAcknowledged = acknowledgeSavedSlide(nextAcknowledged, slide);
                        acknowledgedDataRef.current = nextAcknowledged;
                    } catch (error) {
                        firstError ??= error;
                    }
                }

                if (firstError) throw firstError;
                acknowledgedDataRef.current = createAutoSaveSnapshot(data);
            }

            console.log('✅ Auto-save successful');
        } catch (error) {
            console.error('❌ Auto-save failed:', error);
        } finally {
            isSavingRef.current = false;
            setIsSaving(false);

            if (pendingSaveRef.current && !autoSavePausedRef.current) {
                pendingSaveRef.current = false;
                saveTimeoutRef.current = queueAutoSaveTimer(
                    saveTimeoutRef.current,
                    250,
                    () => {
                        void saveLatestRef.current();
                    },
                );
            }
        }
    }, []);

    useEffect(() => {
        saveLatestRef.current = saveLatest;
    }, [saveLatest]);

    // Effect to trigger auto-save when presentation data changes
    useEffect(() => {
        if (!presentationData) return;

        const decision = nextAutoSaveTick({
            data: presentationData,
            paused: autoSavePaused,
            wasPaused: wasAutoSavePausedRef.current,
            saving: isSavingRef.current,
            acknowledged: acknowledgedDataRef.current,
        });
        wasAutoSavePausedRef.current = decision.wasPaused;
        const tick = decision.tick;

        if (tick.kind === "paused") {
            // Changes arriving while editing is paused are server-originated
            // hydration/streaming updates and are already persisted.
            pendingSaveRef.current = false;
            if (tick.snapshot) acknowledgedDataRef.current = tick.snapshot;
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = null;
            }
            return;
        }

        if (tick.recordHistory) {
            // History is updated immediately from immutable Redux snapshots. It is
            // independent from network debounce, so even the first edit can undo.
            dispatch(addToHistory({
                slides: presentationData.slides,
                actionType: "AUTO_SAVE"
            }));
        }

        if (tick.kind === "resumed") {
            // The final streaming/loading payload can land in the same render
            // that flips editing back on. Treat that first active snapshot as
            // already persisted instead of issuing slide updates for it.
            acknowledgedDataRef.current = tick.snapshot;
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = null;
            }
            return;
        }

        if (tick.kind === "baseline") {
            acknowledgedDataRef.current = tick.snapshot;
            return;
        }

        saveTimeoutRef.current = queueAutoSaveTimer(
            saveTimeoutRef.current,
            debounceMs,
            () => {
                void saveLatestRef.current();
            },
        );

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [
        presentationData,
        autoSavePaused,
        debounceMs,
        dispatch,
    ]);
    
    return {
        isSaving,
    };
};
