export interface ApiErrorResponse {
  detail?: unknown;
  message?: string;
  error?: unknown;
  error_code?: string;
  error_params?: Record<string, unknown>;
}

import {
  BACKEND_ERROR_MESSAGES,
  translateBackendError,
  type BackendErrorCode,
} from "@/lib/backend-messages";

const INVALID_API_KEY_MESSAGE =
  "Khóa API không hợp lệ. Vui lòng kiểm tra lại khóa API và thử lại.";
const SAFETY_BLOCK_MESSAGE =
  "Yêu cầu bị hệ thống an toàn của nhà cung cấp chặn. Vui lòng điều chỉnh và thử lại.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nestedMessage(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (!isRecord(value)) return null;

  for (const key of ["message", "detail", "error"]) {
    const nested = value[key];
    if (typeof nested === "string" && nested.trim()) {
      return nested;
    }
    const message = nestedMessage(nested);
    if (message) {
      return message;
    }
  }

  return null;
}

export function normalizeApiErrorDetail(detail: unknown): string | null {
  if (!detail) return null;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (isRecord(item)) {
          const maybeMsg = item.msg;
          const maybeLoc = item.loc;
          const locPath = Array.isArray(maybeLoc)
            ? maybeLoc
                .filter(
                  (value) =>
                    typeof value === "string" || typeof value === "number"
                )
                .join(".")
            : "";
          if (typeof maybeMsg === "string") {
            return locPath ? `${locPath}: ${maybeMsg}` : maybeMsg;
          }
          return nestedMessage(item);
        }
        return null;
      })
      .filter((value): value is string => Boolean(value));

    return parts.length ? parts.join("; ") : null;
  }

  if (isRecord(detail)) {
    return nestedMessage(detail);
  }

  return String(detail);
}

function looksLikeProviderAuthError(message: string, status?: number): boolean {
  const text = message.toLowerCase();
  return (
    /invalid[_\s-]*api[_\s-]*key/.test(text) ||
    /incorrect\s+api\s+key/.test(text) ||
    /api\s+key\s+(?:is\s+)?invalid/.test(text) ||
    text.includes("authentication_error") ||
    text.includes("invalid_api_key") ||
    Boolean(status === 401 && text.includes("api key"))
  );
}

function looksLikeSafetyBlock(message: string): boolean {
  const text = message.toLowerCase();
  return text.includes("moderation_blocked") || text.includes("safety system");
}

function looksLikeRawPayload(message: string): boolean {
  const text = message.trim();
  return (
    text.startsWith("{") ||
    text.startsWith("[") ||
    text.includes("{'error'") ||
    text.includes('"error"') ||
    text.includes("Error code:")
  );
}

export function sanitizeApiErrorMessage(
  message: string,
  fallbackMessage: string,
  status?: number
): string {
  const trimmed = message.trim();
  if (!trimmed) return fallbackMessage;

  if (looksLikeProviderAuthError(trimmed, status)) {
    return INVALID_API_KEY_MESSAGE;
  }
  if (looksLikeSafetyBlock(trimmed)) {
    return SAFETY_BLOCK_MESSAGE;
  }
  if (looksLikeRawPayload(trimmed)) {
    return fallbackMessage;
  }

  return trimmed;
}

export function extractApiErrorMessage(
  errorData: unknown,
  fallbackMessage: string,
  status?: number
): string {
  let message: string | null = null;

  if (isRecord(errorData)) {
    const apiError = errorData as ApiErrorResponse;
    if (
      typeof apiError.error_code === "string" &&
      apiError.error_code in BACKEND_ERROR_MESSAGES
    ) {
      return translateBackendError({
        detail: normalizeApiErrorDetail(apiError.detail) ?? undefined,
        error_code: apiError.error_code as BackendErrorCode,
        error_params: apiError.error_params,
      });
    }
    message =
      normalizeApiErrorDetail(apiError.detail) ||
      (typeof apiError.message === "string" ? apiError.message : null) ||
      normalizeApiErrorDetail(apiError.error);
  } else {
    message = normalizeApiErrorDetail(errorData);
  }

  return sanitizeApiErrorMessage(message || fallbackMessage, fallbackMessage, status);
}
