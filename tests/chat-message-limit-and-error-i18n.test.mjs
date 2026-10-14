import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");

registerHooks({
  resolve(specifier, context, nextResolve) {
    const tryCandidates = (base) => {
      for (const candidate of [
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.js`,
        `${base}/index.ts`,
      ]) {
        if (!existsSync(candidate)) continue;
        return {
          url: pathToFileURL(candidate).href,
          shortCircuit: true,
          format: "module-typescript",
        };
      }
      return null;
    };

    if (specifier.startsWith("@/")) {
      return (
        tryCandidates(path.join(root, specifier.slice(2))) ??
        nextResolve(specifier, context)
      );
    }
    return nextResolve(specifier, context);
  },
});

test("normalizeApiErrorDetail translates the message max_length error to Vietnamese", async () => {
  const { normalizeApiErrorDetail } = await import(
    "../utils/apiErrorMessages.ts"
  );

  const detail = [
    {
      type: "string_too_long",
      loc: ["body", "message"],
      msg: "String should have at most 16000 characters",
      input: "x".repeat(16001),
    },
  ];

  assert.equal(
    normalizeApiErrorDetail(detail),
    "Tin nhắn không được vượt quá 16.000 ký tự.",
  );
});

test("normalizeApiErrorDetail falls back to a generic limit message for other fields", async () => {
  const { normalizeApiErrorDetail } = await import(
    "../utils/apiErrorMessages.ts"
  );

  const detail = [
    {
      type: "string_too_long",
      loc: ["body", "prompt"],
      msg: "String should have at most 8000 characters",
    },
  ];

  assert.equal(
    normalizeApiErrorDetail(detail),
    "Nội dung không được vượt quá 8.000 ký tự.",
  );
});

test("extractApiErrorMessage returns the Vietnamese limit message, never the raw English one", async () => {
  const { extractApiErrorMessage } = await import(
    "../utils/apiErrorMessages.ts"
  );

  const message = extractApiErrorMessage(
    {
      detail: [
        {
          type: "string_too_long",
          loc: ["body", "message"],
          msg: "String should have at most 16000 characters",
        },
      ],
    },
    "Đã xảy ra lỗi.",
  );

  assert.equal(message, "Tin nhắn không được vượt quá 16.000 ký tự.");
  assert.doesNotMatch(message, /String should have at most/i);
});

test("Chat.tsx guards the 16.000 character limit and notifies in Vietnamese", () => {
  const source = readFileSync(
    path.join(
      root,
      "app/(presentation-generator)/presentation/components/Chat.tsx",
    ),
    "utf8",
  );

  assert.match(source, /MAX_CHAT_MESSAGE_LENGTH = 16000/);
  assert.match(source, /Tin nhắn không được vượt quá 16\.000 ký tự/);
  assert.match(source, /notify\.error\(\s*"Tin nhắn quá dài"/);
});

test("both chat layouts render the character counter", () => {
  for (const file of [
    "app/(presentation-generator)/presentation/components/chat/ChatPresentationLayout.tsx",
    "app/(presentation-generator)/presentation/components/chat/ChatEditorLayout.tsx",
  ]) {
    const source = readFileSync(path.join(root, file), "utf8");
    assert.match(source, /MAX_CHAT_MESSAGE_LENGTH = 16000/, file);
    assert.match(source, /\/ 16\.000/, file);
  }
});
