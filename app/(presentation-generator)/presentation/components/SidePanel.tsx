"use client";
import { useEffect, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { v4 as uuidv4 } from "uuid";
import { RootState } from "@/store/store";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  deletePresentationSlide,
  duplicatePresentationSlide,
  movePresentationSlide,
  replaceSlidesWithBlankFallback,
  setPresentationData,
} from "@/store/slices/presentationGeneration";
import { addToHistory } from "@/store/slices/undoRedoSlice";
import { SortableSlide } from "./SortableSlide";
import { notify } from "@/components/ui/sonner";
import { SlideThumbnailCard } from "./SlideThumbnailCard";
import {
  BLANK_SLIDE_LAYOUT_GROUP,
  createBlankPresentationSlide,
  getSlideTemplateId,
  isTemplateFreePresentation,
} from "../../_shared/blank-slide";
import { MAX_NUMBER_OF_SLIDES } from "@/utils/presentationLimits";

interface SidePanelProps {
  selectedSlide: number;
  onSlideClick: (
    index: number,
    options?: {
      promptOverlaySlideId?: string;
      promptOverlayKind?: "blank" | "layout";
    },
  ) => void;
  presentationId: string;

  loading: boolean;
}

const SidePanel = ({
  selectedSlide,
  onSlideClick,
  presentationId,

  loading,
}: SidePanelProps) => {
  const thumbnailScrollRef = useRef<HTMLDivElement | null>(null);

  const { presentationData, isStreaming } = useSelector(
    (state: RootState) => state.presentationGeneration
  );

  const dispatch = useDispatch();

  const lastSlideIndex = presentationData?.slides?.length
    ? presentationData.slides.length - 1
    : 0;
  const lastSlide = presentationData?.slides?.[lastSlideIndex];
  const lastSlideTemplateId = getSlideTemplateId(lastSlide);
  const isTemplateFree = isTemplateFreePresentation(presentationData);

  const handleDeleteSlide = useCallback(
    (indexToDelete: number) => {
      if (!presentationData?.slides?.length || isStreaming) return;
      if (
        indexToDelete < 0 ||
        indexToDelete >= presentationData.slides.length
      ) {
        return;
      }

      if (presentationData.slides.length <= 1) {
        const slideId = uuidv4();
        const blankSlide = createBlankPresentationSlide({
          id: slideId,
          index: 0,
          presentationId,
          templateId: isTemplateFree
            ? BLANK_SLIDE_LAYOUT_GROUP
            : lastSlideTemplateId || BLANK_SLIDE_LAYOUT_GROUP,
          isTemplateV2: true,
        });

        dispatch(
          addToHistory({
            slides: presentationData.slides,
            actionType: "DELETE_LAST_SLIDE",
          })
        );
        dispatch(replaceSlidesWithBlankFallback({ slideData: blankSlide }));
        onSlideClick(0);
        return;
      }

      const nextIndex = Math.min(
        selectedSlide >= indexToDelete
          ? Math.max(0, selectedSlide - 1)
          : selectedSlide,
        presentationData.slides.length - 2
      );

      dispatch(
        addToHistory({
          slides: presentationData.slides,
          actionType: "DELETE_SLIDE",
        })
      );
      dispatch(deletePresentationSlide(indexToDelete));
      onSlideClick(nextIndex);
    },
    [
      presentationData,
      isStreaming,
      selectedSlide,
      isTemplateFree,
      lastSlideTemplateId,
      presentationId,
      onSlideClick,
      dispatch,
    ]
  );

  const handleDuplicateSlide = useCallback(
    (indexToDuplicate: number) => {
      if (!presentationData?.slides?.length || isStreaming) return;

      if (presentationData.slides.length >= MAX_NUMBER_OF_SLIDES) {
        notify.warning(
          "Đã đạt giới hạn slide",
          `Bạn có thể tạo tối đa ${MAX_NUMBER_OF_SLIDES} slide.`
        );
        return;
      }

      if (
        indexToDuplicate < 0 ||
        indexToDuplicate >= presentationData.slides.length
      ) {
        return;
      }

      dispatch(
        addToHistory({
          slides: presentationData.slides,
          actionType: "DUPLICATE_SLIDE",
        })
      );
      dispatch(
        duplicatePresentationSlide({
          index: indexToDuplicate,
          slideId: uuidv4(),
        })
      );
      onSlideClick(indexToDuplicate + 1);
    },
    [presentationData, isStreaming, onSlideClick, dispatch]
  );

  const handleMoveSlide = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!presentationData?.slides?.length || isStreaming) return;
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= presentationData.slides.length ||
        toIndex >= presentationData.slides.length
      ) {
        return;
      }

      dispatch(
        addToHistory({
          slides: presentationData.slides,
          actionType: "MOVE_SLIDE",
        })
      );
      dispatch(movePresentationSlide({ fromIndex, toIndex }));
      onSlideClick(toIndex);
    },
    [presentationData, isStreaming, onSlideClick, dispatch]
  );

  const handleMoveSlideUp = useCallback(
    (index: number) => handleMoveSlide(index, index - 1),
    [handleMoveSlide]
  );

  const handleMoveSlideDown = useCallback(
    (index: number) => handleMoveSlide(index, index + 1),
    [handleMoveSlide]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;

      // 1. Không xóa slide nếu đang gõ văn bản
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      // 2. Không xóa slide nếu sự kiện xuất phát từ vùng Canvas soạn thảo
      const isInEditorStage = Boolean(
        target?.closest?.("[data-presentation-slides-scroll-container]") ||
          target?.closest?.(".konvajs-content") ||
          target?.closest?.("[data-testid='slide-content']") ||
          target?.closest?.(".slide-edit-stage") ||
          target?.closest?.("[data-template-v2-selection-overlay]")
      );
      if (isInEditorStage) return;

      // 3. Xóa slide chỉ khi người dùng đang tương tác với danh sách thumbnail
      const isThumbnailListFocused = Boolean(
        target?.closest?.("[data-slide-thumbnail-scroll-container]") ||
          target?.closest?.("aside[aria-label='Các slide của bài thuyết trình']")
      );
      if (!isThumbnailListFocused) return;

      if (!presentationData?.slides?.length || isStreaming) return;
      e.preventDefault();
      handleDeleteSlide(selectedSlide);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedSlide, presentationData, isStreaming, handleDeleteSlide]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Start drag after moving 8px
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const activeThumbnail = thumbnailScrollRef.current?.querySelector(
      `[data-slide-thumbnail-index="${selectedSlide}"]`,
    );
    activeThumbnail?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [selectedSlide]);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (!active || !over || !presentationData?.slides) return;

    if (active.id !== over.id) {
      // Find the indices of the dragged and target items
      const oldIndex = presentationData?.slides.findIndex(
        (item: any) => item.id === active.id
      );
      const newIndex = presentationData?.slides.findIndex(
        (item: any) => item.id === over.id
      );

      // Reorder the array
      const reorderedArray = arrayMove(
        presentationData?.slides,
        oldIndex,
        newIndex
      );

      // Update indices of all slides
      const updatedArray = reorderedArray.map((slide: any, index: number) => ({
        ...slide,
        index: index,
      }));

      // Update the store with new order and indices
      dispatch(
        setPresentationData({ ...presentationData, slides: updatedArray })
      );
    }
  };

  // Loading shimmer component
  if (
    !presentationData ||
    loading ||
    !presentationData?.slides ||
    presentationData?.slides.length === 0
  ) {
    return null;
  }

  return (
    <aside
      className="relative h-full w-[164px] bg-white px-2 py-5"
      aria-label={"Các slide của bài thuyết trình"}
    >
      <div
        className={`
          relative h-full z-50 xl:z-auto
          transition-all duration-300 ease-in-out
        `}
      >
        <div className="slide-theme flex h-full w-full flex-col overflow-hidden">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div
              ref={thumbnailScrollRef}
              data-slide-thumbnail-scroll-container="true"
              className="hide-scrollbar min-h-0 w-full flex-1 space-y-[15px] overflow-y-auto pb-5"
            >
              {isStreaming ? (
                presentationData &&
                presentationData?.slides.map((slide: any, index: number) => (
                  <SlideThumbnailCard
                    key={
                      slide.id ??
                      `${slide.type ?? "slide"}-${slide.index ?? index}`
                    }
                    slide={slide}
                    index={index}
                    selected={selectedSlide === index}
                    fonts={presentationData.fonts}
                    onClick={() => onSlideClick(index)}
                    onDelete={handleDeleteSlide}
                    onDuplicate={handleDuplicateSlide}
                    onMoveUp={handleMoveSlideUp}
                    onMoveDown={handleMoveSlideDown}
                    slideCount={presentationData.slides.length}
                  />
                ))
              ) : (
                <SortableContext
                  items={
                    presentationData?.slides.map(
                      (slide: any) => slide.id || `${slide.index}`
                    ) || []
                  }
                  strategy={verticalListSortingStrategy}
                >
                  {presentationData &&
                    presentationData?.slides.map(
                      (slide: any, index: number) => (
                        <SortableSlide
                          key={
                            slide.id ??
                            `${slide.type ?? "slide"}-${slide.index ?? index}`
                          }
                          slide={slide}
                          index={index}
                          selectedSlide={selectedSlide}
                          fonts={presentationData.fonts}
                          onSlideClick={onSlideClick}
                          onDeleteSlide={handleDeleteSlide}
                          onDuplicateSlide={handleDuplicateSlide}
                          onMoveUpSlide={handleMoveSlideUp}
                          onMoveDownSlide={handleMoveSlideDown}
                          slideCount={presentationData.slides.length}
                        />
                      )
                    )}
                </SortableContext>
              )}
            </div>
          </DndContext>
        </div>
      </div>
    </aside>
  );
};

export default SidePanel;
