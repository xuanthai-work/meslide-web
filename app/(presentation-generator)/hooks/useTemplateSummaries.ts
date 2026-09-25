"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import TemplateService, {
  TemplateCreateTaskResponse,
  TemplateListItem,
} from "../services/api/template";
import {
  filterTemplatesWithLayouts,
  shouldRefreshTemplatesAfterPoll,
  splitTemplatesByDefault,
  TEMPLATE_SUMMARY_POLL_MS,
  TEMPLATE_TASK_LOOKBACK_MS,
} from "../services/api/template-list";
import { useT } from "@/i18n/provider";

export type TemplateTab = "custom" | "default";
export { splitTemplatesByDefault };

export function useTemplateSummaries({
  includeProcessingTemplateTasks = false,
}: {
  includeProcessingTemplateTasks?: boolean;
} = {}) {
  const t = useT();
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [processingTemplateTasks, setProcessingTemplateTasks] = useState<
    TemplateCreateTaskResponse[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const retry = useCallback(() => setRetryToken((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let hadProcessingTemplateTasks = false;

    const loadProcessingTemplateTasks = async () => {
      if (!includeProcessingTemplateTasks) {
        return [];
      }

      const oneHourAgo = new Date(Date.now() - TEMPLATE_TASK_LOOKBACK_MS);
      try {
        return await TemplateService.getProcessingTemplateCreateTasks(oneHourAgo);
      } catch (error) {
        console.error("Failed to load processing template tasks", error);
        return [];
      }
    };

    const loadAllPages = async (isDefault: boolean) => {
      const items: TemplateListItem[] = [];
      let page = 1;
      while (true) {
        const response = await TemplateService.getTemplateSummaries(isDefault, page);
        const pageItems = response.items ?? [];
        items.push(...pageItems);
        if (items.length >= response.total || pageItems.length < response.page_size) break;
        page += 1;
      }
      return items;
    };

    const loadTemplateSummaries = async () => {
      const [defaults, customs] = await Promise.all([
        loadAllPages(true),
        loadAllPages(false),
      ]);
      return [
        ...filterTemplatesWithLayouts(defaults),
        ...filterTemplatesWithLayouts(customs),
      ];
    };

    const loadInitialTemplates = async () => {
      setLoading(true);
      setError(null);
      try {
        const [loadedTemplates, processingTasks] = await Promise.all([
          loadTemplateSummaries(),
          loadProcessingTemplateTasks(),
        ]);
        if (!cancelled) {
          const nextProcessingTasks = processingTasks ?? [];
          hadProcessingTemplateTasks = nextProcessingTasks.length > 0;
          setTemplates(loadedTemplates);
          setProcessingTemplateTasks(nextProcessingTasks);
        }
      } catch (error) {
        console.error("Failed to load templates", error);
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : t("templates.error.serviceUnavailable");
          setError(message);
          toast.error(t("templates.error.loadTitle"), { description: message });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadInitialTemplates();
    if (includeProcessingTemplateTasks) {
      intervalId = setInterval(() => {
        loadProcessingTemplateTasks().then((processingTasks) => {
          if (!cancelled) {
            const nextProcessingTasks = processingTasks ?? [];
            const shouldRefreshTemplates = shouldRefreshTemplatesAfterPoll(
              hadProcessingTemplateTasks,
              nextProcessingTasks.length,
            );
            hadProcessingTemplateTasks = nextProcessingTasks.length > 0;
            setProcessingTemplateTasks(nextProcessingTasks);

            if (shouldRefreshTemplates) {
              loadTemplateSummaries()
                .then((loadedTemplates) => {
                  if (!cancelled) {
                    setTemplates(loadedTemplates);
                  }
                })
                .catch((error) => {
                  console.error("Failed to refresh templates", error);
                });
            }
          }
        });
      }, TEMPLATE_SUMMARY_POLL_MS);
    }

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [includeProcessingTemplateTasks, retryToken, t]);

  const { defaultTemplates, customTemplates } = useMemo(
    () => splitTemplatesByDefault(templates),
    [templates]
  );

  return {
    templates,
    defaultTemplates,
    customTemplates,
    processingTemplateTasks,
    loading,
    error,
    retry,
  };
}
