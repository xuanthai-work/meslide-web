import { cn } from "@/lib/utils";

export function GSlideStudioTitle({
  title,
  description,
  compact = false,
  className,
}: {
  title: string;
  description?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-4 text-center",
        compact
          ? "pt-[88px] sm:pt-[96px] 2xl:pt-[112px]"
          : "pt-[96px] sm:pt-[108px] 2xl:pt-[128px]",
        className,
      )}
    >
      <h1 className="font-unbounded text-[36px] font-normal leading-[1.1] tracking-[-1.2px] text-[var(--gslide-ink)] sm:text-[48px] sm:tracking-[-1.4px] md:text-[56px] 2xl:text-[68px] 2xl:tracking-[-1.8px]">
        {title}
      </h1>
      {description ? (
        <p className="mx-auto mt-3 max-w-[480px] text-center text-[15px] font-normal leading-[1.4] text-[var(--gslide-ink)]/80 sm:mt-4 sm:max-w-[520px] sm:text-[16px] 2xl:mt-5 2xl:max-w-[600px] 2xl:text-[18px]">
          {description}
        </p>
      ) : null}
    </div>
  );
}
