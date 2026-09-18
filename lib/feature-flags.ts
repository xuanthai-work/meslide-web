export interface FeatureFlags {
  smartModeEnabled: boolean;
  communityEnabled: boolean;
  documentAwareRewrite: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  smartModeEnabled: false,
  communityEnabled: false,
  // Document-aware rewrite is gated for the first rollout; prompt-only
  // behavior remains unchanged until the flag is enabled. Removing the flag
  // is a follow-up after production metrics confirm no material regression.
  documentAwareRewrite: false,
};

const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);

export const parseFeatureFlag = (value: string | undefined): boolean =>
  ENABLED_VALUES.has(value?.trim().toLowerCase() ?? "");

export const resolveFeatureFlags = (
  environment: Record<string, string | undefined>,
): FeatureFlags => {
  const smartModeEnabled = parseFeatureFlag(
    environment.GSLIDE_FEATURE_SMART_MODE,
  );
  const documentAwareRewrite = parseFeatureFlag(
    environment.GSLIDE_FEATURE_DOCUMENT_AWARE_REWRITE,
  );

  return {
    smartModeEnabled,
    // Community designs are a Smart-mode capability and must never be exposed
    // independently, even if its environment variable is configured.
    communityEnabled:
      smartModeEnabled &&
      parseFeatureFlag(environment.GSLIDE_FEATURE_COMMUNITY),
    documentAwareRewrite,
  };
};
