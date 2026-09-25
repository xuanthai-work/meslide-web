import type { TemplateListItem } from "../../services/api/template";
import { PresentationGenerationApi } from "../../services/api/presentation-generation";

export function fallbackTemplateId(templates: TemplateListItem[]): string | null {
  return templates.find((item) => item.name.trim().toLowerCase() === "general")?.id
    ?? templates[0]?.id ?? null;
}

export async function resolveTemplateForCreate({
  prompt, confirmedTemplateId, templates,
}: {
  prompt: string;
  confirmedTemplateId: string | null;
  templates: TemplateListItem[];
}): Promise<string> {
  const fallback = fallbackTemplateId(templates);
  if (!fallback) throw new Error("No built-in template is available");
  if (confirmedTemplateId && templates.some((item) => item.id === confirmedTemplateId)) {
    return confirmedTemplateId;
  }
  const finalPrompt = prompt.trim();
  if (!finalPrompt || finalPrompt.length > 8000) return fallback;
  try {
    const id = await PresentationGenerationApi.recommendTemplate(
      finalPrompt, templates.map((item) => item.id), AbortSignal.timeout(10_000),
    );
    return templates.some((item) => item.id === id) ? id : fallback;
  } catch {
    console.warn("Template recommendation failed; using fallback");
    return fallback;
  }
}
