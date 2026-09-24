import type { DeckSlide, PresentationData } from "@/store/slices/presentationGeneration";

export interface AutoSaveSnapshot {
  presentationId: string;
  slideOrder: string[];
  slideFingerprints: Record<string, string>;
  metadataFingerprint: string;
}

export interface AutoSaveChanges {
  structuralChange: boolean;
  changedSlides: DeckSlide[];
  metadataChanged: boolean;
}

export const fingerprintValue = (value: unknown): string =>
  JSON.stringify(value) ?? "";

const getSlideId = (slide: { id?: unknown } | null | undefined): string | null =>
  typeof slide?.id === "string" && slide.id.length > 0 ? slide.id : null;

export const createAutoSaveSnapshot = (
  data: PresentationData
): AutoSaveSnapshot => {
  const slides = Array.isArray(data.slides) ? data.slides : [];
  const slideOrder: string[] = [];
  const slideFingerprints: Record<string, string> = {};

  for (const slide of slides) {
    const id = getSlideId(slide);
    if (!id) continue;
    slideOrder.push(id);
    slideFingerprints[id] = fingerprintValue(slide);
  }

  return {
    presentationId: data.id,
    slideOrder,
    slideFingerprints,
    metadataFingerprint: fingerprintValue({
      title: data.title,
      theme: data.theme,
    }),
  };
};

export const getAutoSaveChanges = (
  acknowledged: AutoSaveSnapshot,
  data: PresentationData
): AutoSaveChanges => {
  const slides = Array.isArray(data.slides) ? data.slides : [];
  const ids = slides.map(getSlideId);
  const validIds = ids.filter((id): id is string => id !== null);
  const hasInvalidOrDuplicateIds =
    validIds.length !== slides.length || new Set(validIds).size !== validIds.length;
  const orderChanged =
    validIds.length !== acknowledged.slideOrder.length ||
    validIds.some((id, index) => id !== acknowledged.slideOrder[index]);
  const indicesChanged = slides.some(
    (slide, index: number) => slide?.index !== index
  );
  const structuralChange =
    hasInvalidOrDuplicateIds || orderChanged || indicesChanged;

  const changedSlides = structuralChange
    ? []
    : slides.filter((slide) => {
        const id = getSlideId(slide);
        return (
          id !== null &&
          acknowledged.slideFingerprints[id] !== fingerprintValue(slide)
        );
      });

  return {
    structuralChange,
    changedSlides,
    metadataChanged:
      acknowledged.metadataFingerprint !==
      fingerprintValue({ title: data.title, theme: data.theme }),
  };
};

export function acknowledgeSavedMetadata(
  snapshot: AutoSaveSnapshot,
  data: Pick<PresentationData, "title" | "theme">,
): AutoSaveSnapshot {
  return {
    ...snapshot,
    metadataFingerprint: fingerprintValue({
      title: data.title,
      theme: data.theme,
    }),
  };
}

export function acknowledgeSavedSlide(
  snapshot: AutoSaveSnapshot,
  slide: DeckSlide,
): AutoSaveSnapshot {
  const id = getSlideId(slide);
  if (!id) return snapshot;
  return {
    ...snapshot,
    slideFingerprints: {
      ...snapshot.slideFingerprints,
      [id]: fingerprintValue(slide),
    },
  };
}

export type AutoSaveTick =
  | { kind: "idle"; recordHistory: false }
  | { kind: "paused"; snapshot: AutoSaveSnapshot | null; recordHistory: false }
  | { kind: "resumed"; snapshot: AutoSaveSnapshot; recordHistory: true }
  | { kind: "baseline"; snapshot: AutoSaveSnapshot; recordHistory: true }
  | { kind: "schedule"; recordHistory: true };

/** What the autosave effect should do for one Redux snapshot. */
export function nextAutoSaveTick(input: {
  data: PresentationData | null;
  paused: boolean;
  wasPaused: boolean;
  saving: boolean;
  acknowledged: AutoSaveSnapshot | null;
}): { tick: AutoSaveTick; wasPaused: boolean } {
  const { data, paused, wasPaused, saving, acknowledged } = input;
  if (!data) return { tick: { kind: "idle", recordHistory: false }, wasPaused };
  if (paused) {
    return {
      tick: {
        kind: "paused",
        snapshot: saving ? null : createAutoSaveSnapshot(data),
        recordHistory: false,
      },
      wasPaused: true,
    };
  }
  if (wasPaused) {
    return {
      tick: { kind: "resumed", snapshot: createAutoSaveSnapshot(data), recordHistory: true },
      wasPaused: false,
    };
  }
  if (!acknowledged || acknowledged.presentationId !== data.id) {
    return {
      tick: { kind: "baseline", snapshot: createAutoSaveSnapshot(data), recordHistory: true },
      wasPaused: false,
    };
  }
  return { tick: { kind: "schedule", recordHistory: true }, wasPaused: false };
}

export function queueAutoSaveTimer<T>(
  existing: T | null,
  waitMs: number,
  run: () => void,
  timers?: {
    set: (callback: () => void, waitMs: number) => T;
    clear: (timer: T) => void;
  },
): T {
  const set = timers?.set ?? ((callback, ms) => setTimeout(callback, ms) as T);
  const clear = timers?.clear ?? ((timer) => {
    clearTimeout(timer as ReturnType<typeof setTimeout>);
  });
  if (existing != null) clear(existing);
  return set(run, waitMs);
}
