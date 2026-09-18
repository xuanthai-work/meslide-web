"use client";
import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { notify } from "@/components/ui/sonner";
import { GSlideButton, GSlideHeader } from "@/components/gslide";
import { RootState } from "@/store/store";
import { useSelector } from "react-redux";
import {
  getLLMConfigValidationError,
  handleSaveLLMConfig,
} from "@/utils/storeHelpers";
import { usePathname } from "next/navigation";
import { LLMConfig } from "@/types/llm_config";
import SettingSideBar, { SettingsSection } from "./SettingSideBar";
import TextProvider from "./TextProvider";
import ImageProvider from "./ImageProvider";
import WebSearchProvider from "./WebSearchProvider";
import {
  LLM_PROVIDERS,
} from "@/utils/providerConstants";
import { useT } from "@/i18n/provider";

// Button state interface
interface ButtonState {
  isLoading: boolean;
  isDisabled: boolean;
  text: string;
  showProgress: boolean;
  progressPercentage?: number;
  status?: string;
}

const SettingsPage = () => {
  const t = useT();
  const pathname = usePathname();
  const [selectedProvider, setSelectedProvider] = useState<SettingsSection>("text-provider");
  const userConfigState = useSelector((state: RootState) => state.userConfig);
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(
    userConfigState.llm_config
  );
  const [buttonState, setButtonState] = useState<ButtonState>({
    isLoading: false,
    isDisabled: false,
    text: t("settings.actions.save"),
    showProgress: false,
  });

  const handleTextProviderInputChange = useCallback(
    (value: string | boolean, field: string) => {
      setLlmConfig((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    []
  );

  useEffect(() => {
    setLlmConfig(userConfigState.llm_config);
  }, [userConfigState.llm_config]);

  const selectSettingsSection = (section: SettingsSection) => {
    setSelectedProvider(section);
  };

  const handleSaveConfig = async () => {

    const validationError = getLLMConfigValidationError(llmConfig);
    if (validationError) {
      notify.warning(t("settings.actions.cannotSave"), validationError);
      if (
        selectedProvider === "image-provider" &&
        ((llmConfig.LLM === "openai" && !String(llmConfig.OPENAI_MODEL || "").trim()))
      ) {
        setSelectedProvider("text-provider");
      }
      return;
    }

    try {
      setButtonState((prev) => ({
        ...prev,
        isLoading: true,
        isDisabled: true,
        text: t("settings.actions.saving"),
      }));
      await handleSaveLLMConfig(llmConfig);
      notify.success(
        t("settings.actions.savedTitle"),
        t("settings.actions.savedDescription")
      );
      setButtonState((prev) => ({
        ...prev,
        isLoading: false,
        isDisabled: false,
        text: t("settings.actions.save"),
      }));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t("settings.actions.saveErrorFallback");
      notify.error(t("settings.actions.saveErrorTitle"), message);
      setButtonState((prev) => ({
        ...prev,
        isLoading: false,
        isDisabled: false,
        text: t("settings.actions.save"),
      }));
    }
  };

  const textProviderKey = llmConfig.LLM || "openai";
  const textProviderLabel =
    LLM_PROVIDERS[textProviderKey]?.label || textProviderKey;
  const selectedTextModel =
    textProviderKey === "openai"
        ? llmConfig.OPENAI_MODEL
        : textProviderKey === "google"
          ? llmConfig.GOOGLE_MODEL
          : textProviderKey === "custom"
            ? llmConfig.CUSTOM_MODEL
            : "";
  const textSummary = selectedTextModel
    ? `${textProviderLabel} (${selectedTextModel})`
    : textProviderLabel;

  const webSearchSummary = `${t("upload.config.web")}: ${llmConfig.WEB_SEARCH_MAX_RESULTS || "5"}`;


  useEffect(() => {

    if (
      (llmConfig.LLM === "openai" && !llmConfig.OPENAI_MODEL) ||
      (llmConfig.LLM === "google" && !llmConfig.GOOGLE_MODEL) ||
      (llmConfig.LLM === "custom" && !llmConfig.CUSTOM_MODEL)
    ) {
      const currentUrl = window.location.href;

      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        console.log("beforeunload");
        e.preventDefault();
        e.returnValue = "";
      };

      const handleClick = (e: MouseEvent) => {


        const target = e.target as HTMLElement | null;
        const link = target?.closest("a");

        if (!link) return;

        const href = link.getAttribute("href");
        const targetAttr = link.getAttribute("target");

        if (
          href &&
          href !== "#" &&
          !href.startsWith("javascript:") &&
          targetAttr !== "_blank"
        ) {

          // notify.error("Cannot save settings", "Please select a model for the selected provider");
          e.preventDefault();
          window.history.pushState(null, "", pathname);
        }
      };

      const handlePopState = () => {
        console.log("popstate");
        window.history.pushState(null, "", pathname);
      };

      window.addEventListener("beforeunload", handleBeforeUnload);
      window.addEventListener("popstate", handlePopState);
      document.addEventListener("click", handleClick, true);

      // keep current page in history
      window.history.pushState(null, "", currentUrl);

      return () => {
        window.removeEventListener("beforeunload", handleBeforeUnload);
        window.removeEventListener("popstate", handlePopState);
        document.removeEventListener("click", handleClick, true);
      };
    }

  }, [llmConfig, pathname]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--gslide-bg)]">
      <GSlideHeader
        title={t("settings.header.title")}
        actions={
          <GSlideButton
            className="inline-flex items-center"
            onClick={handleSaveConfig}
            disabled={buttonState.isDisabled}
          >
            {buttonState.isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {buttonState.text}
              </span>
            ) : (
              buttonState.text
            )}
          </GSlideButton>
        }
      />

      <div className="mx-7 pb-16">
        <SettingSideBar
          selectedProvider={selectedProvider}
          setSelectedProvider={selectSettingsSection}
        />
        <p className="mt-4 text-xs text-[var(--gslide-muted)]">
          {textSummary}, {webSearchSummary}
        </p>

        <div className="mt-8 max-w-3xl">
          {selectedProvider === "text-provider" && (
            <TextProvider
              onInputChange={handleTextProviderInputChange}
              llmConfig={llmConfig}
            />
          )}
          {selectedProvider === "image-provider" && (
            <ImageProvider llmConfig={llmConfig} setLlmConfig={setLlmConfig} />
          )}
          {selectedProvider === "web-search-provider" && (
            <WebSearchProvider
              llmConfig={llmConfig}
              setLlmConfig={setLlmConfig}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
