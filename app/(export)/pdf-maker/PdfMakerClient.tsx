"use client";

import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/i18n/provider";
import PdfMakerPage from "./PdfMakerPage";

export default function PdfMakerClient() {
  const router = useRouter();
  const params = useSearchParams();
  const t = useT();
  const queryId = params.get("id");
  const exportCookie = params.get("exportCookie") ?? undefined;
  if (!queryId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-bold">{t("export.pdfMaker.noPresentationId.title")}</h1>
        <p className="text-gray-500 pb-4">{t("export.pdfMaker.noPresentationId.subtitle")}</p>
        <Button onClick={() => router.push("/dashboard")}>{t("export.pdfMaker.noPresentationId.goHome")}</Button>
      </div>
    );
  }
  return (
    <PdfMakerPage presentation_id={queryId} exportCookie={exportCookie} />
  );
}
