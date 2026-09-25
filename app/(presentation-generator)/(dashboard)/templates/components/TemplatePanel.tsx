"use client";
import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ensureTailwindBrowserScript } from "@/lib/tailwind-browser";
import { useTemplateSummaries } from "../../../hooks/useTemplateSummaries";
import {
  TemplateListCard,
  TemplateListLoadingState,
  TemplateListEmptyState,
} from "../../../components/TemplateListUi";
import { useT } from "@/i18n/provider";
import { GSlideHeader } from "@/components/gslide";

const LayoutPreview = () => {
  const t = useT();
  const router = useRouter();
  const {
    defaultTemplates,
    loading,
    error,
  } = useTemplateSummaries();

  useEffect(() => {
    ensureTailwindBrowserScript();
  }, []);

  const handleOpenTemplate = useCallback(
    (templateId: string) => {
      router.push(`/template-preview?templateV2Id=${templateId}`);
    },
    [router]
  );

  return (
    <div className="relative min-h-[100dvh] bg-[var(--gslide-bg)]">
      <GSlideHeader title={t("templates.page.title")} />

      <div className="mx-auto px-6 py-8">
        <section className="my-12">
          {loading ? (
            <TemplateListLoadingState message={t("templates.loading.default")} />
          ) : error ? (
            <TemplateListEmptyState message={t("templates.error.loadFailed", { error })} />
          ) : defaultTemplates.length === 0 ? (
            <TemplateListEmptyState message={t("templates.empty.noBuiltin")} />
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {defaultTemplates.map((template) => (
                <TemplateListCard
                  key={template.id}
                  template={template}
                  onClick={() => handleOpenTemplate(template.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default LayoutPreview;
