'use client';

import { useEffect, useRef, useState } from 'react';
import { setLLMConfig } from '@/store/slices/userConfig';
import { hasValidLLMConfig, normalizeLLMConfig } from '@/utils/storeHelpers';
import { fetchLocalProviderConfigJson, fetchUserConfigJsonWithRetries } from '@/lib/startup-llm-config';
import { usePathname, useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { LLMConfig } from '@/types/llm_config';
import { GSlideSplashLoader, GSLIDE_SPLASH_MIN_DURATION_MS } from '@/components/gslide';
import { useT } from '@/i18n/provider';
import { startPathnameWait } from '@/lib/wait-for-pathname';

function ConfigurationLoadingScreen() {
  const t = useT();
  return <GSlideSplashLoader message={t('loading.configLoading')} />;
}

export function ConfigurationInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch();

  const route = usePathname();
  const shouldShowStartupSplash =
    !route?.startsWith("/pdf-maker") &&
    route !== "/login" &&
    route !== "/auth";
  const isLoginRoute = route === "/login" || route === "/auth";
  const isAuthRoute = route === "/" || isLoginRoute;
  const [isLoading, setIsLoading] = useState(
    () => shouldShowStartupSplash
  );
  const [hasMetSplashDuration, setHasMetSplashDuration] = useState(
    () => !shouldShowStartupSplash
  );
  const router = useRouter();
  const cancelNavigationWait = useRef<(() => void) | null>(null);

  const setLoadingToFalseAfterNavigatingTo = (pathname: string) => {
    cancelNavigationWait.current?.();
    cancelNavigationWait.current = startPathnameWait({
      getPathname: () => window.location.pathname,
      targetPathname: pathname,
      onDone: () => {
        cancelNavigationWait.current = null;
        setIsLoading(false);
      },
    });
  };

  const asLlmConfig = (value: unknown): LLMConfig =>
    normalizeLLMConfig(
      (value && typeof value === "object" ? value : {}) as LLMConfig
    );

  const applyLoadedConfig = (llmConfig: LLMConfig) => {
    dispatch(setLLMConfig(llmConfig));

    if (route.startsWith("/pdf-maker")) {
      setIsLoading(false);
      return;
    }
    if (isAuthRoute) {
      router.push("/dashboard");
      setLoadingToFalseAfterNavigatingTo("/dashboard");
      return;
    }
    setIsLoading(false);
  };

  const fetchUserConfigState = async () => {
    if (route.startsWith("/pdf-maker")) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const statusResponse = await fetch("/api/v1/auth/status", {
        cache: "no-store",
        credentials: "include",
      });
      const status = statusResponse.ok
        ? ((await statusResponse.json()) as { authenticated?: boolean })
        : { authenticated: false };
      if (!status.authenticated) {
        if (!isLoginRoute) {
          router.replace("/login");
        }
        setIsLoading(false);
        return;
      }
      if (isLoginRoute) {
        router.replace("/dashboard");
        setLoadingToFalseAfterNavigatingTo("/dashboard");
        return;
      }
    } catch {
      if (!isLoginRoute) {
        router.replace("/login");
      }
      setIsLoading(false);
      return;
    }

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
    return () => {
      cancelNavigationWait.current?.();
      cancelNavigationWait.current = null;
    };
  }, []);

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
