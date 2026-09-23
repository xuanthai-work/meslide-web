import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("community route and client are removed", () => {
  assert.equal(
    existsSync(
      new URL(
        "../app/(presentation-generator)/(dashboard)/community/page.tsx",
        import.meta.url,
      ),
    ),
    false,
  );
  assert.equal(
    existsSync(
      new URL(
        "../app/(presentation-generator)/services/api/community.ts",
        import.meta.url,
      ),
    ),
    false,
  );
});

test("only document-aware rewrite remains in feature flags", () => {
  const source = read("lib/feature-flags.ts");
  assert.match(source, /documentAwareRewrite/);
  assert.doesNotMatch(
    source,
    /smartModeEnabled|communityEnabled|GSLIDE_FEATURE_SMART_MODE|GSLIDE_FEATURE_COMMUNITY/,
  );
});

test("upload ignores retired query switches and creates Standard requests", () => {
  const upload = read(
    "app/(presentation-generator)/upload/components/UploadPage.tsx",
  );
  const api = read(
    "app/(presentation-generator)/services/api/presentation-generation.ts",
  );

  assert.doesNotMatch(
    upload,
    /params\.get\(["']mode["']\)|communityId|generationMode|communityReference|type=smart/,
  );
  assert.doesNotMatch(
    api,
    /generation_mode|community_design_ids|switchPresentationMode/,
  );
  assert.doesNotMatch(api, /version\s*[:=]\s*["']v2-standard["']/);
});

test("standard navigation and responses have no retired mode alias", () => {
  for (const path of [
    "app/(presentation-generator)/(dashboard)/dashboard/components/DashboardPage.tsx",
    "app/(presentation-generator)/presentation/hooks/useAutomaticPresentationGeneration.ts",
    "app/(presentation-generator)/services/api/presentation-generation.ts",
  ]) {
    assert.doesNotMatch(
      read(path),
      /type=standard|type:\s*["']standard["']/,
      path,
    );
  }
});

test("presentation state has no retired mode or Community fields", () => {
  const state = read("store/slices/presentationGeneration.ts");
  assert.doesNotMatch(
    state,
    /generation_mode|community_design_ids|setPresentationGenerationMode|updateSlideHtmlContent/,
  );
});

test("web chat no longer sends or stores presentation type", () => {
  for (const path of [
    "app/(presentation-generator)/services/api/chat.ts",
    "app/(presentation-generator)/presentation/components/chat/chat-types.ts",
    "app/(presentation-generator)/presentation/components/chat/chat-adapter.ts",
    "app/(presentation-generator)/presentation/components/chat/useChatSession.ts",
    "app/(presentation-generator)/presentation/components/Chat.tsx",
  ]) {
    assert.doesNotMatch(
      read(path),
      /presentation_type|presentationType|Smart HTML presentation/,
    );
  }
});

test("smart html renderer and stream event are removed", () => {
  assert.equal(
    existsSync(
      new URL(
        "../app/(presentation-generator)/components/SmartHtmlSlide.tsx",
        import.meta.url,
      ),
    ),
    false,
  );
  const stream = read(
    "app/(presentation-generator)/presentation/hooks/usePresentationStreaming.ts",
  );
  const lifecycle = read("lib/generation-lifecycle.ts");
  assert.doesNotMatch(stream, /slide_html|isSmartMode|html_content/);
  assert.doesNotMatch(lifecycle, /slide_html/);
});

test("template v2 keeps the shared selection overlay under a neutral name", () => {
  assert.equal(
    existsSync(
      new URL(
        "../app/(presentation-generator)/components/SmartHtmlSelectionOverlay.tsx",
        import.meta.url,
      ),
    ),
    false,
  );
  assert.equal(
    existsSync(
      new URL(
        "../app/(presentation-generator)/components/HtmlSelectionOverlay.tsx",
        import.meta.url,
      ),
    ),
    true,
  );
  const overlays = read("components/slide-editor/surface/TemplateV2KonvaOverlays.tsx");
  assert.match(overlays, /HtmlSelectionOverlay/);
  assert.doesNotMatch(overlays, /SmartHtmlSelectionOverlay|SmartSelectionRect/);
});

test("runtime localization contains no retired Smart or Community contracts", () => {
  for (const path of [
    "i18n/locales/en.ts",
    "i18n/locales/vi.ts",
    "i18n/backend-messages.ts",
  ]) {
    assert.doesNotMatch(
      read(path),
      /community|smart mode|reading_smart_deck_context/i,
    );
  }
});
