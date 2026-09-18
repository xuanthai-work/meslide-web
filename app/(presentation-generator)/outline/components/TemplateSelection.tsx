"use client";

import React, { memo, useEffect } from "react";
import CreateCustomTemplate from "../../(dashboard)/templates/components/CreateCustomTemplate";
import { useTemplateSummaries } from "../../hooks/useTemplateSummaries";
import {
  TemplateListCard,
  TemplateListLoadingState,
  TemplateListEmptyState,
  TemplateListSection,
} from "../../components/TemplateListUi";
import { useT } from "@/i18n/provider";

interface TemplateSelectionProps {
  presentationId: string | null;
  selectedTemplateId: string | null;
  suggestedTemplate?: string | null;
  onSuggestedTemplateResolved?: (template: {
    id: string;
    name: string;
    source: "default" | "custom";
    position: number;
  }) => void;
  onSelectTemplate: (template: {
    id: string;
    name: string;
    source: "default" | "custom";
    position: number;
  }) => void;
  onCreateTemplate?: () => void;
}

const normalizeTemplateName = (name: string) =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

const TemplateSelection: React.FC<TemplateSelectionProps> = memo(
  function TemplateSelection({
    selectedTemplateId,
    suggestedTemplate,
    onSuggestedTemplateResolved,
    onSelectTemplate,
    onCreateTemplate,
  }) {
    const t = useT();
    const { defaultTemplates, customTemplates, loading, error } =
      useTemplateSummaries();

    useEffect(() => {
      if (loading || !suggestedTemplate || selectedTemplateId) return;

      const normalizedSuggestion = suggestedTemplate.trim().toLowerCase();
      const candidates = [
        ...defaultTemplates.map((template, position) => ({
          template,
          position,
          source: "default" as const,
        })),
        ...customTemplates.map((template, position) => ({
          template,
          position,
          source: "custom" as const,
        })),
      ];
      const match = candidates.find(
        ({ template }) =>
          template.id === suggestedTemplate ||
          normalizeTemplateName(template.name) === normalizedSuggestion
      );

      if (match) {
        onSuggestedTemplateResolved?.({
          id: match.template.id,
          name: match.template.name,
          source: match.source,
          position: match.position,
        });
      }
    }, [
      customTemplates,
      defaultTemplates,
      loading,
      onSuggestedTemplateResolved,
      selectedTemplateId,
      suggestedTemplate,
    ]);

    if (loading) {
      return <TemplateListLoadingState />;
    }

    if (error) {
      return (
        <TemplateListEmptyState
          message={t("outline.template.error.loadFailed", { error })}
        />
      );
    }

    const renderTemplateCard = (
      template: (typeof defaultTemplates)[number],
      index: number,
      source: "default" | "custom"
    ) => {
      const isSuggested = Boolean(
        suggestedTemplate &&
          (template.id === suggestedTemplate ||
            normalizeTemplateName(template.name) ===
              suggestedTemplate.trim().toLowerCase())
      );

      return (
        <TemplateListCard
          key={template.id}
          template={template}
          isSelected={selectedTemplateId === template.id}
          isSuggested={isSuggested}
          showArrow
          selectionPage
          onClick={() => {
            onSelectTemplate({
              id: template.id,
              name: template.name,
              source,
              position: index,
            });
          }}
        />
      );
    };

    const suggestionNotice = suggestedTemplate && selectedTemplateId && (
      <div className="mb-5 rounded-xl border border-[var(--gslide-border)] bg-[var(--gslide-accent-soft)] px-4 py-3 text-xs font-medium text-[var(--gslide-accent)]">
        <strong className="font-semibold">
          {t("outline.template.suggestion.selected")}
        </strong>{" "}
        {t("outline.template.suggestion.continueHint")}
      </div>
    );

    if (customTemplates.length === 0) {
      return (
        <div className="mb-8">
          {suggestionNotice}
          <TemplateListSection
            label={t("outline.template.section.templates")}
            selectionPage
          >
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <CreateCustomTemplate
                  selectionPage
                  onClick={onCreateTemplate}
                />
              {defaultTemplates.map((template, index) =>
                renderTemplateCard(template, index, "default")
              )}
            </div>
          </TemplateListSection>
        </div>
      );
    }

    return (
      <div className="mb-8 space-y-[30px]">
        {suggestionNotice}
        <TemplateListSection
          label={t("outline.template.section.custom")}
          selectionPage
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <CreateCustomTemplate
              selectionPage
              onClick={onCreateTemplate}
            />
            {customTemplates.map((template, index) =>
              renderTemplateCard(template, index, "custom")
            )}
          </div>
        </TemplateListSection>

        <TemplateListSection
          label={t("outline.template.section.builtin")}
          selectionPage
        >
          {defaultTemplates.length === 0 ? (
            <TemplateListEmptyState
              message={t("outline.template.empty.noBuiltin")}
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {defaultTemplates.map((template, index) =>
                renderTemplateCard(template, index, "default")
              )}
            </div>
          )}
        </TemplateListSection>
      </div>
    );
  }
);

export default TemplateSelection;
