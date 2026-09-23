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

test("outline route and manual editor files are removed", () => {
  for (const path of [
    "app/(presentation-generator)/outline/page.tsx",
    "app/(presentation-generator)/outline/components/OutlinePage.tsx",
    "app/(presentation-generator)/outline/components/OutlineContent.tsx",
    "app/(presentation-generator)/outline/components/OutlinePromptBar.tsx",
    "app/(presentation-generator)/outline/hooks/useOutlineManagement.ts",
    "app/(presentation-generator)/outline/hooks/usePresentationGeneration.ts",
    "app/(presentation-generator)/components/useStableOutlineIds.ts",
  ]) {
    assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), false, path);
  }
});

test("web client contains no outline navigation", () => {
  for (const path of [
    "app/(presentation-generator)/upload/components/UploadPage.tsx",
    "app/(presentation-generator)/documents-preview/components/DocumentPreviewPage.tsx",
    "app/(presentation-generator)/presentation/hooks/useAutomaticPresentationGeneration.ts",
    "app/(presentation-generator)/(dashboard)/dashboard/components/Header.tsx",
  ]) {
    assert.doesNotMatch(read(path), /["'`]\/outline(?:[?/'`"]|$)/, path);
  }
});
