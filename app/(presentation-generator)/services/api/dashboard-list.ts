export type PresentationListVersion = "v1-standard" | "v2-standard";

export function presentationsListPath(
  version?: PresentationListVersion,
  options?: { includeSlides?: boolean },
): string {
  const params = new URLSearchParams();
  if (version) params.set("version", version);
  if (options?.includeSlides === false) params.set("include_slides", "false");
  const query = params.toString();
  return `/api/v1/ppt/presentation/all${query ? `?${query}` : ""}`;
}

export function presentationDeletePath(id: string): string {
  return `/api/v1/ppt/presentation/${id}`;
}

export function presentationDuplicatePath(id: string): string {
  return `/api/v1/ppt/presentation/${id}/duplicate`;
}

export function sortPresentationsNewestFirst<T extends { created_at: string }>(
  presentations: T[],
): T[] {
  return [...presentations].sort((left, right) => {
    const createdAtLeft = Date.parse(left.created_at);
    const createdAtRight = Date.parse(right.created_at);
    return (
      (Number.isNaN(createdAtRight) ? 0 : createdAtRight) -
      (Number.isNaN(createdAtLeft) ? 0 : createdAtLeft)
    );
  });
}

export function removePresentationsById<T extends { id: string }>(
  presentations: T[],
  ids: string[],
): T[] {
  const deletedIds = new Set(ids);
  return presentations.filter((presentation) => !deletedIds.has(presentation.id));
}
