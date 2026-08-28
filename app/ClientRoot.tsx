"use client";

import { Providers } from "./providers";
import TailwindBrowserRuntime from "@/components/runtime/TailwindBrowserRuntime";
import { Toaster } from "@/components/ui/sonner";

export default function ClientRoot({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      {children}
      <TailwindBrowserRuntime />
      <Toaster position="top-center" />
    </Providers>
  );
}