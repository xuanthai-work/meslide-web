import React from "react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import UploadPage from "../../app/(presentation-generator)/upload/components/UploadPage";
import { FeatureFlagsProvider } from "../../components/FeatureFlagsProvider";
import { I18nProvider } from "../../i18n/provider";
import presentationGenerationReducer from "../../store/slices/presentationGeneration";
import pptGenUploadReducer from "../../store/slices/presentationGenUpload";
import userConfigReducer from "../../store/slices/userConfig";
import undoRedoReducer from "../../store/slices/undoRedoSlice";

const templates = [
  { id: "momentum", name: "Momentum", is_default: true, layout_count: 3 },
  { id: "executive", name: "Executive", is_default: true, layout_count: 3 },
  { id: "editorial", name: "Editorial", is_default: true, layout_count: 3 },
  { id: "modern", name: "Modern", is_default: true, layout_count: 3 },
];

const response = (items: typeof templates) => ({ items, total: items.length, page: 1, page_size: 100 });

const mountUpload = () => {
  const router = {
    back: cy.stub(),
    forward: cy.stub(),
    refresh: cy.stub(),
    push: cy.stub().as("routerPush"),
    replace: cy.stub(),
    prefetch: cy.stub(),
  };
  const store = configureStore({
    reducer: {
      presentationGeneration: presentationGenerationReducer,
      pptGenUpload: pptGenUploadReducer,
      userConfig: userConfigReducer,
      undoRedo: undoRedoReducer,
    },
  });

  cy.mount(
    <AppRouterContext.Provider value={router}>
      <FeatureFlagsProvider value={{ documentAwareRewrite: false }}>
        <Provider store={store}>
          <I18nProvider locale="vi-VN">
            <UploadPage />
          </I18nProvider>
        </Provider>
      </FeatureFlagsProvider>
    </AppRouterContext.Provider>,
  );
};

describe("template selection on upload", () => {
  it("defaults to the first template and sends it into automatic generation", () => {
    cy.intercept("GET", "**/api/v1/ppt/template/all?*", (request) => {
      const isDefault = new URL(request.url).searchParams.get("default") === "true";
      request.reply({ body: response(isDefault ? templates : []) });
    });
    cy.intercept("POST", "**/api/v1/ppt/presentation/create", { body: { id: "presentation-123" } });

    mountUpload();
    cy.get('[data-testid="upload-template-trigger"]').should("contain", "Bứt phá");
    cy.get('[data-testid="generate-presentation-button"]').should("be.disabled");
    cy.get('[data-testid="prompt-input"]').type("Ý tưởng cho slide");
    cy.intercept("POST", "**/api/v1/ppt/prompt/rewrite", { body: { rewritten_prompt: "Prompt đã tối ưu" } });
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.get('[data-testid="generate-presentation-button"]').should("be.enabled").click();
    cy.get("@routerPush").should("have.been.calledWith", "/presentation?id=presentation-123&auto=1&template=momentum");
  });

  it("navigates the cover flow by keyboard and chooses a different template", () => {
    cy.intercept("GET", "**/api/v1/ppt/template/all?*", (request) => {
      const isDefault = new URL(request.url).searchParams.get("default") === "true";
      request.reply({ body: response(isDefault ? templates : []) });
    });
    mountUpload();
    cy.get('[data-testid="upload-template-trigger"]').click();
    cy.get('[role="dialog"]').should("be.visible");
    cy.get('[data-testid="template-carousel"]').focus().trigger("keydown", { key: "ArrowRight" });
    cy.get('[data-testid="template-carousel"]').should("have.focus");
    cy.get('[data-testid="template-active-name"]').should("contain", "Điều hành").and("have.attr", "aria-live", "polite");
    cy.get('[data-testid="template-choose-button"]').click();
    cy.get('[role="dialog"]').should("not.exist");
    cy.get('[data-testid="upload-template-trigger"]').should("contain", "Điều hành");
    cy.intercept("POST", "**/api/v1/ppt/presentation/create", { body: { id: "presentation-custom" } });
    cy.intercept("POST", "**/api/v1/ppt/prompt/rewrite", { body: { rewritten_prompt: "Prompt đã tối ưu" } });
    cy.get('[data-testid="prompt-input"]').type("Báo cáo quý");
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.get('[data-testid="generate-presentation-button"]').should("be.enabled").click();
    cy.get("@routerPush").should("have.been.calledWith", "/presentation?id=presentation-custom&auto=1&template=executive");
  });

  it("can jump to a distant template from the rail", () => {
    cy.intercept("GET", "**/api/v1/ppt/template/all?*", (request) => {
      const isDefault = new URL(request.url).searchParams.get("default") === "true";
      request.reply({ body: response(isDefault ? templates : []) });
    });
    mountUpload();
    cy.get('[data-testid="upload-template-trigger"]').click();
    cy.get('[data-testid="template-rail-item-modern"]').click();
    cy.get('[data-testid="template-active-name"]').should("contain", "Hiện đại");
    cy.get('[data-testid="template-choose-button"]').click();
    cy.get('[data-testid="upload-template-trigger"]').should("contain", "Hiện đại");
  });

  it("previews a side card and closes without changing the choice on a wide screen", () => {
    cy.viewport(1280, 720);
    cy.intercept("GET", "**/api/v1/ppt/template/all?*", (request) => {
      const isDefault = new URL(request.url).searchParams.get("default") === "true";
      request.reply({ body: response(isDefault ? templates : []) });
    });
    mountUpload();
    cy.get('[data-testid="upload-template-trigger"]').invoke("text").should("include", "Bứt phá");
    cy.get('[data-testid="upload-template-trigger"]').click();
    cy.get('[data-testid="template-carousel"] button[aria-label="Xem mẫu Điều hành"]').click();
    cy.get('[data-testid="template-active-name"]').should("contain", "Điều hành");
    cy.get('[data-testid="template-rail-item-executive"]').should("have.attr", "aria-pressed", "true");
    cy.get('[data-testid="upload-template-trigger"]').should("contain", "Bứt phá");
    cy.get('[data-testid="template-carousel"]').focus().type("{esc}");
    cy.get('[role="dialog"]').should("not.exist");
    cy.get('[data-testid="upload-template-trigger"]').should("contain", "Bứt phá");
  });

  it("keeps Create blocked and retries when templates cannot load", () => {
    let fail = true;
    cy.intercept("GET", "**/api/v1/ppt/template/all?*", (request) => {
      if (fail) {
        request.reply({ statusCode: 500, body: {} });
      } else {
        const isDefault = new URL(request.url).searchParams.get("default") === "true";
        request.reply({ body: response(isDefault ? templates : []) });
      }
    });
    mountUpload();
    cy.get('[data-testid="upload-template-trigger"]').invoke("text").should("include", "Chọn mẫu");
    cy.get('input[type="file"]').selectFile({ contents: Cypress.Buffer.from("notes"), fileName: "notes.txt", mimeType: "text/plain" }, { force: true });
    cy.get('[data-testid="generate-presentation-button"]').should("be.disabled");
    cy.then(() => { fail = false; });
    cy.get('[data-testid="template-retry-button"]').click();
    cy.get('[data-testid="upload-template-trigger"]').should("contain", "Bứt phá");
    cy.get('[data-testid="generate-presentation-button"]').should("be.enabled");
  });

  it("blocks Create and offers retry when no templates exist", () => {
    cy.intercept("GET", "**/api/v1/ppt/template/all?*", { body: response([]) });
    mountUpload();
    cy.get('[data-testid="upload-template-trigger"]').should("contain", "Chọn mẫu");
    cy.get('[data-testid="upload-template-trigger"]').should("be.disabled");
    cy.get('[data-testid="template-retry-button"]').should("be.visible");
  });

  it("shows templates beyond the first API page", () => {
    const manyCustom = Array.from({ length: 101 }, (_, index) => ({
      id: `custom-${index + 1}`,
      name: `Custom ${index + 1}`,
      is_default: false,
      layout_count: 3,
    }));
    cy.intercept("GET", "**/api/v1/ppt/template/all?*", (request) => {
      const params = new URL(request.url).searchParams;
      const isDefault = params.get("default") === "true";
      const page = Number(params.get("page") ?? "1");
      const items = isDefault ? templates : manyCustom.slice((page - 1) * 100, page * 100);
      request.reply({ body: { ...response(items), total: isDefault ? templates.length : manyCustom.length, page } });
    });
    mountUpload();
    cy.get('[data-testid="upload-template-trigger"]').click();
    cy.get('[role="dialog"]').scrollTo("bottom");
    cy.get('[data-testid="template-rail-item-custom-101"]').scrollIntoView().click();
    cy.get('[data-testid="template-active-name"]').should("contain", "Custom 101");
  });

  it("keeps the picker usable on a narrow screen", () => {
    cy.viewport(375, 667);
    cy.intercept("GET", "**/api/v1/ppt/template/all?*", (request) => {
      const isDefault = new URL(request.url).searchParams.get("default") === "true";
      request.reply({ body: response(isDefault ? templates : []) });
    });
    mountUpload();
    cy.get('[data-testid="upload-template-trigger"]').click();
    cy.get('[data-testid="template-carousel"]')
      .trigger("touchstart", { touches: [{ clientX: 280 }] })
      .trigger("touchend", { changedTouches: [{ clientX: 100 }] });
    cy.get('[data-testid="template-active-name"]').should("contain", "Điều hành");
    cy.get('[data-testid="template-rail-item-modern"]').click();
    cy.get('[data-testid="template-choose-button"]').click();
    cy.get('[data-testid="upload-template-trigger"]').should("contain", "Hiện đại");
  });
});
