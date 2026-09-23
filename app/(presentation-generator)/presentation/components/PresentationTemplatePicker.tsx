"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GSlideButton, GSlideHeader } from "@/components/gslide";
import { useT } from "@/i18n/provider";
import CreateCustomTemplate from "../../(dashboard)/templates/components/CreateCustomTemplate";
import {
  TemplateListCard,
  TemplateListEmptyState,
  TemplateListLoadingState,
  TemplateListSection,
} from "../../components/TemplateListUi";
import { useTemplateSummaries } from "../../hooks/useTemplateSummaries";
import type { TemplateListItem } from "../../services/api/template";

type PresentationTemplatePickerProps = {
  presentationId: string;
  suggestedTemplate?: string | null;
};

const normalizeTemplateName = (name: string) =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

const matchesSuggestedTemplate = (
  template: TemplateListItem,
  suggestion: string | null,
) => Boolean(
  suggestion &&
    (template.id === suggestion ||
      normalizeTemplateName(template.name) === normalizeTemplateName(suggestion)),
);

export default function PresentationTemplatePicker({
  presentationId,
  suggestedTemplate = null,
}: PresentationTemplatePickerProps) {
  const router = useRouter();
  const t = useT();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const { defaultTemplates, customTemplates, loading, error } =
    useTemplateSummaries();

  const selectTemplate = (template: TemplateListItem) => {
    setSelectedTemplateId(template.id);
    const params = new URLSearchParams({
      id: presentationId,
      auto: "1",
      template: template.id,
    });
    router.replace(`/presentation?${params.toString()}`);
  };

  const suggestedMatchId =
    !loading && suggestedTemplate
      ? ([...defaultTemplates, ...customTemplates].find((template) =>
          matchesSuggestedTemplate(template, suggestedTemplate),
        )?.id ?? null)
      : null;
  const activeTemplateId = selectedTemplateId ?? suggestedMatchId;

  const renderTemplateCard = (template: TemplateListItem) => (
    <TemplateListCard
      key={template.id}
      template={template}
      isSelected={activeTemplateId === template.id}
      isSuggested={matchesSuggestedTemplate(template, suggestedTemplate)}
      showArrow
      selectionPage
      onClick={() => selectTemplate(template)}
    />
  );

  const body = loading ? (
    <TemplateListLoadingState />
  ) : error ? (
    <TemplateListEmptyState
      message={t("templates.selection.error.loadFailed", { error })}
    />
  ) : (
    <div className="space-y-[30px]">
      {customTemplates.length > 0 && (
        <TemplateListSection
          label={t("templates.selection.section.custom")}
          selectionPage
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <CreateCustomTemplate selectionPage />
            {customTemplates.map(renderTemplateCard)}
          </div>
        </TemplateListSection>
      )}
      <TemplateListSection
        label={
          customTemplates.length > 0
            ? t("templates.selection.section.builtin")
            : t("templates.selection.section.templates")
        }
        selectionPage
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {customTemplates.length === 0 && <CreateCustomTemplate selectionPage />}
          {defaultTemplates.map(renderTemplateCard)}
        </div>
      </TemplateListSection>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-[var(--gslide-bg)]">
      <GSlideHeader
        title={t("templates.selection.title")}
        actions={
          <GSlideButton variant="secondary" onClick={() => router.push("/upload")}>
            {t("common.actions.back")}
          </GSlideButton>
        }
      />
      <main className="mx-auto w-full max-w-[1440px] px-5 pb-12 pt-10 sm:px-10 lg:px-20">
        {body}
      </main>
    </div>
  );
}
