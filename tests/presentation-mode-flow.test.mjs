import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the original Smart generation flow is retained behind a runtime feature gate", async () => {
  const uploadPage = await read(
    "app/(presentation-generator)/upload/components/UploadPage.tsx",
  );
  const configuration = await read(
    "app/(presentation-generator)/upload/components/ConfigurationSelects.tsx",
  );
  const dialog = await read(
    "app/(presentation-generator)/upload/components/GenerationModeDialog.tsx",
  );
  const featureFlags = await read("lib/feature-flags.ts");
  const serverFeatureFlags = await read("lib/server-feature-flags.ts");

  assert.match(featureFlags, /smartModeEnabled:\s*false/);
  assert.match(serverFeatureFlags, /getServerFeatureFlags/);
  assert.match(featureFlags, /GSLIDE_FEATURE_SMART_MODE/);
  assert.match(
    await read("app/(presentation-generator)/upload/generation-mode.ts"),
    /DEFAULT_GENERATION_MODE:\s*GenerationMode\s*=\s*"standard"/,
  );
  assert.match(uploadPage, /useState<GenerationMode>/);
  assert.match(uploadPage, /generation_mode:\s*generationMode/);
  assert.match(uploadPage, /type=smart/);
  assert.match(uploadPage, /auto:\s*"1"/);
  assert.match(configuration, /smartModeEnabled\s*&&\s*mode\s*&&\s*onModeChange/);
  assert.match(configuration, /<GenerationModeDialog/);
  assert.match(dialog, /Standard\.mp4/);
  assert.match(dialog, /Smart\.mp4/);
});

test("community surfaces are retained behind the dependent runtime feature gate", async () => {
  const featureFlags = await read("lib/feature-flags.ts");
  const sidebar = await read(
    "app/(presentation-generator)/(dashboard)/Components/DashboardSidebar.tsx",
  );
  const communityPage = await read(
    "app/(presentation-generator)/(dashboard)/community/page.tsx",
  );
  const uploadPage = await read(
    "app/(presentation-generator)/upload/components/UploadPage.tsx",
  );

  assert.match(featureFlags, /communityEnabled:\s*false/);
  assert.match(featureFlags, /GSLIDE_FEATURE_COMMUNITY/);
  assert.match(featureFlags, /communityEnabled:[\s\S]*smartModeEnabled\s*&&/);
  assert.match(sidebar, /communityEnabled\s*&&/);
  assert.match(communityPage, /getServerFeatureFlags\(\)\.communityEnabled/);
  assert.match(communityPage, /redirect\("\/dashboard"\)/);
  assert.match(
    uploadPage,
    /smartModeEnabled\s*&&\s*communityEnabled/,
  );
});

test("element selection is always enabled after generation without a toggle", async () => {
  const header = await read(
    "app/(presentation-generator)/presentation/components/PresentationHeader.tsx",
  );
  const smartEditor = await read(
    "app/(presentation-generator)/components/SmartHtmlEditor.tsx",
  );
  const canvasEditor = await read(
    "components/slide-editor/surface/TemplateV2KonvaSlide.tsx",
  );
  const canvasOverlays = await read(
    "components/slide-editor/surface/TemplateV2KonvaOverlays.tsx",
  );

  assert.match(header, /setEnableHtmlSelector\(!isStreaming\)/);
  assert.doesNotMatch(header, /data-testid="html-selector-btn"/);
  assert.doesNotMatch(header, /toggleHtmlSelector/);
  assert.doesNotMatch(header, /html-selector-mode/);
  assert.doesNotMatch(header, /switchPresentationMode/);
  assert.doesNotMatch(header, /setPresentationGenerationMode/);
  assert.doesNotMatch(header, /const nextMode/);
  assert.doesNotMatch(
    header,
    /generationMode === "smart" && !isStreaming/,
  );
  assert.doesNotMatch(header, /data-testid="presentation-mode-switch"/);
  assert.doesNotMatch(header, /handleModeSwitch/);
  assert.match(smartEditor, /<SmartHtmlSelectionOverlay/);
  assert.match(smartEditor, /hoverRect=\{hoverRect\}/);
  assert.match(canvasOverlays, /<SmartHtmlSelectionOverlay/);
  assert.doesNotMatch(canvasEditor, /isEditMode = isEditMode && selectorEnabled/);
  assert.doesNotMatch(canvasEditor, /fill="rgba\(122, 90, 248/);
  assert.doesNotMatch(canvasOverlays, /fill="rgba\(122, 90, 248/);
});
