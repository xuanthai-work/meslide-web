import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GSlideHeader({
  title,
  actions,
  className,
}: {
  title: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 right-0 z-50 -mr-4 flex h-[72px] w-[calc(100%+1rem)] items-center justify-between bg-gradient-to-b from-[var(--gslide-bg)] via-[var(--gslide-bg)] to-transparent px-6 backdrop-blur sm:h-[80px] sm:px-8",
        className,
      )}
    >
      <h1 className="whitespace-nowrap font-unbounded text-[22px] font-normal tracking-[-0.03em] text-[var(--gslide-ink)]">
        {title}
      </h1>
      {actions}
    </header>
  );
}
