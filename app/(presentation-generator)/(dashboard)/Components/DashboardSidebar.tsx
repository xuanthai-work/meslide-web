"use client";

import { LayoutDashboard, LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

import { GSlideSidebar, gslideNavActiveClass, gslideNavIdleClass } from "@/components/gslide";
import { useT } from "@/i18n/provider";

const DashboardSidebar = () => {
    const pathname = usePathname();
    const router = useRouter();
    const t = useT();

    const onLogout = async () => {
        await fetch("/api/v1/auth/logout", {
            method: "POST",
            credentials: "include",
        });
        router.replace("/login");
        router.refresh();
    };

    return (
        <GSlideSidebar
            footer={
                <div className="border-t border-[var(--gslide-border)] pt-5">
                    <button
                        type="button"
                        onClick={onLogout}
                        className="flex w-full flex-col items-center gap-2 transition-colors"
                        aria-label={t("nav.logout")}
                    >
                        <LogOut className={`h-4 w-4 ${gslideNavIdleClass}`} />
                        <span className={`text-[11px] ${gslideNavIdleClass}`}>{t("nav.logout")}</span>
                    </button>
                </div>
            }
        >
            <div className="space-y-6">

                {/* Dashboard */}
                <Link
                    prefetch={false}
                    href={`/dashboard`}
                    className={[
                        "flex flex-col tex-center items-center gap-2 transition-colors",
                        pathname === "/dashboard" ? "" : "ring-transparent",
                    ].join(" ")}
                    aria-label={t("nav.dashboard")}
                    title={t("nav.dashboard")}
                >
                    <LayoutDashboard className={["h-4 w-4", pathname === "/dashboard" ? gslideNavActiveClass : gslideNavIdleClass].join(" ")} />
                    <span className={["text-[11px]", pathname === "/dashboard" ? gslideNavActiveClass : "text-[var(--gslide-ink)]"].join(" ")}>{t("nav.dashboard")}</span>
                </Link>
                <Link
                    prefetch={false}
                    href={`/templates`}
                    className={[
                        "flex flex-col tex-center items-center gap-2 transition-colors",
                        pathname === "/templates" ? "" : "ring-transparent",
                    ].join(" ")}
                    aria-label={t("nav.templates")}
                    title={t("nav.templates")}
                >
                    <div className="flex flex-col cursor-pointer tex-center items-center gap-2 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={`${pathname === "/templates" ? "var(--gslide-accent)" : "var(--gslide-muted)"}`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M4 14h6" /><path d="M4 2h10" /><rect x="4" y="18" width="16" height="4" rx="1" /><rect x="4" y="6" width="16" height="4" rx="1" /></svg>
                        <span className={["text-[11px]", pathname === "/templates" ? gslideNavActiveClass : "text-[var(--gslide-ink)]"].join(" ")}>{t("nav.templates")}</span>
                    </div>
                </Link>
            </div>
        </GSlideSidebar>
    );
};

export default DashboardSidebar;
