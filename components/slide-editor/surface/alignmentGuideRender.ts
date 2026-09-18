import type Konva from "konva";
import type { Box } from "@/components/slide-editor/model/model";
import type { AlignmentGuide } from "@/components/slide-editor/surface/alignmentGuides";

export const ALIGNMENT_GUIDE_COLOR = "#1D6FE8";
export const ALIGNMENT_GUIDE_HALO_COLOR = "rgba(255, 255, 255, 0.72)";
export const ALIGNMENT_GUIDE_SNAP_DISTANCE_PX = 8;
export const ALIGNMENT_GUIDE_STROKE_WIDTH_PX = 1.25;
export const ALIGNMENT_GUIDE_HALO_WIDTH_PX = 2.5;
export const ALIGNMENT_GUIDE_DASH_PX = [5, 5] as const;

export function renderedNodeBox(node: Konva.Node, fallback: Box): Box {
  const stage = node.getStage();
  if (!stage) return fallback;
  const rect = node.getClientRect({
    relativeTo: stage,
    skipShadow: true,
    skipStroke: true,
  });
  const values = [rect.x, rect.y, rect.width, rect.height];
  if (!values.every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) {
    return fallback;
  }
  return rect;
}

export function pointsForAlignmentGuide(guide: AlignmentGuide) {
  return guide.axis === "vertical"
    ? [guide.coordinate, guide.start, guide.coordinate, guide.end]
    : [guide.start, guide.coordinate, guide.end, guide.coordinate];
}

export function syncAlignmentGuideNode(
  node: Konva.Line | null,
  guide: AlignmentGuide | undefined,
) {
  if (!node) return false;
  if (!guide) {
    if (!node.visible()) return false;
    node.visible(false);
    return true;
  }

  const points = pointsForAlignmentGuide(guide);
  const currentPoints = node.points();
  const pointsChanged =
    currentPoints.length !== points.length ||
    points.some((point, index) => Math.abs(point - currentPoints[index]) >= 0.01);
  if (node.visible() && !pointsChanged) return false;
  node.points(points);
  node.visible(true);
  return true;
}
