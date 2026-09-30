"use client";

import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import PdfMakerPage from "./PdfMakerPage";

export default function PdfMakerClient() {
  const router = useRouter();
  const params = useSearchParams();
  const queryId = params.get("id");
  const exportCookie = params.get("exportCookie") ?? undefined;
  if (!queryId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-bold">{"Không tìm thấy id bài thuyết trình"}</h1>
        <p className="text-gray-500 pb-4">{"Vui lòng thử lại"}</p>
        <Button onClick={() => router.push("/dashboard")}>{"Về trang chủ"}</Button>
      </div>
    );
  }
  return (
    <PdfMakerPage presentation_id={queryId} exportCookie={exportCookie} />
  );
}
