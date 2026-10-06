"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import { GSlideButton, GSlideInput, GSlideWordmark } from "@/components/gslide";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "register";

function PasswordField({
  value,
  onChange,
  autoComplete,
  placeholder,
  visible,
  onToggleVisibility,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  placeholder: string;
  visible: boolean;
  onToggleVisibility: () => void;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <GSlideInput
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        minLength={6}
        placeholder={placeholder}
        className="block pr-11"
      />
      <button
        type="button"
        onClick={onToggleVisibility}
        aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-1.5 my-auto flex h-8 w-8 items-center justify-center rounded-lg text-[var(--gslide-muted)] transition-colors hover:bg-[var(--gslide-bg)] hover:text-[var(--gslide-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gslide-accent)]"
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Eye className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError("Vui lòng nhập tên đăng nhập");
      return;
    }

    if (mode === "register") {
      if (password.length < 6) {
        setError("Mật khẩu phải có ít nhất 6 ký tự");
        return;
      }
      if (password !== confirmPassword) {
        setError("Mật khẩu xác nhận không khớp");
        return;
      }
    }

    setSubmitting(true);
    try {
      const endpoint =
        mode === "login" ? "/api/v1/auth/login" : "/api/v1/auth/register";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: trimmedUsername,
          password,
        }),
      });

      if (!response.ok) {
        let errorMessage =
          mode === "login"
            ? "Tên đăng nhập hoặc mật khẩu không đúng"
            : "Không thể đăng ký tài khoản. Vui lòng thử lại.";
        try {
          const data = await response.json();
          if (data?.detail && typeof data.detail === "string") {
            errorMessage = data.detail;
          }
        } catch {
          // Dùng thông báo mặc định nếu không đọc được body json
        }
        setError(errorMessage);
        return;
      }

      // Đăng nhập / Đăng ký thành công -> vào thẳng dashboard
      router.replace("/dashboard");
    } catch {
      setError(
        mode === "login"
          ? "Tên đăng nhập hoặc mật khẩu không đúng"
          : "Đã có lỗi xảy ra khi kết nối đến máy chủ. Vui lòng thử lại."
      );
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

        {/* Tab chuyển đổi chế độ */}
        <div className="mb-6 flex rounded-xl border border-[var(--gslide-border)] bg-[var(--gslide-bg)] p-1">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={cn(
              "flex-1 rounded-lg py-2 text-xs font-semibold transition-all",
              mode === "login"
                ? "bg-white text-[var(--gslide-ink)] shadow-sm"
                : "text-[var(--gslide-muted)] hover:text-[var(--gslide-ink)]"
            )}
          >
            {"Đăng nhập"}
          </button>
          <button
            type="button"
            onClick={() => switchMode("register")}
            className={cn(
              "flex-1 rounded-lg py-2 text-xs font-semibold transition-all",
              mode === "register"
                ? "bg-white text-[var(--gslide-ink)] shadow-sm"
                : "text-[var(--gslide-muted)] hover:text-[var(--gslide-ink)]"
            )}
          >
            {"Đăng ký"}
          </button>
        </div>

        <h1 className="text-xl font-semibold text-[var(--gslide-ink)]">
          {mode === "login" ? "Đăng nhập" : "Đăng ký tài khoản"}
        </h1>
        <p className="mt-1 mb-6 text-sm text-[var(--gslide-muted)]">
          {mode === "login"
            ? "Đăng nhập để tiếp tục dùng GSlide"
            : "Tạo tài khoản mới để bắt đầu sử dụng GSlide"}
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
          placeholder="Nhập tên đăng nhập"
        />

        <label className="mt-4 mb-2 block text-xs font-medium text-[var(--gslide-ink)]">
          {"Mật khẩu"}
        </label>
        <PasswordField
          value={password}
          onChange={setPassword}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          placeholder="Tối thiểu 6 ký tự"
          visible={showPassword}
          onToggleVisibility={() => setShowPassword((current) => !current)}
        />

        {mode === "register" && (
          <>
            <label className="mt-4 mb-2 block text-xs font-medium text-[var(--gslide-ink)]">
              {"Xác nhận mật khẩu"}
            </label>
            <PasswordField
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu"
              visible={showConfirmPassword}
              onToggleVisibility={() =>
                setShowConfirmPassword((current) => !current)
              }
            />
          </>
        )}

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
          {submitting
            ? mode === "login"
              ? "Đang đăng nhập…"
              : "Đang đăng ký…"
            : mode === "login"
            ? "Đăng nhập"
            : "Đăng ký ngay"}
        </GSlideButton>

        <div className="mt-5 text-center">
          {mode === "login" ? (
            <p className="text-xs text-[var(--gslide-muted)]">
              {"Chưa có tài khoản? "}
              <button
                type="button"
                onClick={() => switchMode("register")}
                className="font-semibold text-[#1D6FE8] hover:underline"
              >
                {"Đăng ký ngay"}
              </button>
            </p>
          ) : (
            <p className="text-xs text-[var(--gslide-muted)]">
              {"Đã có tài khoản? "}
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="font-semibold text-[#1D6FE8] hover:underline"
              >
                {"Đăng nhập"}
              </button>
            </p>
          )}
        </div>
      </form>
    </main>
  );
}
