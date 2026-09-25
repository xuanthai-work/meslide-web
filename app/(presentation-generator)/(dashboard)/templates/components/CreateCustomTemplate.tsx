"use client";
/* eslint-disable @next/next/no-img-element */

import { Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/provider";

const CreateCustomTemplate = () => {
    const t = useT();
    const router = useRouter();

    const handleOpenTemplateBuilder = () => {
        router.push("/custom-template");
    };

    return (
        <div
            onClick={handleOpenTemplateBuilder}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleOpenTemplateBuilder();
                }
            }}
            role="button"
            tabIndex={0}
            className="w-full cursor-pointer overflow-hidden rounded-[28px] border border-[var(--gslide-border)] bg-white"
        >
            <div className="relative bg-white p-5">
                <img src="/card_bg.svg" alt="" className="absolute left-0 top-0 z-[1] h-full w-full object-cover" />
                <div className="relative z-[4] flex aspect-video w-full items-center justify-center">
                    <div className="flex h-[36px] w-[36px] items-center justify-center rounded-full bg-[var(--gslide-accent)]">
                        <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-white">
                            <Plus
                              strokeWidth={2}
                              className="h-4 w-4 text-[#A2A0A1]"
                            />
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-4 overflow-hidden border-t border-[#EDEEEF] bg-white px-5 py-4">
                <div className="flex h-[45px] w-[45px] items-center justify-center rounded-lg bg-[var(--gslide-accent)] p-2">
                    <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                    <h4 className="text-sm font-semibold tracking-[0.14px] text-[#191919]">
                      {t("templates.create.buildTemplate")}
                    </h4>
                    <p className="flex items-center gap-2 text-sm font-medium text-[#808080]">
                      {t("templates.create.buildYourOwnTemplate")}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CreateCustomTemplate;
