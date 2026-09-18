"use client";

import { createContext, useContext, type ReactNode } from "react";

import {
  DEFAULT_FEATURE_FLAGS,
  type FeatureFlags,
} from "@/lib/feature-flags";

const FeatureFlagsContext = createContext<FeatureFlags>(DEFAULT_FEATURE_FLAGS);

export function FeatureFlagsProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: FeatureFlags;
}) {
  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export const useFeatureFlags = () => useContext(FeatureFlagsContext);
