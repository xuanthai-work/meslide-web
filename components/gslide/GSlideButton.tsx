import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type GSlideButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
  fullWidth?: boolean;
  muted?: boolean;
};

export function GSlideButton({
  variant = "primary",
  fullWidth = false,
  muted = false,
  className,
  type = "button",
  disabled,
  ...props
}: GSlideButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "rounded-full px-5 py-3 text-xs font-semibold transition active:scale-[0.98] motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--gslide-accent)_15%,transparent)]",
        fullWidth && "w-full",
        muted && disabled
          ? "bg-[#ECECF1] text-[#5C5E68] disabled:opacity-100"
          : variant === "primary"
          ? "bg-[var(--gslide-accent)] text-white hover:bg-[var(--gslide-accent-hover)]"
          : "border border-[var(--gslide-border)] bg-[var(--gslide-card)] text-[var(--gslide-ink)]",
        className,
      )}
      disabled={disabled}
      {...props}
    />
  );
}
