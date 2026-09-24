import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { readChatStreamChunk } from "../app/(presentation-generator)/services/api/chat-stream.ts";
import {
  buildChatDocumentAttachments,
  historyMessagesToChatMessages,
  trimAttachmentContent,
} from "../app/(presentation-generator)/presentation/components/chat/chat-utils.ts";

const root = path.resolve(import.meta.dirname, "..");

registerHooks({
  resolve(specifier, context, nextResolve) {
    const tryCandidates = (base) => {
      for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, `${base}/index.ts`]) {
        if (!existsSync(candidate)) continue;
        return {
          url: pathToFileURL(candidate).href,
          shortCircuit: true,
          format: candidate.endsWith(".mjs") ? "module" : "module-typescript",
        };
      }
      return null;
    };
    if (specifier.startsWith("@/")) {
      return tryCandidates(path.join(root, specifier.slice(2))) ?? nextResolve(specifier, context);
    }
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL &&
      !/\.[cm]?[jt]sx?$/.test(specifier)
    ) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      return tryCandidates(path.resolve(parentDir, specifier)) ?? nextResolve(specifier, context);
    }
    return nextResolve(specifier, context);
  },
});

test("chat chunks append text and empty frames are ignored", () => {
  assert.equal(readChatStreamChunk({ type: "chunk", chunk: "Hello" }), "Hello");
  assert.equal(readChatStreamChunk({ type: "chunk", chunk: "" }), null);
  assert.equal(readChatStreamChunk({ type: "trace", chunk: "nope" }), null);
  assert.equal(
    `${readChatStreamChunk({ type: "chunk", chunk: "Hel" })}${readChatStreamChunk({ type: "chunk", chunk: "lo" })}`,
    "Hello",
  );
});

test("follow mode stays on the edited slide and does not jump to a read", async () => {
  const { decideSlideFollow, isAbortError, stripBackendContextFromUserMessage } = await import(
    "../app/(presentation-generator)/presentation/components/chat/chat-activity.ts"
  );

  assert.equal(
    decideSlideFollow({
      trace: { tool: "getSlideAtIndex", status: "start", slideIndex: 3 },
      lastSignature: null,
      activeSlide: 0,
      elapsedMs: 5_000,
    }).action,
    "ignore",
  );
  assert.deepEqual(
    decideSlideFollow({
      trace: { tool: "updateSlide", status: "start", slideNumber: 2, round: 1 },
      lastSignature: null,
      activeSlide: null,
      elapsedMs: 0,
    }),
    { action: "focus-now", slideIndex: 1, signature: "1:updateSlide:start:1" },
  );
  const deferred = decideSlideFollow({
    trace: { tool: "updateSlide", status: "start", slideIndex: 4, round: 2 },
    lastSignature: null,
    activeSlide: 1,
    elapsedMs: 100,
  });
  assert.equal(deferred.action, "defer");
  assert.equal(deferred.waitMs, 600);
  assert.equal(
    decideSlideFollow({
      trace: { tool: "updateSlide", status: "start", slideIndex: 4, round: 2 },
      lastSignature: "2:updateSlide:start:4",
      activeSlide: 1,
      elapsedMs: 100,
    }).action,
    "ignore",
  );

  assert.equal(
    stripBackendContextFromUserMessage("UI context: deck\nUser message:  Hello"),
    "Hello",
  );
  assert.equal(isAbortError(new DOMException("The operation was aborted", "AbortError")), true);
  assert.equal(isAbortError(new Error("network down")), false);
});

test("old conversations strip the UI context from user messages", () => {
  const messages = historyMessagesToChatMessages([
    { role: "user", content: "UI context: x\nUser message: Keep this" },
    { role: "assistant", content: "Done" },
  ]);
  assert.equal(messages[0].content, "Keep this");
  assert.equal(messages[1].role, "assistant");
  assert.equal(messages[1].content, "Done");
});

test("document attachments keep the file path and long text is truncated", () => {
  assert.deepEqual(
    buildChatDocumentAttachments([
      { name: "notes.pdf", filePath: "/tmp/notes.pdf", mimeType: "application/pdf" },
    ]),
    [{
      type: "document",
      name: "notes.pdf",
      file_path: "/tmp/notes.pdf",
      mime_type: "application/pdf",
    }],
  );
  const long = "a".repeat(2001);
  const trimmed = trimAttachmentContent(long);
  assert.equal(trimmed.endsWith("[Attachment truncated]"), true);
  assert.equal(trimmed.startsWith("a".repeat(2000)), true);
});
