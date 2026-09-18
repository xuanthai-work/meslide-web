"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GSlideWordmark } from "@/components/gslide";
import { useT } from "@/i18n/provider";

interface OutlineStandardHeaderProps {
  title: string;
  onBack: () => void;
}

const OutlineStandardHeader = ({
  title,
  onBack,
}: OutlineStandardHeaderProps) => {
  const t = useT();
  return (
  <header className="sticky top-0 z-[60] h-[72px] w-full border-b border-[var(--gslide-border)] bg-[var(--gslide-bg)] sm:h-[80px]">
    <div className="flex h-full items-center justify-between px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/dashboard"
          aria-label={t("outline.header.aria.goToDashboard")}
          className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gslide-accent)]"
        >
          <GSlideWordmark className="text-base" />
        </Link>
        <h1 className="truncate font-unbounded text-base font-normal tracking-[-0.03em] text-[var(--gslide-ink)]">
          {title}
        </h1>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="flex shrink-0 items-center gap-2 text-xs font-semibold text-[var(--gslide-ink)] transition-colors hover:text-[var(--gslide-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gslide-accent)]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("common.actions.back")}
      </button>
    </div>
  </header>
  );
};

export default OutlineStandardHeader;
