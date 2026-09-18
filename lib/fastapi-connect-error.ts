type NodeCause = {
  code?: string;
  address?: string;
  port?: number;
};

function getErrorCause(error: unknown): NodeCause | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("cause" in error && error.cause && typeof error.cause === "object") {
    return error.cause as NodeCause;
  }
  return error as NodeCause;
}

export function describeFastApiConnectError(error: unknown): string {
  const cause = getErrorCause(error);
  if (cause?.code) {
    const host =
      cause.address && cause.port != null ? ` ${cause.address}:${cause.port}` : "";
    return `${cause.code}${host}`;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

export function isRetryableFastApiConnectError(error: unknown): boolean {
  const code = getErrorCause(error)?.code;
  return (
    code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN"
  );
}
