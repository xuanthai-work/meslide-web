export function readChatStreamChunk(payload: { type?: unknown; chunk?: unknown }): string | null {
  if (payload.type !== "chunk" || typeof payload.chunk !== "string" || payload.chunk.length === 0) {
    return null;
  }
  return payload.chunk;
}
