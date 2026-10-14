"use client";

import { useEffect, useState } from "react";
import {
  Keyboard,
  Layers3,
  MousePointer2,
  PencilLine,
  Presentation,
  CircleHelp,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EDITOR_SHORTCUT_SECTIONS,
  type EditorShortcutSection,
} from "@/components/slide-editor/shortcuts/editorShortcuts";
import {
  ShortcutKeys,
  useAppleShortcutPlatform,
} from "@/components/slide-editor/shortcuts/ShortcutKeys";

const SECTION_ICONS: Record<EditorShortcutSection["id"], LucideIcon> = {
  selection: MousePointer2,
  editing: PencilLine,
  arrange: Layers3,
  navigation: Presentation,
  help: CircleHelp,
};

export function KeyboardShortcutsDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const detectedApplePlatform = useAppleShortcutPlatform();
  const [platformOverride, setPlatformOverride] = useState<boolean | null>(null);
  const applePlatform = platformOverride ?? detectedApplePlatform;

  useEffect(() => {
    const handleShortcutHelp = (event: globalThis.KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.key !== "?" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }
      event.preventDefault();
      onOpenChange(true);
    };

    document.addEventListener("keydown", handleShortcutHelp);
    return () => document.removeEventListener("keydown", handleShortcutHelp);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[10021] max-h-[calc(100vh-32px)] w-[calc(100%-32px)] max-w-[780px] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-[20px] border border-[#E7E8EC] bg-white p-0 font-syne shadow-[0_24px_80px_rgba(16,24,40,0.24)]"
        overlayClassName="z-[10020] bg-[#101323]/45 backdrop-blur-[2px]"
      >
        <DialogHeader className="space-y-0 border-b border-[#EAECF0] px-6 py-5 pr-14 text-left">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3.5">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-[#DBEAFE] text-[#1D6FE8]">
                <Keyboard
                  aria-hidden="true"
                  className="size-5"
                  strokeWidth={1.8}
                />
              </span>
              <div>
                <DialogTitle className="text-[18px] font-semibold leading-6 text-[#101323]">
                  {"Phím tắt"}
                </DialogTitle>
                <DialogDescription className="mt-1 text-[13px] leading-5 text-[#667085]">
                  {"Làm việc nhanh hơn khi vùng slide đang hoạt động. Phím tắt sẽ tạm dừng khi bạn nhập trong trường văn bản."}
                </DialogDescription>
              </div>
            </div>
            <div
              aria-label={"Nền tảng phím tắt"}
              className="inline-flex w-fit shrink-0 rounded-[9px] border border-[#E1E3E9] bg-[#F6F6F9] p-1"
              role="group"
            >
              <PlatformButton
                active={!applePlatform}
                label={"Windows / Linux"}
                onClick={() => setPlatformOverride(false)}
              />
              <PlatformButton
                active={applePlatform}
                label="macOS"
                onClick={() => setPlatformOverride(true)}
              />
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-5">
          <div className="grid items-start gap-4 md:grid-cols-2">
            {EDITOR_SHORTCUT_SECTIONS.map((section) => {
              const SectionIcon = SECTION_ICONS[section.id];
              return (
                <section
                  key={section.id}
                  className="overflow-hidden rounded-[14px] border border-[#EAECF0] bg-[#FCFCFD]"
                >
                  <div className="border-b border-[#EAECF0] bg-white px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <SectionIcon
                        aria-hidden="true"
                        className="size-4 text-[#1D6FE8]"
                        strokeWidth={1.8}
                      />
                      <h3 className="text-[14px] font-semibold text-[#101323]">
                        {sectionTitle(section.id)}
                      </h3>
                    </div>
                    <p className="mt-1 text-[11px] leading-4 text-[#7A8295]">
                      {sectionDescription(section.id)}
                    </p>
                  </div>
                  <div className="divide-y divide-[#EAECF0]">
                    {section.shortcuts.map((shortcut) => (
                      <div
                        key={shortcut.id}
                        className="flex min-h-[68px] items-center justify-between gap-4 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-[#344054]">
                            {shortcutLabel(shortcut.id)}
                          </p>
                          <p className="mt-0.5 text-[11px] leading-4 text-[#7A8295]">
                            {shortcutDescription(shortcut.id)}
                          </p>
                        </div>
                        <ShortcutKeys
                          applePlatform={applePlatform}
                          shortcut={shortcut}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <div className="border-t border-[#EAECF0] bg-[#FCFCFD] px-6 py-3 text-center text-[11px] text-[#7A8295]">
          {`Đang hiển thị phím tắt cho ${applePlatform ? "macOS" : "Windows / Linux"}.`}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function sectionTitle(id: EditorShortcutSection["id"]) {
  switch (id) {
    case "selection": return "Lựa chọn";
    case "editing": return "Chỉnh sửa";
    case "arrange": return "Sắp xếp lớp";
    case "navigation": return "Điều hướng slide";
    case "help": return "Trợ giúp";
  }
}

function sectionDescription(id: EditorShortcutSection["id"]) {
  switch (id) {
    case "selection": return "Chọn và sắp xếp đối tượng trên slide đang mở.";
    case "editing": return "Các lệnh chỉnh sửa thường dùng cho đối tượng trên slide.";
    case "arrange": return "Thay đổi vị trí lớp của đối tượng đã chọn.";
    case "navigation": return "Di chuyển giữa các slide mà không rời vùng soạn thảo.";
    case "help": return "Mở lại nhanh bảng tham khảo này.";
  }
}

const shortcutKeyById = {
  "multi-select": "multiSelect", group: "group", delete: "delete", undo: "undo",
  redo: "redo", copy: "copy", paste: "paste", "bring-forward": "bringForward",
  "bring-to-front": "bringToFront", "send-backward": "sendBackward",
  "send-to-back": "sendToBack", nudge: "nudge", "nudge-large": "nudgeLarge",
  "previous-slide": "previousSlide",
  "next-slide": "nextSlide", "shortcut-help": "help",
} as const;

function shortcutLabel(id: keyof typeof shortcutKeyById) {
  const key = shortcutKeyById[id];
  const labels = {
    multiSelect: "Thêm vào vùng chọn", group: "Nhóm đối tượng", delete: "Xóa vùng chọn", undo: "Hoàn tác", redo: "Làm lại", copy: "Sao chép vùng chọn", paste: "Dán", bringForward: "Đưa lên một lớp", bringToFront: "Đưa lên trên cùng", sendBackward: "Đưa xuống một lớp", sendToBack: "Đưa xuống dưới cùng", nudge: "Tinh chỉnh vị trí", nudgeLarge: "Dịch chuyển nhanh", previousSlide: "Slide trước", nextSlide: "Slide sau", help: "Phím tắt",
  };
  return labels[key];
}

function shortcutDescription(id: keyof typeof shortcutKeyById) {
  const key = shortcutKeyById[id];
  const descriptions = {
    multiSelect: "Giữ Shift khi nhấp để thêm hoặc bỏ một đối tượng.", group: "Gộp hai hoặc nhiều đối tượng đã chọn thành một nhóm.", delete: "Xóa đối tượng đang chọn khỏi slide.", undo: "Hoàn tác thay đổi gần nhất trên slide đang mở.", redo: "Khôi phục thay đổi vừa được hoàn tác.", copy: "Sao chép các đối tượng đang chọn.", paste: "Dán các đối tượng đã sao chép với độ lệch nhỏ.", bringForward: "Đưa đối tượng đã chọn lên trước một lớp.", bringToFront: "Đưa đối tượng đã chọn lên trên tất cả đối tượng khác.", sendBackward: "Đưa đối tượng đã chọn xuống sau một lớp.", sendToBack: "Đưa đối tượng đã chọn xuống sau tất cả đối tượng khác.", nudge: "Dùng phím mũi tên để dịch đối tượng đã chọn 1px.", nudgeLarge: "Giữ Shift và nhấn phím mũi tên để dịch đối tượng 10px.", previousSlide: "Mở slide đứng trước slide hiện tại.", nextSlide: "Mở slide đứng sau slide hiện tại.", help: "Mở hướng dẫn phím tắt này.",
  };
  return descriptions[key];
}

function PlatformButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`rounded-[6px] px-2.5 py-1.5 font-manrope text-[11px] font-semibold transition-colors ${
        active
          ? "bg-white text-[#1D6FE8] shadow-[0_1px_3px_rgba(16,24,40,0.12)]"
          : "text-[#667085] hover:text-[#344054]"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}
