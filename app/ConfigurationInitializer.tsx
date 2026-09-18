'use client';

import { useEffect, useState } from 'react';
import { setLLMConfig } from '@/store/slices/userConfig';
import { hasValidLLMConfig, normalizeLLMConfig } from '@/utils/storeHelpers';
import { fetchLocalProviderConfigJson, fetchUserConfigJsonWithRetries } from '@/lib/startup-llm-config';
import { usePathname, useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { LLMConfig } from '@/types/llm_config';
import { notify } from '@/components/ui/sonner';
import { GSlideSplashLoader, GSLIDE_SPLASH_MIN_DURATION_MS } from '@/components/gslide';
import { useT } from '@/i18n/provider';

function ConfigurationLoadingScreen() {
  const t = useT();
  return <GSlideSplashLoader message={t('loading.configLoading')} />;
}

export function ConfigurationInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch();
  const t = useT();

  const route = usePathname();
  const shouldShowStartupSplash = !route?.startsWith("/pdf-maker");
  const isSettingsRoute =
    route === "/settings" || route?.startsWith("/settings/");
  const isAuthRoute = route === "/" || route === "/auth";
  const [isLoading, setIsLoading] = useState(
    () => shouldShowStartupSplash
  );
  const [hasMetSplashDuration, setHasMetSplashDuration] = useState(
    () => !shouldShowStartupSplash
  );
  const router = useRouter();

  const setLoadingToFalseAfterNavigatingTo = (pathname: string) => {
    if (window.location.pathname === pathname) {
      setIsLoading(false);
      return;
    }

    const interval = setInterval(() => {
      if (window.location.pathname === pathname) {
        clearInterval(interval);
        setIsLoading(false);
      }
    }, 500);
  }

  const asLlmConfig = (value: unknown): LLMConfig =>
    normalizeLLMConfig(
      (value && typeof value === "object" ? value : {}) as LLMConfig
    );

  const applyLoadedConfig = (llmConfig: LLMConfig) => {
    dispatch(setLLMConfig(llmConfig));

    const isValid = hasValidLLMConfig(llmConfig);
    if (route.startsWith("/pdf-maker")) {
      setIsLoading(false);
      return;
    }
    if (isValid) {
      if (isAuthRoute) {
        router.push("/dashboard");
        setLoadingToFalseAfterNavigatingTo("/dashboard");
      } else {
        setIsLoading(false);
      }
    } else if (!isAuthRoute && !isSettingsRoute) {
      notify.warning(
        t("config.providerNotConfigured.title"),
        t("config.providerNotConfigured.description"),
        { id: "llm-config-required" }
      );
      router.push("/settings");
      setLoadingToFalseAfterNavigatingTo("/settings");
    } else if (isAuthRoute) {
      router.push("/dashboard");
      setLoadingToFalseAfterNavigatingTo("/dashboard");
    } else {
      setIsLoading(false);
    }
  };

  const fetchUserConfigState = async () => {
    if (route.startsWith("/pdf-maker")) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const localConfig = asLlmConfig(await fetchLocalProviderConfigJson());
    if (hasValidLLMConfig(localConfig)) {
      applyLoadedConfig(localConfig);
      void fetchUserConfigJsonWithRetries().then((overlay) => {
        if (!overlay || typeof overlay !== "object") return;
        dispatch(setLLMConfig(asLlmConfig(overlay)));
      });
      return;
    }

    applyLoadedConfig(asLlmConfig(await fetchUserConfigJsonWithRetries()));
  };

  useEffect(() => {
    fetchUserConfigState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!shouldShowStartupSplash) {
      setHasMetSplashDuration(true);
      return;
    }

    const timeout = window.setTimeout(() => {
      setHasMetSplashDuration(true);
    }, GSLIDE_SPLASH_MIN_DURATION_MS);

    return () => window.clearTimeout(timeout);
  }, [shouldShowStartupSplash]);

  if (isLoading || !hasMetSplashDuration) {
    return <ConfigurationLoadingScreen />;
  }

  return children;
}
