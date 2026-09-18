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
import { useT } from "@/i18n/provider";

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
  const t = useT();
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
                  {t("presentation.shortcuts.title")}
                </DialogTitle>
                <DialogDescription className="mt-1 text-[13px] leading-5 text-[#667085]">
                  {t("presentation.shortcuts.description")}
                </DialogDescription>
              </div>
            </div>
            <div
              aria-label={t("presentation.shortcuts.platformAria")}
              className="inline-flex w-fit shrink-0 rounded-[9px] border border-[#E1E3E9] bg-[#F6F6F9] p-1"
              role="group"
            >
              <PlatformButton
                active={!applePlatform}
                label={t("presentation.shortcuts.windowsLinux")}
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
                        {sectionTitle(section.id, t)}
                      </h3>
                    </div>
                    <p className="mt-1 text-[11px] leading-4 text-[#7A8295]">
                      {sectionDescription(section.id, t)}
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
                            {shortcutLabel(shortcut.id, t)}
                          </p>
                          <p className="mt-0.5 text-[11px] leading-4 text-[#7A8295]">
                            {shortcutDescription(shortcut.id, t)}
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
          {t("presentation.shortcuts.showingFor", {
            platform: applePlatform
              ? "macOS"
              : t("presentation.shortcuts.windowsLinux"),
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type Translator = ReturnType<typeof useT>;

function sectionTitle(id: EditorShortcutSection["id"], t: Translator) {
  switch (id) {
    case "selection": return t("presentation.shortcuts.sections.selection.title");
    case "editing": return t("presentation.shortcuts.sections.editing.title");
    case "arrange": return t("presentation.shortcuts.sections.arrange.title");
    case "navigation": return t("presentation.shortcuts.sections.navigation.title");
    case "help": return t("presentation.shortcuts.sections.help.title");
  }
}

function sectionDescription(id: EditorShortcutSection["id"], t: Translator) {
  switch (id) {
    case "selection": return t("presentation.shortcuts.sections.selection.description");
    case "editing": return t("presentation.shortcuts.sections.editing.description");
    case "arrange": return t("presentation.shortcuts.sections.arrange.description");
    case "navigation": return t("presentation.shortcuts.sections.navigation.description");
    case "help": return t("presentation.shortcuts.sections.help.description");
  }
}

const shortcutKeyById = {
  "multi-select": "multiSelect", group: "group", delete: "delete", undo: "undo",
  redo: "redo", copy: "copy", paste: "paste", "bring-forward": "bringForward",
  "bring-to-front": "bringToFront", "send-backward": "sendBackward",
  "send-to-back": "sendToBack", "previous-slide": "previousSlide",
  "next-slide": "nextSlide", "shortcut-help": "help",
} as const;

function shortcutLabel(id: keyof typeof shortcutKeyById, t: Translator) {
  const key = shortcutKeyById[id];
  const labels = {
    multiSelect: t("presentation.shortcuts.items.multiSelect.label"), group: t("presentation.shortcuts.items.group.label"), delete: t("presentation.shortcuts.items.delete.label"), undo: t("presentation.shortcuts.items.undo.label"), redo: t("presentation.shortcuts.items.redo.label"), copy: t("presentation.shortcuts.items.copy.label"), paste: t("presentation.shortcuts.items.paste.label"), bringForward: t("presentation.shortcuts.items.bringForward.label"), bringToFront: t("presentation.shortcuts.items.bringToFront.label"), sendBackward: t("presentation.shortcuts.items.sendBackward.label"), sendToBack: t("presentation.shortcuts.items.sendToBack.label"), previousSlide: t("presentation.shortcuts.items.previousSlide.label"), nextSlide: t("presentation.shortcuts.items.nextSlide.label"), help: t("presentation.shortcuts.items.help.label"),
  };
  return labels[key];
}

function shortcutDescription(id: keyof typeof shortcutKeyById, t: Translator) {
  const key = shortcutKeyById[id];
  const descriptions = {
    multiSelect: t("presentation.shortcuts.items.multiSelect.description"), group: t("presentation.shortcuts.items.group.description"), delete: t("presentation.shortcuts.items.delete.description"), undo: t("presentation.shortcuts.items.undo.description"), redo: t("presentation.shortcuts.items.redo.description"), copy: t("presentation.shortcuts.items.copy.description"), paste: t("presentation.shortcuts.items.paste.description"), bringForward: t("presentation.shortcuts.items.bringForward.description"), bringToFront: t("presentation.shortcuts.items.bringToFront.description"), sendBackward: t("presentation.shortcuts.items.sendBackward.description"), sendToBack: t("presentation.shortcuts.items.sendToBack.description"), previousSlide: t("presentation.shortcuts.items.previousSlide.description"), nextSlide: t("presentation.shortcuts.items.nextSlide.description"), help: t("presentation.shortcuts.items.help.description"),
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
