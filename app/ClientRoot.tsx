"use client";

import { Providers } from "./providers";
import TailwindBrowserRuntime from "@/components/runtime/TailwindBrowserRuntime";
import { Toaster } from "@/components/ui/sonner";
import { FeatureFlagsProvider } from "@/components/FeatureFlagsProvider";
import type { FeatureFlags } from "@/lib/feature-flags";

export default function ClientRoot({
  children,
  featureFlags,
}: {
  children: React.ReactNode;
  featureFlags: FeatureFlags;
}) {
  return (
    <FeatureFlagsProvider value={featureFlags}>
      <Providers>
        {children}
        <TailwindBrowserRuntime />
        <Toaster position="top-center" />
      </Providers>
    </FeatureFlagsProvider>
  );
}
