export const TEMPLATE_SUMMARY_POLL_MS = 30_000;
export const TEMPLATE_TASK_LOOKBACK_MS = 60 * 60 * 1000;

const FEATURED_BUILT_IN_TEMPLATE_ORDER = ["momentum", "dynamic", "executive"] as const;

export type TemplateListSortItem = {
  name: string;
  is_default?: boolean;
  layout_count?: number | null;
};

export function templateSummariesPath(isDefault?: boolean): string {
  const params = new URLSearchParams({ page_size: "100" });
  if (typeof isDefault === "boolean") {
    params.set("default", String(isDefault));
  }
  return `/api/v1/ppt/template/all?${params.toString()}`;
}

export function templateDetailsPath(templateId: string): string {
  const apiTemplateId = templateId.replace(/^template-v2-/, "");
  return `/api/v1/ppt/template/${encodeURIComponent(apiTemplateId)}`;
}

export function processingTemplateTasksPath(createdAtFrom: Date): string {
  const params = new URLSearchParams({
    type: "template.create",
    status: "pending",
    order_by: "created_at",
    order: "desc",
    limit: "50",
    offset: "0",
    created_at: createdAtFrom.toISOString(),
  });
  return `/api/v1/async-tasks?${params.toString()}`;
}

export function templateDeletePath(templateId: string): string {
  return `/api/v1/ppt/template/${encodeURIComponent(templateId)}`;
}

export function templateClonePath(): string {
  return "/api/v1/ppt/template/clone";
}

export function orderBuiltInTemplates<T extends { name: string }>(templates: T[]): T[] {
  const priorityByName = new Map<string, number>(
    FEATURED_BUILT_IN_TEMPLATE_ORDER.map((name, index) => [name, index]),
  );
  return templates
    .map((template, index) => ({ template, index }))
    .sort((left, right) => {
      const leftPriority =
        priorityByName.get(left.template.name.trim().toLowerCase()) ??
        FEATURED_BUILT_IN_TEMPLATE_ORDER.length;
      const rightPriority =
        priorityByName.get(right.template.name.trim().toLowerCase()) ??
        FEATURED_BUILT_IN_TEMPLATE_ORDER.length;
      return leftPriority - rightPriority || left.index - right.index;
    })
    .map(({ template }) => template);
}

export function filterTemplatesWithLayouts<T extends { layout_count?: number | null }>(
  templates: T[],
): T[] {
  return templates.filter(
    (template) => template.layout_count == null || template.layout_count > 0,
  );
}

export function splitTemplatesByDefault<T extends TemplateListSortItem>(templates: T[]) {
  const defaultTemplates = orderBuiltInTemplates(
    templates.filter((template) => template.is_default),
  );
  const customTemplates = templates.filter((template) => !template.is_default);
  return { defaultTemplates, customTemplates };
}

/** Keep polling the list while a create task is running, and once more when it finishes. */
export function shouldRefreshTemplatesAfterPoll(
  hadProcessingTemplateTasks: boolean,
  nextProcessingCount: number,
): boolean {
  return hadProcessingTemplateTasks || nextProcessingCount > 0;
}
