"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import TemplateService, { type TemplateListItem } from "../services/api/template";
import {
  filterTemplatesWithLayouts,
  orderBuiltInTemplates,
} from "../services/api/template-list";

export function useTemplateSummaries() {
  const [defaultTemplates, setDefaultTemplates] = useState<TemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const retry = useCallback(() => setRetryToken((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;

    const loadTemplates = async () => {
      setLoading(true);
      setError(null);
      try {
        const templates: TemplateListItem[] = [];
        let page = 1;
        while (true) {
          const response = await TemplateService.getTemplateSummaries(true, page);
          const items = response.items ?? [];
          templates.push(...items);
          if (templates.length >= response.total || items.length < response.page_size) break;
          page += 1;
        }
        if (!cancelled) {
          setDefaultTemplates(orderBuiltInTemplates(filterTemplatesWithLayouts(
            templates.filter((template) => template.is_default === true),
          )));
        }
      } catch (loadError) {
        console.error("Failed to load templates", loadError);
        if (!cancelled) {
          const message = loadError instanceof Error
            ? loadError.message
            : "Không thể kết nối đến dịch vụ mẫu. Vui lòng thử lại.";
          setError(message);
          toast.error("Không thể tải mẫu", { description: message });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadTemplates();
    return () => { cancelled = true; };
  }, [retryToken]);

  return { defaultTemplates, loading, error, retry };
}
