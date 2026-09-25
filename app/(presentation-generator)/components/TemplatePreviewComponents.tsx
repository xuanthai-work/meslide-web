"use client";
/* eslint-disable @next/next/no-img-element */
import React, { memo } from "react";

export function TemplatePreviewStage({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden bg-[#F8FBFB] p-5">
      <img
        src="/card_bg.svg"
        alt=""
        className="absolute left-0 top-0 h-full w-full object-cover"
      />
      {children}
    </div>
  );
}

export const LayoutsBadge = memo(function LayoutsBadge({
  count,
}: {
  count: number;
}) {
    return (
      <span className="absolute left-4 top-3.5 z-40 inline-flex items-center rounded-full bg-[#333333] px-3 py-1 font-syne text-xs font-semibold text-white">
        Layouts-{count}
      </span>
    );
});

export const ScaledSlidePreview = memo(function ScaledSlidePreview({
    children,
    isOutline = false,
}: {
    children: React.ReactNode;
    index: number;
    isOutline?: boolean;
}) {
    const PREVIEW_SCALE = isOutline ? 0.2 : 0.24;
    const SLIDE_HEIGHT = 720 * PREVIEW_SCALE;
    const SLIDE_WIDTH = 1280;
    const SLIDE_NATIVE_HEIGHT = 720;
    return (
        <div
            className="relative"
            style={{ height: `${SLIDE_HEIGHT}px`, overflow: "hidden" }}
        >
            <div
                className={`absolute top-0 ${isOutline ? "left-0" : "left-8"} pointer-events-none`}
                style={{
                    width: SLIDE_WIDTH,
                    height: SLIDE_NATIVE_HEIGHT,
                    transformOrigin: "top left",
                    transform: `scale(${PREVIEW_SCALE})`,
                }}
            >
                {children}
            </div>
        </div>
    );
});
