import React, { forwardRef, memo, useCallback } from "react";
import { motion } from "motion/react";
import { Trash2, Copy, MoreVertical, ArrowUp, ArrowDown } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { Slide } from "../../types/slide";
import { useNearViewport } from "@/app/hooks/useNearViewport";
import { V1ContentRender } from "../../components/V1ContentRender";
import {
  shouldRenderTemplateV2HtmlPreview,
  TemplateV2HtmlSlidePreview,
} from "../../components/TemplateV2HtmlSlidePreview";

interface SlideThumbnailCardProps extends React.HTMLAttributes<HTMLDivElement> {
  slide: Slide;
  index: number;
  selected: boolean;
  fonts?: unknown;
  presentationVersion?: unknown;
  slideCount?: number;
  onDelete?: (index: number) => void;
  onDuplicate?: (index: number) => void;
  onMoveUp?: (index: number) => void;
  onMoveDown?: (index: number) => void;
}

const THUMBNAIL_WIDTH = 110;
const SCALE = THUMBNAIL_WIDTH / 1280;

const SlideThumbnailCardComponent = forwardRef<
  HTMLDivElement,
  SlideThumbnailCardProps
>(
  (
    {
      slide,
      index,
      selected,
      fonts,
      presentationVersion,
      slideCount,
      onDelete,
      onDuplicate,
      onMoveUp,
      onMoveDown,
      className = "",
      style,
      ...props
    },
    ref
  ) => {
    const { isNearViewport, ref: setViewportRoot } =
      useNearViewport<HTMLDivElement>({
        forceActive: selected,
        rootMargin: "72px 0px",
        rootSelector: "[data-slide-thumbnail-scroll-container='true']",
      });
    const setRootRef = useCallback(
      (node: HTMLDivElement | null) => {
        setViewportRoot(node);
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref, setViewportRoot],
    );
    const useTemplateV2HtmlPreview = shouldRenderTemplateV2HtmlPreview(
      slide,
      presentationVersion
    );

    return (
      <div
        ref={setRootRef}
        data-slide-thumbnail-active={isNearViewport ? "true" : "false"}
        data-slide-thumbnail-index={index}
        aria-current={selected ? "true" : undefined}
        style={style}
        className={`group/thumbnail relative flex h-[62px] w-full cursor-pointer items-center gap-2.5 transition-opacity duration-200 ${className}`}
        {...props}
      >
        <p
          className={`pointer-events-none w-5 shrink-0 text-right whitespace-nowrap text-[12px] font-medium leading-none ${
            selected
              ? "text-[#1D6FE8]"
              : "text-[#333333]"
          }`}
        >
          {index + 1}
        </p>

        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`transform-gpu relative h-[62px] w-[110px] shrink-0 overflow-hidden rounded-[8px] bg-white transition-[border-color,box-shadow] duration-200 ${
            selected
              ? "border-2 border-[#1D6FE8] shadow-[0_0_0_3px_rgba(29,111,232,0.14),0_4px_12px_rgba(29,111,232,0.08)]"
              : "border border-[#E5E7EB] hover:border-[#BFDBFE] hover:shadow-sm"
          }`}
        >
          {(onDelete || onDuplicate || onMoveUp || onMoveDown) && (
            <div className="absolute right-1 top-1 z-20 flex items-center gap-1">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    title="Thao tác khác"
                    aria-label="Thao tác khác"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-black/60 text-white opacity-0 shadow-sm backdrop-blur-[2px] transition-all duration-150 hover:bg-black/80 group-hover/thumbnail:opacity-100 data-[state=open]:opacity-100"
                  >
                    <MoreVertical className="h-3 w-3" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    side="right"
                    align="start"
                    sideOffset={6}
                    className="z-[100] min-w-[160px] overflow-hidden rounded-[8px] border border-[#E6E6EC] bg-white py-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
                  >
                    {onDuplicate && (
                      <DropdownMenu.Item
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicate(index);
                        }}
                        className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-[#101323] outline-none hover:bg-[#F3F4F6]"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>Nhân bản slide</span>
                      </DropdownMenu.Item>
                    )}
                    {onMoveUp && (
                      <DropdownMenu.Item
                        disabled={index <= 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveUp(index);
                        }}
                        className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-[#101323] outline-none hover:bg-[#F3F4F6] data-[disabled]:pointer-events-none data-[disabled]:opacity-40"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                        <span>Di chuyển lên</span>
                      </DropdownMenu.Item>
                    )}
                    {onMoveDown && (
                      <DropdownMenu.Item
                        disabled={
                          slideCount != null && index >= slideCount - 1
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveDown(index);
                        }}
                        className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-[#101323] outline-none hover:bg-[#F3F4F6] data-[disabled]:pointer-events-none data-[disabled]:opacity-40"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                        <span>Di chuyển xuống</span>
                      </DropdownMenu.Item>
                    )}
                    {onDelete && (
                      <>
                        <DropdownMenu.Separator className="my-1 h-px bg-[#EDEEEF]" />
                        <DropdownMenu.Item
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(index);
                          }}
                          className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-[#EF4444] outline-none hover:bg-[#FEE2E2]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Xóa slide</span>
                        </DropdownMenu.Item>
                      </>
                    )}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          )}
          {!isNearViewport ? (
            <div
              className="absolute inset-0 bg-white"
              aria-hidden="true"
            />
          ) : useTemplateV2HtmlPreview ? (
            <div
              className="pointer-events-none absolute left-0 top-0"
              style={{
                width: 1280,
                height: 720,
                transformOrigin: "top left",
                transform: `scale(${SCALE})`,
              }}
            >
              <TemplateV2HtmlSlidePreview
                slide={slide}
                fonts={fonts}
                fixedSize
                className="pointer-events-none"
              />
            </div>
          ) : (
            <div
              className="pointer-events-none absolute left-0 top-0 overflow-hidden"
              style={{
                width: 1280,
                height: 720,
                transformOrigin: "top left",
                transform: `scale(${SCALE})`,
              }}
            >
              <V1ContentRender
                slide={slide}
                isEditMode={false}
                fonts={fonts}
              />
            </div>
          )}
        </motion.div>
      </div>
    );
  }
);

SlideThumbnailCardComponent.displayName = "SlideThumbnailCard";

export const SlideThumbnailCard = memo(
  SlideThumbnailCardComponent,
  (previous, next) =>
    previous.slide === next.slide &&
    previous.index === next.index &&
    previous.selected === next.selected &&
    previous.fonts === next.fonts &&
    previous.presentationVersion === next.presentationVersion &&
    previous.slideCount === next.slideCount &&
    previous.onDelete === next.onDelete &&
    previous.onDuplicate === next.onDuplicate &&
    previous.onMoveUp === next.onMoveUp &&
    previous.onMoveDown === next.onMoveDown &&
    previous.className === next.className &&
    previous.style === next.style
);

SlideThumbnailCard.displayName = "Memo(SlideThumbnailCard)";
