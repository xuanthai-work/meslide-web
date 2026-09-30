"use client";

import { LayoutDashboard, LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

import { GSlideSidebar, gslideNavActiveClass, gslideNavIdleClass } from "@/components/gslide";
import { APP_VERSION } from "@/lib/version";

const DashboardSidebar = () => {
    const pathname = usePathname();
    const router = useRouter();

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
                <div className="flex flex-col items-center">
                    <span
                        className="mb-2 text-[10px] font-medium tracking-tight text-[var(--gslide-muted)] select-none opacity-75"
                        title={`Phiên bản: ${APP_VERSION}`}
                    >
                        {APP_VERSION}
                    </span>
                    <div className="w-full border-t border-[var(--gslide-border)] pt-4">
                        <button
                            type="button"
                            onClick={onLogout}
                            className="flex w-full flex-col items-center gap-2 transition-colors"
                            aria-label={"Đăng xuất"}
                        >
                            <LogOut className={`h-4 w-4 ${gslideNavIdleClass}`} />
                            <span className={`text-[11px] ${gslideNavIdleClass}`}>{"Đăng xuất"}</span>
                        </button>
                    </div>
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
                    aria-label={"Trang chủ"}
                    title={"Trang chủ"}
                >
                    <LayoutDashboard className={["h-4 w-4", pathname === "/dashboard" ? gslideNavActiveClass : gslideNavIdleClass].join(" ")} />
                    <span className={["text-[11px]", pathname === "/dashboard" ? gslideNavActiveClass : "text-[var(--gslide-ink)]"].join(" ")}>{"Trang chủ"}</span>
                </Link>
                <Link
                    prefetch={false}
                    href={`/templates`}
                    className={[
                        "flex flex-col tex-center items-center gap-2 transition-colors",
                        pathname === "/templates" ? "" : "ring-transparent",
                    ].join(" ")}
                    aria-label={"Mẫu"}
                    title={"Mẫu"}
                >
                    <div className="flex flex-col cursor-pointer tex-center items-center gap-2 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={`${pathname === "/templates" ? "var(--gslide-accent)" : "var(--gslide-muted)"}`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M4 14h6" /><path d="M4 2h10" /><rect x="4" y="18" width="16" height="4" rx="1" /><rect x="4" y="6" width="16" height="4" rx="1" /></svg>
                        <span className={["text-[11px]", pathname === "/templates" ? gslideNavActiveClass : "text-[var(--gslide-ink)]"].join(" ")}>{"Mẫu"}</span>
                    </div>
                </Link>
            </div>
        </GSlideSidebar>
    );
};

export default DashboardSidebar;
