import { cn } from "@/lib/utils";

export type GSlideStudioStep = { id: number; label: string };

export function GSlideStepRail({
  steps,
  activeId,
  "aria-label": ariaLabel,
}: {
  steps: GSlideStudioStep[];
  activeId: number;
  "aria-label": string;
}) {
  return (
    <nav className="pointer-events-auto flex items-center" aria-label={ariaLabel}>
      {steps.map((step, index) => {
        const isActive = step.id === activeId;
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex items-center gap-1 sm:gap-1.5 2xl:gap-2">
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full border text-[10px] leading-none sm:h-6 sm:w-6 sm:text-[11px] 2xl:h-7 2xl:w-7 2xl:text-xs",
                  isActive
                    ? "border-[var(--gslide-ink)] bg-[var(--gslide-ink)] text-white"
                    : "border-[#E4E5EB] bg-white text-[#9B9CA3]",
                )}
              >
                {step.id}
              </span>
              <span
                className={cn(
                  "hidden text-[10px] font-medium sm:inline sm:text-[11px] 2xl:text-xs",
                  isActive ? "text-[var(--gslide-ink)]" : "text-[#9B9CA3]",
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 ? (
              <span className="mx-1.5 h-px w-3 bg-[#E9EAF0] sm:mx-2 sm:w-[18px] 2xl:mx-2.5 2xl:w-[22px]" />
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
