import assert from "node:assert/strict";
import test from "node:test";
import { mergeSingleSlidePreservingResolvedAssets } from "../app/(presentation-generator)/presentation/utils/streamAssetMerge.ts";

const PLACEHOLDER_HTML =
  '<section class="relative h-[720px] w-[1280px] overflow-hidden">' +
  '<img src="/static/images/placeholder.jpg" data-image-query="Hanoi skyline" alt="Hanoi"></section>';

const RESOLVED_HTML =
  '<section class="relative h-[720px] w-[1280px] overflow-hidden">' +
  '<img src="/app_data/images/imported.jpeg" alt="Hanoi"></section>';

const PARTIAL_HTML =
  '<section class="relative h-[720px] w-[1280px] overflow-hidden">' +
  '<img src="/app_data/images/imported.jpeg" alt="Hanoi">' +
  '<img src="/static/images/placeholder.jpg" alt="Failed slot"></section>';

const smartSlide = (html) => ({
  id: "s1",
  index: 0,
  layout: "smart-html",
  layout_group: "smart-html",
  content: { title: "Slide 1" },
  html_content: html,
});

test("smart slide_assets event replaces placeholder HTML with resolved HTML", () => {
  const slides = mergeSingleSlidePreservingResolvedAssets(
    [smartSlide(PLACEHOLDER_HTML)],
    smartSlide(RESOLVED_HTML)
  );
  assert.equal(slides[0].html_content, RESOLVED_HTML);
});

test("smart placeholder replay never overwrites resolved HTML", () => {
  const slides = mergeSingleSlidePreservingResolvedAssets(
    [smartSlide(RESOLVED_HTML)],
    smartSlide(PLACEHOLDER_HTML)
  );
  assert.equal(slides[0].html_content, RESOLVED_HTML);
});

test("smart slide_assets event with a failed slot still merges", () => {
  const slides = mergeSingleSlidePreservingResolvedAssets(
    [smartSlide(PLACEHOLDER_HTML)],
    smartSlide(PARTIAL_HTML)
  );
  assert.equal(slides[0].html_content, PARTIAL_HTML);
});

test("asset update merges into the streamed slide without losing other fields", () => {
  const slides = mergeSingleSlidePreservingResolvedAssets(
    [smartSlide(PLACEHOLDER_HTML)],
    { ...smartSlide(RESOLVED_HTML), speaker_note: "kept" }
  );
  assert.equal(slides[0].html_content, RESOLVED_HTML);
  assert.equal(slides[0].speaker_note, "kept");
  assert.equal(slides.length, 1);
});