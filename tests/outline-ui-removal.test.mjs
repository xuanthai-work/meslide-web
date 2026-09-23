import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("chat exposes no manual outline mode", () => {
  for (const path of [
    "app/(presentation-generator)/presentation/components/chat/chat-types.ts",
    "app/(presentation-generator)/presentation/components/Chat.tsx",
    "app/(presentation-generator)/presentation/components/chat/ChatEditorLayout.tsx",
    "app/(presentation-generator)/presentation/components/chat/ChatPresentationLayout.tsx",
  ]) {
    assert.doesNotMatch(read(path), /isOutlineVariant|variant\s*[!=]==?\s*["']outline["']/);
  }
});
