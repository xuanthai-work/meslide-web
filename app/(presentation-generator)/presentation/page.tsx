'use client'
import { useEffect } from "react";
import PresentationPage from "./components/PresentationPage";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import "../utils/prism-languages";
const Page = () => {
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
        <h1 className="text-2xl font-bold">{"Không tìm thấy mã bài thuyết trình"}</h1>
        <p className="text-gray-500 pb-4">{"Vui lòng thử lại"}</p>
        <Button onClick={() => router.push("/dashboard")}>
          {"Về trang chủ"}
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
