'use client'
import { useEffect } from "react";
import PresentationPage from "./components/PresentationPage";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import "../utils/prism-languages";
import { useT } from "@/i18n/provider";
const Page = () => {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const queryId = params.get("id");
  const missingTemplate = params.get("auto") === "1" && !params.get("template")?.trim();

  useEffect(() => {
    if (queryId && missingTemplate) router.replace("/upload");
  }, [queryId, missingTemplate, router]);

  if (!queryId) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--gslide-bg)]">
        <h1 className="text-2xl font-bold">{t("presentation.page.missingId")}</h1>
        <p className="text-gray-500 pb-4">{t("presentation.page.tryAgain")}</p>
        <Button onClick={() => router.push("/dashboard")}>
          {t("presentation.page.goHome")}
        </Button>
      </div>
    );
  }
  if (missingTemplate) return null;

  return (

    <PresentationPage presentation_id={queryId} />

  );
};
export default Page;
