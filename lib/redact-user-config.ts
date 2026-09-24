export const CONFIGURED_SECRET_PLACEHOLDER = "__configured__";

const SECRET_FIELD = /(API_KEY|ACCESS_KEY|SECRET|TOKEN|PASSWORD)/i;

function redactedSecret(value: unknown): string {
  return value ? CONFIGURED_SECRET_PLACEHOLDER : "";
}

/** Replace secret fields before a config object is sent to the browser. */
export function redactUserConfigSecrets<T extends Record<string, unknown>>(
  config: T,
): T {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    redacted[key] = SECRET_FIELD.test(key) ? redactedSecret(value) : value;
  }
  return redacted as T;
}
