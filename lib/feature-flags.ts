export interface FeatureFlags {
  documentAwareRewrite: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
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
  const documentAwareRewrite = parseFeatureFlag(
    environment.GSLIDE_FEATURE_DOCUMENT_AWARE_REWRITE,
  );

  return {
    documentAwareRewrite,
  };
};
