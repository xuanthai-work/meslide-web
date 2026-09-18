"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Heart,
  Plus,
  Search,
} from "lucide-react";

import SmartHtmlSlide from "@/app/(presentation-generator)/components/SmartHtmlSlide";
import {
  CommunityPresentationApi,
  getCommunityPresentationAuthor,
  getCommunityPresentationTitle,
  type CommunityPresentation,
  type CommunityPresentationListFilters,
} from "@/app/(presentation-generator)/services/api/community";
import CommunityPresentationFilters from "@/app/(presentation-generator)/upload/components/CommunityPresentationFilters";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { notify } from "@/components/ui/sonner";
import CommunityDesignPreviewDialog from "./CommunityDesignPreviewDialog";
import { GSlideHeader, GSlideSkeleton } from "@/components/gslide";
import { useI18n, useT } from "@/i18n/provider";
import { formatNumber } from "@/i18n/format";
import { includesSearchText, normalizeSearchText } from "@/utils/normalizeSearchText";

const PAGE_SIZE = 20;

export default function CommunityPage() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [filters, setFilters] =
    useState<CommunityPresentationListFilters>({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [presentations, setPresentations] = useState<
    CommunityPresentation[]
  >([]);
  const [preview, setPreview] = useState<CommunityPresentation | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    const loadPresentations = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await CommunityPresentationApi.list(
          page,
          PAGE_SIZE,
          controller.signal,
          filters
        );
        if (controller.signal.aborted) return;
        setPresentations(response.results ?? []);
        setTotalPages(response.total_pages ?? 0);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setPresentations([]);
        setError(
          loadError instanceof Error
            ? loadError.message
            : t("community.error.fallback")
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void loadPresentations();
    return () => controller.abort();
  }, [filters, page, pathname, retryVersion, t]);

  const filteredPresentations = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return presentations;
    return presentations.filter((presentation) =>
      [
        presentation.title,
        presentation.description,
        presentation.prompt,
        presentation.created_by,
      ]
        .filter((value): value is string => Boolean(value))
        .some((value) => includesSearchText(value, normalizedQuery))
    );
  }, [presentations, query]);

  const hasActiveFilters = Object.keys(filters).some(
    (key) => key !== "order" && key !== "order_by"
  );

  const openPreview = async (presentation: CommunityPresentation) => {
    setPreview(presentation);
    setPreviewLoading(true);
    try {
      const detail = await CommunityPresentationApi.getById(presentation.id);
      setPreview(detail);
      setPresentations((current) =>
        current.map((item) => (item.id === detail.id ? detail : item))
      );
    } catch (previewError) {
      notify.error(
        t("community.toast.previewLoadError"),
        previewError instanceof Error ? previewError.message : undefined
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  const applyDesign = (presentation: CommunityPresentation) => {
    const params = new URLSearchParams({
      mode: "smart",
      communityId: String(presentation.id),
    });
    router.push(`/upload?${params.toString()}`);
  };

  const applyPrompt = (presentation: CommunityPresentation) => {
    const prompt = presentation.prompt?.trim();
    if (!prompt) {
      notify.error(
        t("community.toast.promptUnavailable"),
        t("community.toast.promptUnavailableDescription")
      );
      return;
    }
    const params = new URLSearchParams({ mode: "smart", prompt });
    router.push(`/upload?${params.toString()}`);
  };

  return (
    <div className="min-h-[100dvh] bg-[var(--gslide-bg)]">
      <GSlideHeader
        title={t("community.header.title")}
        actions={
          <Link
            href="/upload"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--gslide-accent)] px-4 text-sm font-semibold text-white transition active:scale-[0.98] hover:bg-[var(--gslide-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gslide-accent)] motion-reduce:active:scale-100"
          >
            {t("community.header.newPresentation")}
            <ChevronRight className="h-4 w-4" />
          </Link>
        }
      />

      <main className="px-7 py-8">
        <div className="flex min-h-10 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-medium text-[#191919]">
              {t("community.intro.title")}
            </h2>
            <p className="mt-1 text-xs text-[var(--gslide-muted)]">
              {t("community.intro.description")}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end lg:w-auto">
            <label className="flex h-10 w-full items-center gap-2.5 rounded-full border border-[var(--gslide-input-border)] bg-white px-2.5 sm:w-[234px]">
              <Search className="h-4 w-4 shrink-0 text-[var(--gslide-muted)]" strokeWidth={1.75} />
              <span className="sr-only">{t("community.search.aria")}</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("community.search.placeholder")}
                className="min-w-0 flex-1 bg-transparent text-base font-normal text-[var(--gslide-ink)] outline-none placeholder:text-[var(--gslide-muted)]"
              />
            </label>
            <CommunityPresentationFilters
              value={filters}
              onChange={(nextFilters) => {
                setPage(1);
                setFilters(nextFilters);
              }}
              disabled={loading}
            />
          </div>
        </div>

        {loading ? (
          <CommunityGridSkeleton />
        ) : error ? (
          <div className="mt-5 rounded-xl border border-dashed border-[#D9D9DE] bg-[#FAFAFC] px-6 py-12 text-center">
            <h3 className="text-sm font-semibold text-[#191919]">
              {t("community.error.loadFailed")}
            </h3>
            <p className="mt-1 text-xs text-[#808080]">{error}</p>
            <button
              type="button"
              onClick={() => setRetryVersion((current) => current + 1)}
              className="mt-4 rounded-full border border-[var(--gslide-border)] bg-white px-4 py-2 text-xs font-medium text-[var(--gslide-accent)] transition hover:bg-[var(--gslide-accent-soft)]"
            >
              {t("community.error.tryAgain")}
            </button>
          </div>
        ) : filteredPresentations.length > 0 ? (
          <div className="mt-5 grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[2200px]:grid-cols-6">
            {filteredPresentations.map((presentation) => (
              <CommunityPresentationCard
                key={presentation.id}
                presentation={presentation}
                onPreview={() => void openPreview(presentation)}
                onUseDesign={() => applyDesign(presentation)}
                onUsePrompt={() => applyPrompt(presentation)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-[#D9D9DE] bg-[#FAFAFC] px-6 py-12 text-center">
            <Search className="mx-auto h-5 w-5 text-[#808080]" />
            <h3 className="mt-3 text-sm font-semibold text-[#191919]">
              {query.trim() || hasActiveFilters
                ? t("community.empty.noMatches")
                : t("community.empty.noPresentations")}
            </h3>
            <p className="mt-1 text-xs text-[#808080]">
              {query.trim() || hasActiveFilters
                ? t("community.empty.noMatchesHint")
                : t("community.empty.noPresentationsHint")}
            </p>
          </div>
        )}

        {!loading && !error && totalPages > 1 && !query.trim() && (
          <div className="mt-7 flex items-center justify-center gap-4 text-xs text-[#666666]">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-[var(--gslide-border)] bg-white px-3 text-[var(--gslide-ink)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {t("community.pagination.previous")}
            </button>
            <span>
              {t("community.pagination.pageOf", { page, total: totalPages })}
            </span>
            <button
              type="button"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={page >= totalPages}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-[var(--gslide-border)] bg-white px-3 text-[var(--gslide-ink)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("community.pagination.next")}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </main>

      <CommunityDesignPreviewDialog
        presentation={preview}
        open={Boolean(preview)}
        loading={previewLoading}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        onUseDesign={(presentation) => applyDesign(presentation)}
      />
    </div>
  );
}
function CommunityPresentationCard({
  presentation,
  onPreview,
  onUseDesign,
  onUsePrompt,
}: {
  presentation: CommunityPresentation;
  onPreview: () => void;
  onUseDesign: () => void;
  onUsePrompt: () => void;
}) {
  const t = useT();
  const { locale } = useI18n();
  const title = getCommunityPresentationTitle(presentation);
  const thumbnail = presentation.slides?.find((slide) => slide.trim());
  const author = getCommunityPresentationAuthor(presentation);

  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-[var(--gslide-border)] bg-white shadow-none transition-shadow hover:shadow-[0_10px_28px_rgba(16,24,40,0.06)]">
      <button
        type="button"
        onClick={onPreview}
        className="group block aspect-[306/169] w-full overflow-hidden bg-[#F8FBFB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--gslide-accent)]/35"
        aria-label={t("community.card.previewAria", { title })}
      >
        {thumbnail ? (
          <div className="transition duration-300 group-hover:scale-[1.015]">
            <SmartHtmlSlide
              executeScripts={false}
              html={thumbnail}
              fonts={presentation.fonts}
              title={t("community.card.previewTitle", { title })}
            />
          </div>
        ) : (
          <span className="flex h-full items-center justify-center text-xs text-[#999999]">
            {t("community.card.noPreview")}
          </span>
        )}
      </button>

      <div className="border-t border-[var(--gslide-border)] px-2.5 pb-2.5">
        <div className="flex min-h-[54px] items-center gap-2 py-3 sm:gap-2.5 sm:py-3.5">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold tracking-[0.14px] text-[#191919]" title={title}>
            {title}
          </p>
          <button
            type="button"
            onClick={onPreview}
            className="flex h-[26px] w-[42px] items-center justify-center rounded-full border border-[var(--gslide-border)] bg-white text-[var(--gslide-ink)] transition hover:bg-[var(--gslide-accent-soft)]"
            aria-label={t("community.card.previewAria", { title })}
          >
            <Eye className="h-3.5 w-3.5" strokeWidth={1.6} />
          </button>
          <div className="flex h-[26px] overflow-hidden rounded-full border border-[var(--gslide-border)] bg-white">
            <button
              type="button"
              onClick={onUseDesign}
              className="px-3.5 pr-2 text-xs font-medium text-[var(--gslide-ink)] transition hover:bg-[var(--gslide-accent-soft)]"
            >
              {t("community.card.use")}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex w-6 items-center justify-center border-l border-[var(--gslide-border)] transition hover:bg-[var(--gslide-accent-soft)]"
                  aria-label={t("community.card.useDesignAria", { title })}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[190px] rounded-xl p-2 font-manrope">
                <DropdownMenuItem onSelect={onUseDesign} className="cursor-pointer rounded-md">
                  <Plus className="h-4 w-4" />
                  {t("community.card.useDesign")}
                </DropdownMenuItem>
                {presentation.prompt?.trim() && (
                  <DropdownMenuItem onSelect={onUsePrompt} className="cursor-pointer rounded-md">
                    <FileText className="h-4 w-4" />
                    {t("community.card.usePrompt")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex min-h-[34px] items-center justify-between border-t border-[var(--gslide-border)] py-2.5 text-[10px] font-medium tracking-[0.4px] text-[#808080]">
          <span className="min-w-0 flex-1 truncate" title={author}>{t("community.card.by", { author })}</span>
          <div className="ml-2 flex shrink-0 items-center gap-3">
            <span className="inline-flex items-center gap-1" aria-label={t("community.card.viewsAria", { count: presentation.views ?? 0 })}>
              <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
              {formatNumber(presentation.views ?? 0, locale, { notation: "compact" })}
            </span>
            <span className="inline-flex items-center gap-1" aria-label={t("community.card.likesAria", { count: presentation.likes ?? 0 })}>
              <Heart className="h-3.5 w-3.5" strokeWidth={1.5} />
              {formatNumber(presentation.likes ?? 0, locale, { notation: "compact" })}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function CommunityGridSkeleton() {
  return (
    <div className="mt-5 grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[2200px]:grid-cols-6">
      {Array.from({ length: 10 }).map((_, index) => (
        <GSlideSkeleton
          key={index}
          className="aspect-[306/267] rounded-xl border border-[var(--gslide-border)]"
        />
      ))}
    </div>
  );
}
