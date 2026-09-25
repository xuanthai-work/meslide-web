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
  it("previews without confirmation until Choose is pressed", () => {
    cy.viewport(1280, 720);
    cy.intercept("GET", "**/api/v1/ppt/template/all?*", { body: response(templates) });
    mountUpload();
    cy.get('[data-testid="upload-template-trigger"]').should("contain", "Bứt phá").click();
    cy.get('[data-testid="template-rail-item-momentum"] .lucide-check').should("not.exist");
    cy.get('[data-testid="template-rail-item-executive"]').click();
    cy.get('[data-testid="template-rail-item-executive"] .lucide-check').should("not.exist");
    cy.get('[data-testid="template-carousel"]').focus().type("{esc}");
    cy.get('[data-testid="upload-template-trigger"]').should("contain", "Bứt phá").click();
    cy.get('[data-testid="template-rail-item-momentum"] .lucide-check').should("not.exist");
    cy.get('[data-testid="template-rail-item-executive"]').click();
    cy.get('[data-testid="template-choose-button"]').click();
    cy.get('[data-testid="upload-template-trigger"]').click();
    cy.get('[data-testid="template-rail-item-executive"] .lucide-check').should("exist");
  });

  it("confirms the initial preview when Choose is pressed", () => {
    cy.viewport(1280, 720);
    cy.intercept("GET", "**/api/v1/ppt/template/all?*", { body: response(templates) });
    mountUpload();
    cy.get('[data-testid="upload-template-trigger"]').click();
    cy.get('[data-testid="template-choose-button"]').click();
    cy.get('[data-testid="upload-template-trigger"]').click();
    cy.get('[data-testid="template-rail-item-momentum"] .lucide-check').should("exist");
  });

  it("recommends a template when the first preview is not confirmed", () => {
    cy.intercept("GET", "**/api/v1/ppt/template/all?*", (request) => {
      const isDefault = new URL(request.url).searchParams.get("default") === "true";
      request.reply({ body: response(isDefault ? templates : []) });
    });
    cy.intercept("POST", "**/api/v1/ppt/presentation/create", { body: { id: "presentation-123" } });
    cy.intercept("POST", "**/api/v1/ppt/prompt/select-template", (request) => {
      expect(request.body.prompt).to.equal("Prompt đã tối ưu");
      expect(request.body.candidate_ids).to.deep.equal(["momentum", "executive", "editorial", "modern"]);
      request.reply({ body: { template_id: "executive" } });
    }).as("recommendTemplate");

    mountUpload();
    cy.get('[data-testid="upload-template-trigger"]').should("contain", "Bứt phá");
    cy.get('[data-testid="generate-presentation-button"]').should("be.disabled");
    cy.get('[data-testid="prompt-input"]').type("Ý tưởng cho slide");
    cy.intercept("POST", "**/api/v1/ppt/prompt/rewrite", { body: { rewritten_prompt: "Prompt đã tối ưu" } });
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.get('[data-testid="generate-presentation-button"]').should("be.enabled").click();
    cy.wait("@recommendTemplate");
    cy.get("@routerPush").should("have.been.calledWith", "/presentation?id=presentation-123&auto=1&template=executive");
  });

  it("uses the edited final brief to recommend a template", () => {
    cy.intercept("GET", "**/api/v1/ppt/template/all?*", { body: response(templates) });
    cy.intercept("POST", "**/api/v1/ppt/prompt/rewrite", { body: { rewritten_prompt: "First draft" } });
    cy.intercept("POST", "**/api/v1/ppt/prompt/select-template", (request) => {
      expect(request.body.prompt).to.equal("Final board update for directors");
      request.reply({ body: { template_id: "executive" } });
    }).as("recommendTemplate");
    cy.intercept("POST", "**/api/v1/ppt/presentation/create", (request) => {
      expect(request.body.content).to.equal("Final board update for directors");
      request.reply({ body: { id: "deck-1" } });
    });
    mountUpload();
    cy.get('[data-testid="prompt-input"]').type("Board update");
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.get('[data-testid="rewritten-prompt-output"]').clear().type("Final board update for directors");
    cy.get('[data-testid="generate-presentation-button"]').click();
    cy.wait("@recommendTemplate");
    cy.get("@routerPush").should("have.been.calledWith", "/presentation?id=deck-1&auto=1&template=executive");
  });

  it("skips recommendation after confirming the initial preview", () => {
    let recommendations = 0;
    cy.intercept("GET", "**/api/v1/ppt/template/all?*", { body: response(templates) });
    cy.intercept("POST", "**/api/v1/ppt/prompt/select-template", (request) => {
      recommendations += 1;
      request.reply({ body: { template_id: "executive" } });
    });
    cy.intercept("POST", "**/api/v1/ppt/prompt/rewrite", { body: { rewritten_prompt: "Board update" } });
    cy.intercept("POST", "**/api/v1/ppt/presentation/create", { body: { id: "manual-deck" } });
    mountUpload();
    cy.get('[data-testid="upload-template-trigger"]').click();
    cy.get('[data-testid="template-choose-button"]').click();
    cy.get('[data-testid="prompt-input"]').type("Board update");
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.get('[data-testid="generate-presentation-button"]').click();
    cy.get("@routerPush").should("have.been.calledWith", "/presentation?id=manual-deck&auto=1&template=momentum");
    cy.then(() => expect(recommendations).to.equal(0));
  });

  it("uses a fallback without recommendation for document-only creation", () => {
    let recommendations = 0;
    cy.intercept("GET", "**/api/v1/ppt/template/all?*", { body: response(templates) });
    cy.intercept("POST", "**/api/v1/ppt/prompt/select-template", (request) => {
      recommendations += 1;
      request.reply({ body: { template_id: "executive" } });
    });
    cy.intercept("POST", "**/api/v1/ppt/files/upload", { body: ["tmp-notes.txt"] });
    cy.intercept("POST", "**/api/v1/ppt/files/decompose", {
      body: [{ name: "notes.txt", file_path: "tmp-notes-decomposed.txt" }],
    });
    cy.intercept("POST", "**/api/v1/ppt/presentation/create", { body: { id: "document-deck" } });
    mountUpload();
    cy.get('[data-testid="file-upload-input"]').selectFile({
      contents: Cypress.Buffer.from("notes"), fileName: "notes.txt", mimeType: "text/plain",
    }, { force: true });
    cy.get('[data-testid="generate-presentation-button"]').click();
    cy.get("@routerPush").should("have.been.calledWith", "/presentation?id=document-deck&auto=1&template=momentum");
    cy.then(() => expect(recommendations).to.equal(0));
  });

  for (const recommendation of [
    { statusCode: 200, body: { template_id: "personal" } },
    { statusCode: 200, body: {} },
    { statusCode: 503, body: {} },
  ]) {
    it(`uses General for an unusable recommendation (${recommendation.statusCode}, ${JSON.stringify(recommendation.body)})`, () => {
      const withGeneral = [...templates, { id: "general", name: "General", is_default: true, layout_count: 3 }];
      cy.intercept("GET", "**/api/v1/ppt/template/all?*", { body: response(withGeneral) });
      cy.intercept("POST", "**/api/v1/ppt/prompt/rewrite", { body: { rewritten_prompt: "Simple overview" } });
      cy.intercept("POST", "**/api/v1/ppt/prompt/select-template", recommendation);
      cy.intercept("POST", "**/api/v1/ppt/presentation/create", { body: { id: "fallback-deck" } });
      mountUpload();
      cy.get('[data-testid="prompt-input"]').type("Simple overview");
      cy.get('[data-testid="rewrite-action-button"]').click();
      cy.get('[data-testid="generate-presentation-button"]').click();
      cy.get("@routerPush").should("have.been.calledWith", "/presentation?id=fallback-deck&auto=1&template=general");
    });
  }

  it("uses the first fallback when General is unavailable", () => {
    cy.intercept("GET", "**/api/v1/ppt/template/all?*", { body: response(templates) });
    cy.intercept("POST", "**/api/v1/ppt/prompt/rewrite", { body: { rewritten_prompt: "Project update" } });
    cy.intercept("POST", "**/api/v1/ppt/prompt/select-template", { statusCode: 503, body: {} });
    cy.intercept("POST", "**/api/v1/ppt/presentation/create", { body: { id: "first-fallback" } });
    mountUpload();
    cy.get('[data-testid="prompt-input"]').type("Project update");
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.get('[data-testid="generate-presentation-button"]').click();
    cy.get("@routerPush").should("have.been.calledWith", "/presentation?id=first-fallback&auto=1&template=momentum");
  });

  it("keeps one creation and the clicked prompt while recommendation is pending", () => {
    let recommendations = 0;
    let creations = 0;
    cy.intercept("GET", "**/api/v1/ppt/template/all?*", { body: response(templates) });
    cy.intercept("POST", "**/api/v1/ppt/prompt/rewrite", { body: { rewritten_prompt: "Clicked brief" } });
    cy.intercept("POST", "**/api/v1/ppt/prompt/select-template", (request) => {
      recommendations += 1;
      expect(request.body.prompt).to.equal("Clicked brief");
      request.reply({ delay: 300, body: { template_id: "executive" } });
    });
    cy.intercept("POST", "**/api/v1/ppt/presentation/create", (request) => {
      creations += 1;
      expect(request.body.content).to.equal("Clicked brief");
      request.reply({ body: { id: "snapshot-deck" } });
    });
    mountUpload();
    cy.get('[data-testid="prompt-input"]').type("Initial prompt");
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.get('[data-testid="generate-presentation-button"]').click();
    cy.get('[data-testid="prompt-input"]').trigger("keydown", { key: "Enter", ctrlKey: true, force: true });
    cy.get('[data-testid="rewritten-prompt-output"]').clear({ force: true }).type("Later edit", { force: true });
    cy.get("@routerPush").should("have.been.calledWith", "/presentation?id=snapshot-deck&auto=1&template=executive");
    cy.then(() => { expect(recommendations).to.equal(1); expect(creations).to.equal(1); });
  });

  it("uses fallback for a long edited brief while preserving its content", () => {
    const longBrief = "x".repeat(8001);
    let recommendations = 0;
    cy.intercept("GET", "**/api/v1/ppt/template/all?*", { body: response(templates) });
    cy.intercept("POST", "**/api/v1/ppt/prompt/rewrite", { body: { rewritten_prompt: "Draft" } });
    cy.intercept("POST", "**/api/v1/ppt/prompt/select-template", (request) => {
      recommendations += 1;
      request.reply({ body: { template_id: "executive" } });
    });
    cy.intercept("POST", "**/api/v1/ppt/presentation/create", (request) => {
      expect(request.body.content).to.equal(longBrief);
      request.reply({ body: { id: "long-deck" } });
    });
    mountUpload();
    cy.get('[data-testid="prompt-input"]').type("Initial prompt");
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.get('[data-testid="rewritten-prompt-output"]').clear().type(longBrief, { delay: 0, parseSpecialCharSequences: false });
    cy.get('[data-testid="generate-presentation-button"]').click();
    cy.get("@routerPush").should("have.been.calledWith", "/presentation?id=long-deck&auto=1&template=momentum");
    cy.then(() => expect(recommendations).to.equal(0));
  });

  it("previews by keyboard and chooses a different template", () => {
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

  it("previews on hover and closes without changing the choice on a wide screen", () => {
    cy.viewport(1280, 720);
    cy.intercept("GET", "**/api/v1/ppt/template/all?*", (request) => {
      const isDefault = new URL(request.url).searchParams.get("default") === "true";
      request.reply({ body: response(isDefault ? templates : []) });
    });
    mountUpload();
    cy.get('[data-testid="upload-template-trigger"]').invoke("text").should("include", "Bứt phá");
    cy.get('[data-testid="upload-template-trigger"]').click();
    cy.get('[data-testid="template-main-preview"]').should("be.visible");
    cy.get('[role="dialog"] button[aria-label="Mẫu trước"]').should("not.exist");
    cy.get('[role="dialog"] button[aria-label="Mẫu tiếp theo"]').should("not.exist");
    cy.get('[data-testid="template-rail-item-executive"]').trigger("mouseover");
    cy.get('[data-testid="template-active-name"]').should("contain", "Điều hành");
    cy.get('[data-testid="template-rail-item-executive"]').should("have.attr", "aria-pressed", "true");
    cy.get('[data-testid="template-rail-item-modern"]').focus();
    cy.get('[data-testid="template-active-name"]').should("contain", "Hiện đại");
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

  it("shows built-in templates beyond the first API page", () => {
    const manyBuiltIn = Array.from({ length: 101 }, (_, index) => ({
      id: `built-in-${index + 1}`,
      name: `Built-in ${index + 1}`,
      is_default: true,
      layout_count: 3,
    }));
    cy.intercept("GET", "**/api/v1/ppt/template/all?*", (request) => {
      const params = new URL(request.url).searchParams;
      const isDefault = params.get("default") === "true";
      const page = Number(params.get("page") ?? "1");
      const items = isDefault ? manyBuiltIn.slice((page - 1) * 100, page * 100) : [];
      request.reply({ body: { ...response(items), total: isDefault ? manyBuiltIn.length : 0, page } });
    });
    mountUpload();
    cy.get('[data-testid="upload-template-trigger"]').click();
    cy.get('[role="dialog"]').scrollTo("bottom");
    cy.get('[data-testid="template-rail-item-built-in-101"]').scrollIntoView().click();
    cy.get('[data-testid="template-active-name"]').should("contain", "Built-in 101");
  });

  it("does not offer personal templates", () => {
    cy.intercept("GET", "**/api/v1/ppt/template/all?*", (request) => {
      request.reply({ body: response([
        ...templates,
        { id: "personal", name: "Personal", is_default: false, layout_count: 3 },
      ]) });
    });
    mountUpload();
    cy.get('[data-testid="upload-template-trigger"]').click();
    cy.get('[data-testid="template-rail-item-personal"]').should("not.exist");
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
