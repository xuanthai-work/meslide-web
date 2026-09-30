"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { GSlideButton, GSlideInput, GSlideWordmark } from "@/components/gslide";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (!response.ok) {
        setError("Tên đăng nhập hoặc mật khẩu không đúng");
        return;
      }
      router.replace("/dashboard");
    } catch {
      setError("Tên đăng nhập hoặc mật khẩu không đúng");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--gslide-bg)] px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-[400px] rounded-2xl border border-[var(--gslide-border)] bg-[var(--gslide-card)] p-8 shadow-[0_12px_40px_rgba(16,19,35,0.06)]"
      >
        <GSlideWordmark className="mb-6 text-[28px]" />
        <h1 className="text-xl font-semibold text-[var(--gslide-ink)]">
          {"Đăng nhập"}
        </h1>
        <p className="mt-1 mb-6 text-sm text-[var(--gslide-muted)]">
          {"Đăng nhập để tiếp tục dùng GSlide"}
        </p>
        <label className="mb-2 block text-xs font-medium text-[var(--gslide-ink)]">
          {"Tên đăng nhập"}
        </label>
        <GSlideInput
          autoComplete="username"
          autoFocus
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
          minLength={3}
        />
        <label className="mt-4 mb-2 block text-xs font-medium text-[var(--gslide-ink)]">
          {"Mật khẩu"}
        </label>
        <GSlideInput
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={6}
        />
        {error ? (
          <p className="mt-3 text-sm text-[#C2410C]" role="alert">
            {error}
          </p>
        ) : null}
        <GSlideButton
          type="submit"
          fullWidth
          className="mt-6"
          disabled={submitting}
        >
          {submitting ? "Đang đăng nhập…" : "Đăng nhập"}
        </GSlideButton>
      </form>
    </main>
  );
}
