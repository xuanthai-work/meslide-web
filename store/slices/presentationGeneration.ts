import type { Theme } from "@/app/(presentation-generator)/services/api/types";
import {
  limitOutlines,
  MAX_NUMBER_OF_SLIDES,
} from "@/utils/presentationLimits";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import {
  firstBracketIndex,
  reindexSlides,
  setNestedContentValue,
  setNestedMediaValue,
} from "../slideContentPath";

export type PresentationVersion = "v1-standard" | "v2-standard";

/** V1 and V2 slides share this bag. Fields the editor does not use stay intact. */
export type DeckSlide = {
  id?: string | null;
  index?: number;
  content?: Record<string, unknown>;
  images?: string[] | null;
  icons?: string[] | null;
  properties?: Record<string, unknown> | null;
  ui?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export interface PresentationData {
  id: string;
  language: string;
  layout: Record<string, unknown> | null;
  n_slides: number;
  title: string;
  slides: DeckSlide[];
  theme: Theme | null;
  version?: PresentationVersion | string;
  components?: unknown;
  fonts?: unknown;
  structure?: { slides?: unknown[]; [key: string]: unknown } | null;
}

export interface ChatHtmlSelection {
  slideId?: string | null;
  slideIndex: number;
  slideNumber: number;
  html: string;
  elementTag?: string | null;
  selectedText?: string;
  selectedAt: number;
}

interface PresentationGenerationState {
  presentation_id: string | null;
  isLoading: boolean;
  isStreaming: boolean | null;
  outlines: { content: string }[];
  error: string | null;
  presentationData: PresentationData | null;
  isSlidesRendered: boolean;
  isLayoutLoading: boolean;
  enableHtmlSelector: boolean;
  chatHtmlSelection: ChatHtmlSelection | null;
}

const initialState: PresentationGenerationState = {
  presentation_id: null,
  outlines: [],
  isSlidesRendered: false,
  isLayoutLoading: false,
  isLoading: false,
  isStreaming: null,
  error: null,
  presentationData: null,
  enableHtmlSelector: false,
  chatHtmlSelection: null,
};

const presentationGenerationSlice = createSlice({
  name: "presentationGeneration",
  initialState,
  reducers: {
    setStreaming: (state, action: PayloadAction<boolean>) => {
      state.isStreaming = action.payload;
    },
    // Loading
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setLayoutLoading: (state, action: PayloadAction<boolean>) => {
      state.isLayoutLoading = action.payload;
    },
    // Presentation ID
    setPresentationId: (state, action: PayloadAction<string>) => {
      if (state.presentation_id !== action.payload) {
        state.chatHtmlSelection = null;
      }
      state.presentation_id = action.payload;
      state.error = null;
    },
    // Slides rendered
    setSlidesRendered: (state, action: PayloadAction<boolean>) => {
      state.isSlidesRendered = action.payload;
    },
    // Error
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    // Clear presentation data
    clearPresentationData: (state) => {
      state.presentationData = null;
      state.chatHtmlSelection = null;
    },
    clearOutlines: (state) => {
      state.outlines = [];
    },
    // Set outlines
    setOutlines: (state, action: PayloadAction<{ content: string }[]>) => {
      state.outlines = limitOutlines(action.payload);
    },
    // Set presentation data
    setPresentationData: (state, action: PayloadAction<PresentationData>) => {
      state.presentationData = action.payload;
      state.chatHtmlSelection = null;
    },
    setEnableHtmlSelector: (state, action: PayloadAction<boolean>) => {
      state.enableHtmlSelector = action.payload;
      if (!action.payload) state.chatHtmlSelection = null;
    },
    setChatHtmlSelection: (
      state,
      action: PayloadAction<ChatHtmlSelection>
    ) => {
      state.chatHtmlSelection = action.payload;
    },
    clearChatHtmlSelection: (state) => {
      state.chatHtmlSelection = null;
    },
    updateTitle: (state, action: PayloadAction<string>) => {
      if (state.presentationData) {
        state.presentationData.title = action.payload;
      }
    },
    deleteSlideOutline: (state, action: PayloadAction<{ index: number }>) => {
      if (state.outlines) {
        // Remove the slide at the given index
        state.outlines = state.outlines.filter(
          (_, idx) => idx !== action.payload.index
        );
      }
    },
    // SLIDE OPERATIONS
    addSlide: (
      state,
      action: PayloadAction<{ slide: DeckSlide; index: number }>
    ) => {
      if (state.presentationData?.slides) {
        if (state.presentationData.slides.length >= MAX_NUMBER_OF_SLIDES) {
          return;
        }

        // Insert the new slide at the specified index
        state.presentationData.slides.splice(
          action.payload.index,
          0,
          action.payload.slide
        );
        state.presentationData.slides = reindexSlides(state.presentationData.slides);
        state.presentationData.n_slides = state.presentationData.slides.length;
      }
    },
    deletePresentationSlide: (state, action: PayloadAction<number>) => {
      if (state.presentationData?.slides) {
        const slides = state.presentationData.slides;
        if (
          slides.length <= 1 ||
          action.payload < 0 ||
          action.payload >= slides.length
        ) {
          return;
        }

        slides.splice(action.payload, 1);
        state.presentationData.slides = reindexSlides(state.presentationData.slides);
        state.presentationData.n_slides = state.presentationData.slides.length;
      }
    },
    replaceSlidesWithBlankFallback: (
      state,
      action: PayloadAction<{ slideData: DeckSlide }>
    ) => {
      if (state.presentationData) {
        state.presentationData.slides = [
          { ...action.payload.slideData, index: 0 },
        ];
        state.presentationData.n_slides = 1;
      }
    },
    duplicatePresentationSlide: (
      state,
      action: PayloadAction<{ index: number; slideId: string }>
    ) => {
      if (state.presentationData?.slides) {
        const slides = state.presentationData.slides;
        if (slides.length >= MAX_NUMBER_OF_SLIDES) {
          return;
        }

        const sourceSlide = slides[action.payload.index];
        if (!sourceSlide) {
          return;
        }

        const duplicatedSlide = {
          ...JSON.parse(JSON.stringify(sourceSlide)),
          id: action.payload.slideId,
          index: action.payload.index + 1,
        };

        slides.splice(action.payload.index + 1, 0, duplicatedSlide);
        state.presentationData.slides = reindexSlides(slides);
        state.presentationData.n_slides = state.presentationData.slides.length;
      }
    },
    movePresentationSlide: (
      state,
      action: PayloadAction<{ fromIndex: number; toIndex: number }>
    ) => {
      if (state.presentationData?.slides) {
        const slides = state.presentationData.slides;
        const { fromIndex, toIndex } = action.payload;
        if (
          fromIndex === toIndex ||
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= slides.length ||
          toIndex >= slides.length
        ) {
          return;
        }

        const [movedSlide] = slides.splice(fromIndex, 1);
        slides.splice(toIndex, 0, movedSlide);
        state.presentationData.slides = reindexSlides(slides);
      }
    },
    updateSlide: (
      state,
      action: PayloadAction<{ index: number; slide: DeckSlide }>
    ) => {
      if (
        state.presentationData &&
        state.presentationData.slides[action.payload.index]
      ) {
        state.presentationData.slides[action.payload.index] =
          action.payload.slide;
      }
    },
    updateSlideUi: (
      state,
      action: PayloadAction<{ index: number; ui: Record<string, unknown> | null }>
    ) => {
      if (
        state.presentationData &&
        state.presentationData.slides[action.payload.index]
      ) {
        state.presentationData.slides[action.payload.index].ui =
          action.payload.ui;
      }
    },
    updateSlideSpeakerNote: (
      state,
      action: PayloadAction<{ index: number; speakerNote: string }>
    ) => {
      if (
        state.presentationData &&
        state.presentationData.slides[action.payload.index]
      ) {
        state.presentationData.slides[action.payload.index].speaker_note =
          action.payload.speakerNote;
      }
    },

    // Update slide content at specific data path (for Tiptap text editing)
    updateSlideContent: (
      state,
      action: PayloadAction<{
        slideIndex: number;
        dataPath: string;
        content: string;
      }>
    ) => {
      if (
        state.presentationData &&
        state.presentationData.slides &&
        state.presentationData.slides[action.payload.slideIndex]
      ) {
        const slide = state.presentationData.slides[action.payload.slideIndex];
        const { dataPath, content } = action.payload;
        if (dataPath && slide.content) {
          setNestedContentValue(slide.content, dataPath, content);
        }
      }
    },

    addNewSlide: (state, action: PayloadAction<{ slideData: DeckSlide; index: number }>) => {
      if (state.presentationData?.slides) {
        if (state.presentationData.slides.length >= MAX_NUMBER_OF_SLIDES) {
          return;
        }

        // Insert the new slide at the specified index + 1 (after current slide)
        state.presentationData.slides.splice(action.payload.index + 1, 0, action.payload.slideData);
        state.presentationData.slides = reindexSlides(state.presentationData.slides);
        state.presentationData.n_slides = state.presentationData.slides.length;
      }
    },

    // Update slide image at specific data path
    updateSlideImage: (
      state,
      action: PayloadAction<{
        slideIndex: number;
        dataPath: string;
        imageUrl: string;
        prompt?: string;
      }>
    ) => {
      if (
        state.presentationData &&
        state.presentationData.slides &&
        state.presentationData.slides[action.payload.slideIndex]
      ) {
        const slide = state.presentationData.slides[action.payload.slideIndex];
        const { dataPath, imageUrl, prompt } = action.payload;
        if (dataPath && slide.content) {
          setNestedMediaValue(
            slide.content,
            dataPath,
            "__image_url__",
            "__image_prompt__",
            imageUrl,
            prompt,
          );
        }
        if (slide.images && Array.isArray(slide.images)) {
          const imageIndex = firstBracketIndex(dataPath);
          if (slide.images[imageIndex] !== undefined) {
            slide.images[imageIndex] = imageUrl;
          }
        }
      }
    },

    updateImageProperties: (
      state,
      action: PayloadAction<{
        slideIndex: number;
        itemIndex: number;
        properties: any;
      }>
    ) => {
      if (
        state.presentationData &&
        state.presentationData.slides &&
        state.presentationData.slides[action.payload.slideIndex]
      ) {
        const slide = state.presentationData.slides[action.payload.slideIndex];
        const { itemIndex, properties } = action.payload;
        slide['properties'] = {
          ...slide.properties,
          [itemIndex]: properties
        };

      }
    },

    // Update slide icon at specific data path
    updateSlideIcon: (
      state,
      action: PayloadAction<{
        slideIndex: number;
        dataPath: string;
        iconUrl: string;
        query?: string;
      }>
    ) => {
      if (
        state.presentationData &&
        state.presentationData.slides &&
        state.presentationData.slides[action.payload.slideIndex]
      ) {
        const slide = state.presentationData.slides[action.payload.slideIndex];
        const { dataPath, iconUrl, query } = action.payload;
        if (dataPath && slide.content) {
          setNestedMediaValue(
            slide.content,
            dataPath,
            "__icon_url__",
            "__icon_query__",
            iconUrl,
            query,
          );
          console.log("Redux: Updated slide icon at path:", dataPath, "with URL:", iconUrl);
        }
        if (slide.icons && Array.isArray(slide.icons)) {
          const iconIndex = firstBracketIndex(dataPath);
          if (slide.icons[iconIndex] !== undefined) {
            slide.icons[iconIndex] = iconUrl;
          }
        }
      }
    },
    updateTheme: (state, action: PayloadAction<Theme | null>) => {
      if (state.presentationData) {
        state.presentationData['theme'] = action.payload;
      }
    },
    applyTemplateToPresentation: (
      state,
      action: PayloadAction<{
        templateId: string;
        layout: Record<string, unknown> | null;
        fonts?: unknown;
        theme?: Theme | null;
      }>
    ) => {
      if (!state.presentationData) return;
      state.presentationData.layout = action.payload.layout;
      if (action.payload.fonts !== undefined) {
        state.presentationData.fonts = action.payload.fonts;
      }
      if (action.payload.theme !== undefined) {
        state.presentationData.theme = action.payload.theme;
      }
      if (Array.isArray(state.presentationData.slides)) {
        state.presentationData.slides = state.presentationData.slides.map(
          (slide) => {
            if (
              slide.layout_group === "blank" ||
              !slide.layout_group ||
              slide.layout_group === ""
            ) {
              return {
                ...slide,
                layout_group: action.payload.templateId,
              };
            }
            return slide;
          }
        );
      }
    },
  },

});

export const {
  setStreaming,
  setLoading,
  setLayoutLoading,
  setPresentationId,
  setSlidesRendered,
  setError,
  clearPresentationData,
  clearOutlines,
  deleteSlideOutline,
  setPresentationData,
  setEnableHtmlSelector,
  setChatHtmlSelection,
  clearChatHtmlSelection,
  updateTitle,
  setOutlines,
  // slides operations
  addSlide,
  updateSlide,
  updateSlideUi,
  updateSlideSpeakerNote,
  deletePresentationSlide,
  replaceSlidesWithBlankFallback,
  duplicatePresentationSlide,
  movePresentationSlide,
  updateSlideContent,
  updateSlideImage,
  updateImageProperties,
  updateSlideIcon,
  addNewSlide,
  updateTheme,
  applyTemplateToPresentation,
} = presentationGenerationSlice.actions;

export default presentationGenerationSlice.reducer;
