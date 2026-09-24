import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

function escapeGlob(path) {
  return path.replace(/[()[\]{}]/g, "\\$&");
}

// Current baseline only. Remove a path from these lists when that file is
// cleaned so the matching rule stays `error` for new and already-clean files.
// New files must not be added here to land violations.
//
// Remaining `@next/next/no-img-element` warnings are capped by
// `package.json` `lint` (`--max-warnings`). That ceiling only decreases.
const setStateInEffectAllowlist = [
  "app/(export)/pdf-maker/PdfMakerPage.tsx",
  "app/(presentation-generator)/(dashboard)/dashboard/components/DashboardPage.tsx",
  "app/(presentation-generator)/(dashboard)/templates/components/TemplatePanel.tsx",
  "app/(presentation-generator)/(dashboard)/theme/components/ThemePanel/index.tsx",
  "app/(presentation-generator)/components/ImageEditor.tsx",
  "app/(presentation-generator)/custom-template/CustomTemplatePage.tsx",
  "app/(presentation-generator)/documents-preview/components/DocumentPreviewPage.tsx",
  "app/(presentation-generator)/hooks/useTemplateDetails.ts",
  "app/(presentation-generator)/presentation/components/Chat.tsx",
  "app/(presentation-generator)/presentation/components/PresentationActions.tsx",
  "app/(presentation-generator)/presentation/components/PresentationMode.tsx",
  "app/(presentation-generator)/presentation/components/PresentationPage.tsx",
  "app/(presentation-generator)/presentation/components/chat/useChatSession.ts",
  "app/(presentation-generator)/presentation/hooks/useAutomaticPresentationGeneration.ts",
  "app/(presentation-generator)/presentation/hooks/usePresentationStreaming.ts",
  "app/(presentation-generator)/template-preview/components/TemplatePreviewClient.tsx",
  "app/(presentation-generator)/upload/components/ConfigurationSelects.tsx",
  "app/(presentation-generator)/upload/components/UploadPage.tsx",
  "app/ConfigurationInitializer.tsx",
  "app/hooks/useNearViewport.ts",
  "components/MarkDownRender.tsx",
  "components/slide-editor/charts/ChartEditorContent.tsx",
  "components/slide-editor/images/ImagePickerModal.tsx",
  "components/slide-editor/images/ImageToolbar.tsx",
  "components/slide-editor/layout/InfographicToolbarControls.tsx",
  "components/slide-editor/shapes/ShapeToolbar.tsx",
  "components/slide-editor/surface/TemplateV2KonvaSlide.tsx",
  "components/slide-editor/surface/fontLoading.ts",
  "components/slide-editor/surface/nodes-image.tsx",
  "components/slide-editor/surface/nodes.tsx",
  "components/slide-editor/tables/useTableCellSelection.ts",
  "components/slide-editor/text/TextToolbar.tsx",
  "components/slide-editor/toolbar/FloatingToolbar.tsx",
  "components/ui/overlay-loader.tsx",
];

const noExplicitAnyAllowlist = [
  "app/(export)/pdf-maker/PdfMakerPage.tsx",
  "app/(presentation-generator)/(dashboard)/dashboard/components/PresentationCard.tsx",
  "app/(presentation-generator)/(dashboard)/theme/components/ThemePanel/FontCard.tsx",
  "app/(presentation-generator)/(dashboard)/theme/components/ThemePanel/constants.ts",
  "app/(presentation-generator)/(dashboard)/theme/components/ThemePanel/index.tsx",
  "app/(presentation-generator)/_shared/blank-slide.ts",
  "app/(presentation-generator)/components/ImageEditor.tsx",
  "app/(presentation-generator)/components/PresentationRender.tsx",
  "app/(presentation-generator)/components/V1ContentRender.tsx",
  "app/(presentation-generator)/custom-template/types/index.ts",
  "app/(presentation-generator)/documents-preview/components/DocumentPreviewPage.tsx",
  "app/(presentation-generator)/hooks/use-keyboard-shortcut.ts",
  "app/(presentation-generator)/presentation/components/NewSlide.tsx",
  "app/(presentation-generator)/presentation/components/PresentationPage.tsx",
  "app/(presentation-generator)/presentation/components/SidePanel.tsx",
  "app/(presentation-generator)/presentation/components/SlideActionBar.tsx",
  "app/(presentation-generator)/presentation/components/SlideContent.tsx",
  "app/(presentation-generator)/presentation/components/SortableSlide.tsx",
  "app/(presentation-generator)/presentation/hooks/usePresentationNavigation.ts",
  "app/(presentation-generator)/presentation/hooks/usePresentationStreaming.ts",
  "app/(presentation-generator)/presentation/utils/autoSaveDiff.ts",
  "app/(presentation-generator)/presentation/utils/streamAssetMerge.ts",
  "app/(presentation-generator)/services/api/api-error-handler.ts",
  "app/(presentation-generator)/services/api/dashboard.ts",
  "app/(presentation-generator)/services/api/images.ts",
  "app/(presentation-generator)/services/api/presentation-generation.ts",
  "app/(presentation-generator)/services/api/theme.ts",
  "app/(presentation-generator)/services/api/types.ts",
  "app/(presentation-generator)/template-preview/types/index.ts",
  "app/(presentation-generator)/types/slide.ts",
  "app/(presentation-generator)/upload/components/AdvanceSettings.tsx",
  "app/(presentation-generator)/upload/components/ConfigurationSelects.tsx",
  "app/(presentation-generator)/upload/components/UploadPage.tsx",
  "app/(presentation-generator)/utils/others.ts",
  "components/slide-editor/layout/flowLayout.ts",
  "components/slide-editor/layout/layoutResize.ts",
  "components/slide-editor/layout/wrappedFlexLayout.ts",
  "components/slide-editor/model/core.ts",
  "components/slide-editor/model/template-v2-ungroup.ts",
  "components/slide-editor/tables/TemplateV2TableElement.tsx",
  "components/slide-editor/text/template-v2-text.ts",
  "store/slices/presentationGeneration.ts",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Preserve the existing lint baseline while moving off the removed `next lint` command.
    rules: {
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-non-null-asserted-optional-chain": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@next/next/no-assign-module-variable": "off",
      "prefer-const": "error",
      "react-hooks/immutability": "error",
      "react-hooks/preserve-manual-memoization": "error",
      "react-hooks/purity": "error",
      "react-hooks/set-state-in-effect": "error",
      "react-hooks/static-components": "error",
      "react-hooks/use-memo": "error",
      "react/jsx-key": "error",
      "react/no-unescaped-entities": "off",
    },
  },
  {
    files: setStateInEffectAllowlist.map(escapeGlob),
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: noExplicitAnyAllowlist.map(escapeGlob),
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  globalIgnores([
    ".next/**",
    ".next-build/**",
    ".cache/**",
    "out/**",
    "build/**",
    "cypress/**",
    "public/vendor/**",
    "next-env.d.ts",
    "**/*.cy.ts",
    "**/*.cy.tsx",
  ]),
]);

export default eslintConfig;
