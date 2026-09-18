import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GSlideDropCard({
  tab,
  children,
  className,
}: {
  tab?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("group relative", className)}>
      {tab ? (
        <div className="relative z-10 ml-8 w-max rounded-t-[28px] border border-b-0 border-[var(--gslide-border)] bg-white px-3 pb-2.5 pt-2 2xl:ml-10 2xl:rounded-t-[32px] 2xl:px-4 2xl:pb-3 2xl:pt-2.5">
          {tab}
        </div>
      ) : null}
      <div className="relative -mt-px rounded-[28px] border border-[var(--gslide-border)] bg-white p-2.5 shadow-[0_0_16px_rgba(80,71,230,0.08)] 2xl:rounded-[32px] 2xl:p-3">
        {children}
      </div>
    </div>
  );
}
