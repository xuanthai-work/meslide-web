"use client";

import React, { memo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { resolveBackendAssetUrl } from "@/utils/api";
import { TemplateListItem } from "../services/api/template";
import {
  TemplatePreviewStage,
  LayoutsBadge,
} from "./TemplatePreviewComponents";
import { useI18n, useT } from "@/i18n/provider";
import { translate } from "@/i18n/translate";
import { templateCardCopy } from "./builtin-template-copy";

export function TemplateThumbnailPreview({
  thumbnail,
  templateName,
}: {
  thumbnail?: string | null;
  templateName: string;
}) {
  const t = useT();
  const resolvedThumbnail = thumbnail ? resolveBackendAssetUrl(thumbnail) : "";

  if (!resolvedThumbnail) {
    return (
      <div
        className="relative z-10 flex aspect-video w-full items-center justify-center rounded-[12px] border border-[#EDEEEF] bg-white/80"
      >
        <div className="h-10 w-16 rounded-md border border-dashed border-[#C9CDD8] bg-[#F7F8FB]" />
      </div>
    );
  }

  return (
    <div
      className="relative z-10 flex aspect-video w-full items-center justify-center"
    >
      <div
        aria-label={t("templates.card.thumbnailAria", { name: templateName })}
        className="h-full w-full rounded-[12px] border border-[#EDEEEF] bg-white bg-contain bg-center bg-no-repeat shadow-sm"
        role="img"
        style={{ backgroundImage: `url(${JSON.stringify(resolvedThumbnail)})` }}
      />
    </div>
  );
}

export const TemplateListCard = memo(function TemplateListCard({
  template,
  onClick,
}: {
  template: TemplateListItem;
  onClick: () => void;
}) {
  const { locale, t } = useI18n();
  const cardCopy = templateCardCopy(template, locale);
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.currentTarget.getAttribute("aria-disabled") === "true") {
        return;
      }
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      onClick();
    },
    [onClick]
  );

  const rawStatus = template.generation_status ?? template.status ?? null;
  const status = rawStatus?.toLowerCase().replace(/[_-]+/g, " ") ?? null;
  const isGeneratingStatus =
    status === "generating" ||
    status === "processing" ||
    status === "pending" ||
    status === "queued" ||
    status === "running";
  const statusLabel =
    status && !isGeneratingStatus
      ? status.replace(/\b\w/g, (char) => char.toUpperCase())
      : null;

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={t("templates.card.openAria", { name: cardCopy.name })}
      className={cn(
        "group relative overflow-hidden rounded-[22px] border bg-white shadow-none outline-none transition-all duration-200",
        "cursor-pointer hover:-translate-y-1 hover:border-[#1D6FE8] hover:ring-2 hover:ring-[#1D6FE8]/20 hover:shadow-[0_18px_40px_rgba(34,31,54,0.12)] focus-visible:-translate-y-1 focus-visible:border-[#1D6FE8] focus-visible:ring-2 focus-visible:ring-[#1D6FE8]/30 focus-visible:shadow-[0_18px_40px_rgba(34,31,54,0.12)]",
        "border-[#E8E9EC]"
      )}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      <div className="pointer-events-none absolute inset-0 z-30 rounded-[22px] bg-[#1D6FE8]/[0.04] opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100" />
      <TemplatePreviewStage>
        <LayoutsBadge count={template.layout_count ?? 0} />
        <TemplateThumbnailPreview
          thumbnail={template.thumbnail}
          templateName={cardCopy.name}
        />
      </TemplatePreviewStage>
      <div className="relative z-40 flex items-center justify-between gap-4 border-t border-[#EDEEEF] bg-white px-6 py-5">
        <div className="min-w-0 flex-1">
          <h3 className="font-syne text-base font-bold capitalize text-gray-900">
            {cardCopy.name}
          </h3>
          {cardCopy.description && (
            <p className="mt-1 line-clamp-2 font-syne text-sm text-gray-500">
              {cardCopy.description}
            </p>
          )}
          {statusLabel && (
            <span
              className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-[#E7E8EE] bg-[#F6F7FA] px-2.5 py-1 text-[11px] font-medium text-[#60636F]"
            >
              {statusLabel}
            </span>
          )}
        </div>
        <ArrowUpRight
          aria-hidden="true"
          strokeWidth={2}
          className="h-4 w-4 shrink-0 text-gray-400 transition-colors group-hover:text-purple-600"
        />
      </div>
    </Card>
  );
});

export function TemplateListLoadingState({ message = translate("templates.loading.default") }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-12 font-syne">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      <span className="ml-3 text-gray-600">{message}</span>
    </div>
  );
}

export function TemplateListEmptyState({ message = translate("templates.empty.noTemplates") }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-12 font-syne text-gray-600">
      {message}
    </div>
  );
}
