"use client";

import React, { useCallback } from "react";
import { Search } from "lucide-react";

import { LLMConfig } from "@/types/llm_config";
import {
  SettingsField,
  settingsControlClassName,
  settingsFormColumnClassName,
} from "./SettingsField";
import { useT } from "@/i18n/provider";

const WebSearchProvider = ({
  llmConfig,
  setLlmConfig,
}: {
  llmConfig: LLMConfig;
  setLlmConfig: React.Dispatch<React.SetStateAction<LLMConfig>>;
}) => {
  const t = useT();

  const update = useCallback(
    (field: keyof LLMConfig, value: string) => {
      setLlmConfig((current) => ({ ...current, [field]: value }));
    },
    [setLlmConfig]
  );

  return (
    <div className="space-y-6 rounded-[12px] bg-[#F9F8F8] p-7">
      <div className="mb-4 rounded-[12px] bg-white px-6 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:gap-12">
          <div className="max-w-[280px] shrink-0">
            <div className="flex h-[60px] w-[60px] items-center justify-center rounded-[4px] bg-[var(--gslide-accent-soft)]">
              <Search className="h-7 w-7 text-[var(--gslide-accent)]" />
            </div>
            <h3 className="py-2.5 text-xl font-normal text-[#191919]">
              {t("settings.webSearch.title")}
            </h3>
            <p className="text-sm text-gray-500">
              {t("settings.webSearch.subtitle")}
            </p>
            <p className="pt-2 text-xs text-gray-400">
              {t("settings.webSearch.imageDisclosure")}
            </p>
          </div>
          <div className={settingsFormColumnClassName}>
            <div className="rounded-lg border border-[var(--gslide-border)] bg-[var(--gslide-accent-soft)] p-3 text-xs text-[var(--gslide-ink)]">
              {t("settings.webSearch.autoHint")}
            </div>
            <SettingsField label={t("settings.webSearch.maxResults")}>
              <input
                type="number"
                min={1}
                max={10}
                data-testid="web-search-max-results"
                className={settingsControlClassName}
                value={llmConfig.WEB_SEARCH_MAX_RESULTS || "5"}
                onChange={(event) =>
                  update("WEB_SEARCH_MAX_RESULTS", event.target.value)
                }
              />
            </SettingsField>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebSearchProvider;
