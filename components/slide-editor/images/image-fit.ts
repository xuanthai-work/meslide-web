export type ImageNaturalSize = { width: number; height: number };

export function imageNaturalRatio(size: ImageNaturalSize | null) {
  return size && size.width > 0 && size.height > 0 ? size.width / size.height : 1;
}

export function sizeForNaturalRatio(
  width: number,
  height: number,
  naturalWidth: number,
  naturalHeight: number,
): ImageNaturalSize | null {
  const ratio = naturalWidth / naturalHeight;
  const area = Math.abs(width) * Math.abs(height);
  if (!Number.isFinite(ratio) || ratio <= 0 || area <= 0) return null;
  const nextWidth = Math.sqrt(area * ratio);
  const nextHeight = nextWidth / ratio;
  if (!Number.isFinite(nextWidth) || !Number.isFinite(nextHeight)) return null;
  return { width: nextWidth, height: nextHeight };
}

export function sizeForAspectRatio(
  width: number,
  height: number,
  ratio: number,
): ImageNaturalSize | null {
  const area = Math.abs(width) * Math.abs(height);
  if (!Number.isFinite(ratio) || ratio <= 0 || area <= 0) return null;
  const nextWidth = Math.round(Math.sqrt(area * ratio));
  const nextHeight = Math.round(nextWidth / ratio);
  if (!Number.isFinite(nextWidth) || !Number.isFinite(nextHeight)) return null;
  return { width: nextWidth, height: nextHeight };
}
