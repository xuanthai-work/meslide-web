import React from "react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { ConfigurationSelects } from "../../app/(presentation-generator)/upload/components/ConfigurationSelects";
import UploadPage from "../../app/(presentation-generator)/upload/components/UploadPage";
import {
  LanguageType,
  ToneType,
  VerbosityType,
} from "../../app/(presentation-generator)/upload/type";
import { FeatureFlagsProvider } from "../../components/FeatureFlagsProvider";
import { I18nProvider } from "../../i18n/provider";
import presentationGenerationReducer from "../../store/slices/presentationGeneration";
import pptGenUploadReducer from "../../store/slices/presentationGenUpload";
import userConfigReducer from "../../store/slices/userConfig";
import undoRedoReducer from "../../store/slices/undoRedoSlice";
import { LLMConfig } from "../../types/llm_config";

const baseConfig = {
  slides: "8",
  language: LanguageType.Vietnamese,
  prompt: "",
  tone: ToneType.Default,
  verbosity: VerbosityType.Standard,
  instructions: "",
  includeTableOfContents: false,
  includeTitleSlide: false,
  webSearch: false,
};

const createTestStore = (llmConfig: LLMConfig = {}) =>
  configureStore({
    reducer: {
      presentationGeneration: presentationGenerationReducer,
      pptGenUpload: pptGenUploadReducer,
      userConfig: userConfigReducer,
      undoRedo: undoRedoReducer,
    },
    preloadedState: {
      userConfig: {
        llm_config: {
          LLM: "openai",
          IMAGE_PROVIDER: "gpt-image-1.5",
          WEB_GROUNDING: true,
          ...llmConfig,
        },
      },
    },
  });

const mountUploadPage = (llmConfig?: LLMConfig) => {
  const push = cy.stub().as("routerPush");
  const router = {
    back: cy.stub(),
    forward: cy.stub(),
    refresh: cy.stub(),
    push,
    replace: cy.stub(),
    prefetch: cy.stub(),
  };

  cy.mount(
    <AppRouterContext.Provider value={router}>
      <FeatureFlagsProvider
        value={{
          documentAwareRewrite: false,
        }}
      >
        <Provider store={createTestStore(llmConfig)}>
          <I18nProvider locale="vi-VN">
            <UploadPage />
          </I18nProvider>
        </Provider>
      </FeatureFlagsProvider>
    </AppRouterContext.Provider>,
  );
};

beforeEach(() => {
  cy.intercept("GET", "**/api/v1/ppt/template/all?*", (request) => {
    const isDefault = new URL(request.url).searchParams.get("default") === "true";
    request.reply({
      body: {
        items: isDefault ? [{ id: "momentum", name: "Momentum", is_default: true, layout_count: 3 }] : [],
        total: isDefault ? 1 : 0,
        page: 1,
        page_size: 100,
      },
    });
  });
});

describe("per-presentation web search toggle", () => {
  it("toggles web search from the upload config row", () => {
    const onConfigChange = cy.stub().as("onConfigChange");

    cy.mount(
      <I18nProvider locale="vi-VN">
        <ConfigurationSelects
          compact
          config={baseConfig}
          onConfigChange={onConfigChange}
        />
      </I18nProvider>,
    );

    cy.get('[data-testid="web-search-toggle"]')
      .should("have.attr", "aria-checked", "false")
      .click();
    cy.get("@onConfigChange").should(
      "have.been.calledOnceWith",
      "webSearch",
      true,
    );
  });

  it("starts web search on by default even when settings WEB_GROUNDING is off", () => {
    mountUploadPage({ WEB_GROUNDING: false });

    cy.get('[data-testid="web-search-toggle"]').should(
      "have.attr",
      "aria-checked",
      "true",
    );
    cy.contains("GPT Image 1.5").should("not.exist");
  });

  it("sends web_search true on create by default", () => {
    cy.intercept("POST", "**/api/v1/ppt/presentation/create", (request) => {
      expect(request.body.web_search).to.equal(true);
      request.reply({ body: { id: "presentation-web-search" } });
    }).as("createPresentation");

    mountUploadPage();

    cy.get('[data-testid="web-search-toggle"]').should(
      "have.attr",
      "aria-checked",
      "true",
    );
    cy.get('[data-testid="prompt-input"]').type("AI trong giáo dục");
    cy.get('[data-testid="generate-presentation-button"]').click();
    cy.wait("@createPresentation");
  });

});
