import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function GSlideCard({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        "rounded-xl border border-[var(--gslide-border)] bg-[var(--gslide-card)] p-7 shadow-none sm:p-9",
        className,
      )}
      {...props}
    />
  );
}
