"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import CreateCustomTemplate from "./CreateCustomTemplate";
import Link from "next/link";
import { ensureTailwindBrowserScript } from "@/lib/tailwind-browser";
import { useTemplateSummaries, TemplateTab } from "../../../hooks/useTemplateSummaries";
import {
  ProcessingTemplateListCard,
  TemplateListCard,
  TemplateTabSwitcher,
  TemplateListLoadingState,
  TemplateListEmptyState,
} from "../../../components/TemplateListUi";
import { useT } from "@/i18n/provider";
import { GSlideHeader } from "@/components/gslide";

const LayoutPreview = () => {
  const t = useT();
  const [tab, setTab] = useState<TemplateTab>("default");
  const router = useRouter();
  const {
    defaultTemplates,
    customTemplates,
    processingTemplateTasks,
    loading,
    error,
  } = useTemplateSummaries({ includeProcessingTemplateTasks: true });

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (requestedTab === "custom" || requestedTab === "default") {
      setTab(requestedTab);
    }

    ensureTailwindBrowserScript();
  }, []);

  const handleOpenTemplate = useCallback(
    (templateId: string) => {
      router.push(`/template-preview?templateV2Id=${templateId}`);
    },
    [router]
  );

  const handleTabChange = useCallback((nextTab: TemplateTab) => {
    setTab(nextTab);
  }, []);

  const activeTemplates = tab === "default" ? defaultTemplates : customTemplates;

  return (
    <div className="relative min-h-[100dvh] bg-[var(--gslide-bg)]">
      <GSlideHeader
        title={t("templates.page.title")}
        actions={
          <Link
            href="/custom-template"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--gslide-accent)] px-4 text-sm font-semibold text-white transition active:scale-[0.98] hover:bg-[var(--gslide-accent-hover)] motion-reduce:active:scale-100"
            aria-label={t("templates.actions.createNewAria")}
          >
            <span className="hidden md:inline">{t("templates.actions.newTemplate")}</span>
            <span className="md:hidden">{t("templates.actions.newTemplateShort")}</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        }
      />

      <div className="mx-auto px-6 py-8">
        <TemplateTabSwitcher tab={tab} onTabChange={handleTabChange} />

        <section className="my-12">
          {loading ? (
            <TemplateListLoadingState message={t("templates.loading.default")} />
          ) : error ? (
            <TemplateListEmptyState message={t("templates.error.loadFailed", { error })} />
          ) : tab === "custom" ? (
            <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              <CreateCustomTemplate />
              {processingTemplateTasks.map((task) => (
                <ProcessingTemplateListCard key={task.id} task={task} />
              ))}
              {customTemplates.map((template) => (
                <TemplateListCard
                  key={template.id}
                  template={template}
                  onClick={() => handleOpenTemplate(template.id)}
                />
              ))}
            </div>
          ) : activeTemplates.length === 0 ? (
            <TemplateListEmptyState message={t("templates.empty.noBuiltin")} />
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {activeTemplates.map((template) => (
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
