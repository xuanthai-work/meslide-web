"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { v4 as uuidv4 } from "uuid";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { notify } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
  addNewSlide,
} from "@/store/slices/presentationGeneration";
import { addToHistory } from "@/store/slices/undoRedoSlice";
import { RootState } from "@/store/store";
import {
  BLANK_SLIDE_LAYOUT_GROUP,
  createBlankPresentationSlide,
  isTemplateFreePresentation,
} from "../../_shared/blank-slide";
import { MAX_NUMBER_OF_SLIDES } from "@/utils/presentationLimits";

interface SlideActionBarProps {
  slide: any;
  selectedSlide: number;
  presentationId: string;
  onSlideSelected: (
    index: number,
    options?: {
      promptOverlaySlideId?: string;
      promptOverlayKind?: "blank" | "layout";
    },
  ) => void;
  revealOnGroupHover?: boolean;
}

const SlideActionBar = ({
  slide,
  selectedSlide,
  presentationId,
  onSlideSelected,
  revealOnGroupHover = false,
}: SlideActionBarProps) => {
  const dispatch = useDispatch();
  const store = useStore();
  const [isSpeakerPopoverOpen, setIsSpeakerPopoverOpen] = useState(false);
  const isStreaming = useSelector(
    (state: RootState) => state.presentationGeneration.isStreaming
  );
  const slideCount = useSelector((state: RootState) => {
    const currentSlides = state.presentationGeneration.presentationData?.slides;
    return Array.isArray(currentSlides) ? currentSlides.length : 0;
  });
  const hasPresentation = useSelector(
    (state: RootState) => Boolean(state.presentationGeneration.presentationData)
  );
  const isTemplateFree = useSelector((state: RootState) =>
    isTemplateFreePresentation(
      state.presentationGeneration.presentationData
    )
  );

  const hasReachedSlideLimit = slideCount >= MAX_NUMBER_OF_SLIDES;
  const currentIndex = Number.isInteger(selectedSlide)
    ? selectedSlide
    : typeof slide?.index === "number"
      ? slide.index
      : 0;
  const speakerNote =
    typeof slide?.speaker_note === "string" ? slide.speaker_note.trim() : "";
  const keepVisible = isSpeakerPopoverOpen;

  if (!slide || !hasPresentation || slideCount === 0 || isStreaming) {
    return null;
  }

  const rememberSlides = (actionType: string) => {
    const currentSlides = (store.getState() as RootState)
      .presentationGeneration.presentationData?.slides;
    if (!Array.isArray(currentSlides)) return;

    dispatch(
      addToHistory({
        slides: currentSlides,
        actionType,
      })
    );
  };

  const notifySlideLimitReached = () => {
    notify.warning(
      "Đã đạt giới hạn slide",
      `Bạn có thể tạo tối đa ${MAX_NUMBER_OF_SLIDES} slide.`
    );
  };

  const handleAddNewSlideWithAi = () => {
    if (hasReachedSlideLimit) {
      notifySlideLimitReached();
      return;
    }

    const slideId = uuidv4();
    const newIndex = currentIndex + 1;
    const newSlide = createBlankPresentationSlide({
      id: slideId,
      index: newIndex,
      presentationId,
      templateId: isTemplateFree ? BLANK_SLIDE_LAYOUT_GROUP : "template-v2",
      isTemplateV2: true,
    });

    rememberSlides("ADD_BLANK_SLIDE");
    dispatch(addNewSlide({ slideData: newSlide, index: currentIndex }));
    onSlideSelected(newIndex, {
      promptOverlaySlideId: slideId,
      promptOverlayKind: "blank",
    });
  };

  return (
    <>
      <div
        className={cn(
          "z-[80] flex justify-center px-4 transition-opacity duration-300",
          revealOnGroupHover
            ? keepVisible
              ? "opacity-100"
              : "opacity-100 xl:pointer-events-none xl:opacity-0 xl:group-hover:pointer-events-auto xl:group-hover:opacity-100 xl:focus-within:pointer-events-auto xl:focus-within:opacity-100"
            : "opacity-100"
        )}
      >
        <div className="pointer-events-auto hide-scrollbar flex h-10 max-w-[calc(100%_-_2rem)] items-center overflow-x-auto rounded-full border border-[#EDEEEF] bg-white/95 backdrop-blur px-2 shadow-[0_8px_24px_rgba(16,24,40,0.08)]">
          <>
              <button
                type="button"
                onClick={handleAddNewSlideWithAi}
                disabled={hasReachedSlideLimit}
                className={cn(
                  "flex h-8 shrink-0 items-center gap-2 rounded-[6px] px-3 text-sm font-normal leading-none text-[#111324] transition-colors hover:bg-[#F7F6F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5141e5]",
                  hasReachedSlideLimit && "cursor-not-allowed opacity-50"
                )}
              >
                <span>{"Thêm slide"}</span>
                <Plus className="h-4 w-4" strokeWidth={2.4} />
              </button>
              <Separator orientation="vertical" className="mx-2 h-6 shrink-0 bg-[#EDEEEF]" />
          </>
          {speakerNote &&
            <Popover
              open={isSpeakerPopoverOpen}
              onOpenChange={setIsSpeakerPopoverOpen}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={"Ghi chú thuyết trình"}
                  className={cn(
                    "flex h-8 w-10 shrink-0 items-center justify-center rounded-[6px] text-[#050505] transition-colors hover:bg-[#F7F6F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5141e5]",
                    isSpeakerPopoverOpen && "bg-[#F7F6F9]"
                  )}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M5.86683 13.3331V10.5997L7.1335 10.7331C7.50225 10.7126 7.85123 10.5597 8.11627 10.3025C8.38131 10.0453 8.54462 9.70103 8.57616 9.33306V5.53306C8.58058 4.57262 8.20329 3.64976 7.52728 2.96751C6.85128 2.28525 5.93193 1.89948 4.9715 1.89506C4.01106 1.89064 3.0882 2.26793 2.40595 2.94394C1.72369 3.61994 1.33792 4.53929 1.3335 5.49972C1.3335 7.36639 1.77083 7.53572 2.00016 8.53306C2.15515 9.13537 2.16179 9.76628 2.0195 10.3717L1.3335 13.3331" stroke="black" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M13.2002 11.8668C14.1374 10.9294 14.6641 9.65834 14.6645 8.33284C14.6648 7.00735 14.1389 5.73594 13.2022 4.7981" stroke="black" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M11.3336 10C11.5517 9.78195 11.7244 9.52279 11.8417 9.23755C11.9591 8.95231 12.0187 8.64663 12.0171 8.33821C12.0156 8.02978 11.9529 7.72472 11.8327 7.44067C11.7125 7.15662 11.5372 6.89922 11.3169 6.68335" stroke="black" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="center"
                sideOffset={14}
                className="z-[90] w-[360px] rounded-[16px] border border-[#E6E6EC] bg-white p-0 font-syne shadow-[0_8px_24px_rgba(17,24,39,0.14)]"
              >
                <div className="border-b border-[#EDEEEF] px-5 py-4">
                  <p className="text-sm font-semibold text-[#191919]">
                    {"Ghi chú thuyết trình"}
                  </p>
                </div>
                <div className="p-5">
                  <div className="max-h-[240px] min-h-[108px] overflow-auto whitespace-pre-wrap rounded-[12px] border border-[#EDEEEF] bg-[#FAFAFB] p-4 text-sm leading-relaxed text-[#333333]">
                    {speakerNote || "Slide này chưa có ghi chú thuyết trình."}
                  </div>
                </div>
              </PopoverContent>
            </Popover>}
          {speakerNote &&
            <Separator orientation="vertical" className="mx-2 h-6 shrink-0 bg-[#EDEEEF]" />}
        </div>
      </div>
    </>
  );
};

export default SlideActionBar;
