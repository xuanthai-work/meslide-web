import type { PresentationConfig } from "../app/(presentation-generator)/upload/type";

type HasTableOfContentsToggle =
  "includeTableOfContents" extends keyof PresentationConfig ? true : false;
type HasTitleSlideToggle =
  "includeTitleSlide" extends keyof PresentationConfig ? true : false;

export const presentationStructureTogglesRemoved: [
  HasTableOfContentsToggle,
  HasTitleSlideToggle,
] = [false, false];
