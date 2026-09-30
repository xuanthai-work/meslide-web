"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {

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
            {"Đã có lỗi xảy ra"}
          </h1>
          <p style={{ fontSize: 16, color: "#4b5563", margin: 0 }}>
            {"Đã xảy ra lỗi không mong muốn. Vui lòng tải lại trang."}
          </p>
        </div>
      </body>
    </html>
  );
}