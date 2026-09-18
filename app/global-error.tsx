"use client";

import { useEffect } from "react";
import { useT } from "@/i18n/provider";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  const t = useT();

  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="vi">
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 24,
            fontFamily: "system-ui, sans-serif",
            color: "#1f2937",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
            {t("errors.global.title")}
          </h1>
          <p style={{ fontSize: 16, color: "#4b5563", margin: 0 }}>
            {t("errors.global.body")}
          </p>
        </div>
      </body>
    </html>
  );
}