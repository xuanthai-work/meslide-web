"use client";

import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Layout, Loader2 } from "lucide-react";
import { RootState } from "@/store/store";
import { useTemplateSummaries } from "../../hooks/useTemplateSummaries";
import TemplateService, {
  type TemplateDetailsResponse,
} from "../../services/api/template";
import {
  normalizeBackendAssetUrls,
  resolveBackendAssetUrl,
} from "@/utils/api";
import { normalizeTemplateV2Fonts } from "@/components/slide-editor/importing/template-v2-import";
import { applyTemplateToPresentation } from "@/store/slices/presentationGeneration";
import { addToHistory } from "@/store/slices/undoRedoSlice";
import { PresentationGenerationApi } from "../../services/api/presentation-generation";
import { notify } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import type { Theme } from "../../services/api/types";

interface TemplatePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplatePickerDialog({
  open,
  onOpenChange,
}: TemplatePickerDialogProps) {
  const dispatch = useDispatch();
  const presentationData = useSelector(
    (state: RootState) => state.presentationGeneration.presentationData
  );
  const { defaultTemplates, loading, error } = useTemplateSummaries();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );
  const [isApplying, setIsApplying] = useState(false);

  const handleApply = async () => {
    if (!selectedTemplateId || !presentationData || isApplying) return;

    try {
      setIsApplying(true);
      const details = await TemplateService.getTemplateDetails(
        selectedTemplateId
      );
      const normalizedDetails = normalizeBackendAssetUrls(details);
      const fonts = normalizeTemplateV2Fonts(normalizedDetails);
      const detailsTheme =
        (details as TemplateDetailsResponse & { theme?: Theme | null }).theme ??
        null;

      // Lưu lịch sử để hỗ trợ Undo
      if (presentationData.slides) {
        dispatch(
          addToHistory({
            slides: presentationData.slides,
            actionType: "APPLY_TEMPLATE",
          })
        );
      }

      // Cập nhật Redux store
      dispatch(
        applyTemplateToPresentation({
          templateId: details.id,
          layout: normalizedDetails as unknown as Record<string, unknown>,
          fonts,
          theme: detailsTheme,
        })
      );

      // Chuẩn bị payload cập nhật backend
      const updatedSlides = (presentationData.slides || []).map((slide) => {
        if (
          slide.layout_group === "blank" ||
          !slide.layout_group ||
          slide.layout_group === ""
        ) {
          return {
            ...slide,
            layout_group: details.id,
          };
        }
        return slide;
      });

      const nextPresentationData = {
        ...presentationData,
        layout: normalizedDetails,
        fonts,
        slides: updatedSlides,
      };

      // Lưu trực tiếp vào backend
      await PresentationGenerationApi.updatePresentationContent(
        JSON.stringify(nextPresentationData)
      );

      notify.success(
        "Áp dụng mẫu thành công!",
        `Đã chuyển sang mẫu ${details.name || selectedTemplateId}.`
      );
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to apply template:", err);
      notify.error(
        "Không thể áp dụng mẫu",
        err instanceof Error
          ? err.message
          : "Đã có lỗi xảy ra khi tải dữ liệu mẫu."
      );
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6 rounded-[20px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <Layout className="h-5 w-5 text-[#1D6FE8]" />
            {"Chọn mẫu cho bài thuyết trình"}
          </DialogTitle>
          <DialogDescription>
            {
              "Chọn một mẫu thiết kế để áp dụng màu sắc, phông chữ và mở khóa thư viện khối bố cục cho bài thuyết trình."
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto my-4 pr-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#1D6FE8]" />
              <p className="text-sm text-gray-500">
                {"Đang tải danh sách mẫu…"}
              </p>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-sm text-red-500">
              {`Lỗi tải mẫu: ${error}`}
            </div>
          ) : defaultTemplates.length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-500">
              {"Không có mẫu khả dụng."}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {defaultTemplates.map((template) => {
                const isSelected = selectedTemplateId === template.id;
                const thumbnail = template.thumbnail
                  ? resolveBackendAssetUrl(template.thumbnail)
                  : "";

                return (
                  <div
                    key={template.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedTemplateId(template.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedTemplateId(template.id);
                      }
                    }}
                    className={cn(
                      "group relative flex flex-col rounded-[14px] border p-2.5 cursor-pointer transition-all duration-200 text-left outline-none",
                      isSelected
                        ? "border-[#1D6FE8] bg-[#F4F8FF] ring-2 ring-[#1D6FE8]/20 shadow-sm"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                    )}
                  >
                    <div className="relative aspect-video w-full overflow-hidden rounded-[10px] bg-gray-100 mb-2 border border-gray-100">
                      {thumbnail ? (
                        <div
                          className="h-full w-full bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                          style={{ backgroundImage: `url(${thumbnail})` }}
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-xs text-gray-400">
                          {"Chưa có ảnh"}
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#1D6FE8] text-white shadow-sm">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    <span className="font-medium text-sm text-gray-900 truncate">
                      {template.name}
                    </span>
                    {template.layout_count ? (
                      <span className="text-xs text-gray-500 mt-0.5">
                        {`${template.layout_count} bố cục`}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isApplying}
            className="rounded-full px-5"
          >
            {"Hủy"}
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={!selectedTemplateId || isApplying}
            className="rounded-full px-6 bg-[#1D6FE8] hover:bg-[#1557B0] text-white"
          >
            {isApplying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {"Áp dụng mẫu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
