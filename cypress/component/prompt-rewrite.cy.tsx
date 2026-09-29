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

const createTestStore = () =>
  configureStore({
    reducer: {
      presentationGeneration: presentationGenerationReducer,
      pptGenUpload: pptGenUploadReducer,
      userConfig: userConfigReducer,
      undoRedo: undoRedoReducer,
    },
  });

const mountUploadPage = ({
  // Document-aware outline generation is gated behind a feature flag that
  // defaults to off; the doc-aware Cypress suite turns it on so the
  // assertions exercise the document paths.
  documentAwareRewrite = false,
}: {
  documentAwareRewrite?: boolean;
} = {}) => {
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
        value={{ documentAwareRewrite }}
      >
        <Provider store={createTestStore()}>
          <I18nProvider locale="vi-VN">
            <UploadPage />
          </I18nProvider>
        </Provider>
      </FeatureFlagsProvider>
    </AppRouterContext.Provider>,
  );
};

/** An outline that declares its own slide count, the way users paste one. */
const outlineWith = (count: number, separator = " - ") =>
  Array.from(
    { length: count },
    (_, index) => `## Slide ${index + 1}${separator}Nội dung ${index + 1}`,
  ).join("\n");

/** Cypress types `{enter}` for a newline; literal newlines are not accepted. */
const typeOutline = (text: string) =>
  cy.get('[data-testid="prompt-input"]').type(text.split("\n").join("{enter}"));

const typeIdea = (text: string) =>
  cy.get('[data-testid="idea-input"]').type(text);

const attachFile = (
  name: string,
  contents = "supporting notes",
  mimeType = "text/plain",
) =>
  cy
    .get('[data-testid="file-upload-input"]')
    .selectFile(
      { contents: Cypress.Buffer.from(contents), fileName: name, mimeType },
      { force: true },
    );

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
  // Template recommendation is a side quest; these tests are about content.
  cy.intercept("POST", "**/api/v1/ppt/prompt/select-template", {
    body: { template_id: "momentum" },
  }).as("recommendTemplate");
});

describe("upload outline composer", () => {
  it("writes the AI outline into box 2 and never overwrites the idea in box 1", () => {
    let outlineCalls = 0;
    cy.intercept("POST", "**/api/v1/ppt/prompt/rewrite", (request) => {
      outlineCalls += 1;
      if (outlineCalls === 1) {
        expect(request.body.previous_prompt, "first run has no prior outline")
          .to.equal(undefined);
        expect(request.body.prompt).to.equal("Bài cho dev iOS");
      } else {
        expect(request.body.prompt).to.equal("Bài cho dev Android");
        expect(
          request.body.previous_prompt,
          "a second run refines the current outline",
        ).to.equal("## Slide 1 - Mở đầu");
      }
      request.reply({
        delay: 750,
        body: {
          rewritten_prompt:
            outlineCalls === 1
              ? "## Slide 1 - Mở đầu"
              : "## Slide 1 - Mở đầu\n## Slide 2 - Kết luận",
        },
      });
    }).as("outlineRequest");

    mountUploadPage();

    // Nothing to build an outline from yet, and nothing to create from.
    cy.get('[data-testid="rewrite-action-button"]').should("be.disabled");
    cy.get('[data-testid="generate-presentation-button"]').should("be.disabled");

    // Typing an idea arms the AI action but never blocks Create: the user
    // is never forced through the AI.
    typeIdea("Bài cho dev iOS");
    cy.get('[data-testid="rewrite-action-button"]').should("be.enabled");
    cy.get('[data-testid="generate-presentation-button"]').should("be.disabled");

    cy.get('[data-testid="rewrite-action-button"]')
      .click()
      .should("have.attr", "aria-busy", "true")
      .and("contain.text", "Đang viết lại");
    cy.get('[data-testid="generate-presentation-button"]').should("be.disabled");

    cy.wait("@outlineRequest");
    cy.get('[data-testid="idea-input"]').should("have.value", "Bài cho dev iOS");
    cy.get('[data-testid="prompt-input"]')
      .should("have.value", "## Slide 1 - Mở đầu")
      .and("not.have.attr", "readonly");
    cy.get('[data-testid="generate-presentation-button"]').should("be.enabled");

    // A second run sends the current outline along and replaces it.
    cy.get('[data-testid="idea-input"]').clear().type("Bài cho dev Android");
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.wait("@outlineRequest");
    cy.get('[data-testid="prompt-input"]').should(
      "have.value",
      "## Slide 1 - Mở đầu\n## Slide 2 - Kết luận",
    );
    cy.get('[data-testid="idea-input"]').should("have.value", "Bài cho dev Android");
  });

  it("creates straight from box 2 without ever calling the AI", () => {
    cy.intercept("POST", "**/api/v1/ppt/prompt/rewrite", {
      body: { rewritten_prompt: "không được gọi" },
    }).as("outlineRequest");
    cy.intercept("POST", "**/api/v1/ppt/presentation/create", (request) => {
      expect(request.body.content).to.equal("Nội dung dán trực tiếp");
      request.reply({ body: { id: "presentation-123" } });
    }).as("createPresentation");

    mountUploadPage();
    cy.get('[data-testid="prompt-input"]').type("Nội dung dán trực tiếp");
    cy.get('[data-testid="generate-presentation-button"]').should("be.enabled").click();

    cy.wait("@createPresentation");
    cy.get("@outlineRequest.all").should("have.length", 0);
    cy.get("@routerPush").should(
      "have.been.calledWith",
      "/presentation?id=presentation-123&auto=1&template=momentum",
    );
  });

  it("submits box 2 with Ctrl+Enter and keeps Shift+Enter as a newline", () => {
    cy.intercept("POST", "**/api/v1/ppt/presentation/create", {
      body: { id: "presentation-123" },
    }).as("createPresentation");

    mountUploadPage();
    cy.get('[data-testid="prompt-input"]').type("Dòng 1");
    cy.get('[data-testid="prompt-input"]').type("{shift}{enter}dòng 2");
    cy.get('[data-testid="prompt-input"]').should("have.value", "Dòng 1\ndòng 2");
    cy.get("@createPresentation.all").should("have.length", 0);

    cy.get('[data-testid="prompt-input"]').type("{ctrl}{enter}");
    cy.wait("@createPresentation");
  });

  it("shows the slide count the outline declares without adding an opt-in control", () => {
    cy.intercept("POST", "**/api/v1/ppt/presentation/create", (request) => {
      // The outline's own numbering always wins; the dropdown is simply not
      // set here, so the request leaves the count to the server.
      expect(request.body.n_slides).to.equal(null);
      request.reply({ body: { id: "presentation-123" } });
    }).as("createPresentation");

    mountUploadPage();
    cy.get('[data-testid="detected-slides-badge"]').should("not.exist");

    typeOutline(outlineWith(13));
    cy.get('[data-testid="detected-slides-badge"]').should(
      "contain.text",
      "Phát hiện 13 slide",
    );
    // Nothing to tick: preserving the sequence is the default behaviour.
    cy.get('[data-testid="strict-outline-toggle"]').should("not.exist");

    cy.get('[data-testid="generate-presentation-button"]').click();
    cy.wait("@createPresentation");
  });

  it("ignores an obsolete response when the user keeps typing", () => {
    let outlineCalls = 0;
    cy.intercept("POST", "**/api/v1/ppt/prompt/rewrite", (request) => {
      outlineCalls += 1;
      request.reply({
        delay: 600,
        body: { rewritten_prompt: `Kết quả lần ${outlineCalls}` },
      });
    }).as("outlineRequest");

    mountUploadPage();
    typeIdea("Ý tưởng đầu");
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.wait("@outlineRequest");
    cy.get('[data-testid="prompt-input"]').should("have.value", "Kết quả lần 1");

    // A second, slow run is retired the moment box 1 changes.
    cy.get('[data-testid="rewrite-action-button"]').click();
    typeIdea(" đã sửa");
    cy.wait(900);
    cy.get('[data-testid="prompt-input"]').should("have.value", "Kết quả lần 1");
    cy.get('[data-testid="rewrite-action-button"]').should("be.enabled");
  });

  it("keeps the typed outline and reports a localized error when the AI fails", () => {
    cy.intercept("POST", "**/api/v1/ppt/prompt/rewrite", {
      statusCode: 503,
      body: { detail: "provider unavailable" },
    }).as("outlineRequest");

    mountUploadPage();
    typeIdea("Ý tưởng");
    cy.get('[data-testid="prompt-input"]').type("Nội dung tôi đã nhập");
    cy.get('[data-testid="rewrite-action-button"]').click();

    cy.get('[data-testid="rewrite-error"]')
      .should("be.visible")
      .and("contain.text", "tạo dàn ý");
    // The user's own content is never lost, and Create stays available.
    cy.get('[data-testid="prompt-input"]').should("have.value", "Nội dung tôi đã nhập");
    cy.get('[data-testid="generate-presentation-button"]').should("be.enabled");
    cy.get('[data-testid="rewrite-retry-button"]').should("be.visible");
  });

  it("keeps document-only creation eligible", () => {
    mountUploadPage();
    cy.get('[data-testid="generate-presentation-button"]').should("be.disabled");
    attachFile("notes.txt");
    cy.get('[data-testid="generate-presentation-button"]').should("be.enabled");
    // The attached file is also enough to ask the AI for an outline.
    cy.get('[data-testid="rewrite-action-button"]').should("be.enabled");
  });

  it("rejects legacy binary Office attachments", () => {
    mountUploadPage();

    cy.get('[data-testid="file-upload-input"]').selectFile(
      [
        {
          contents: Cypress.Buffer.from("legacy word"),
          fileName: "legacy.doc",
          mimeType: "application/msword",
        },
        {
          contents: Cypress.Buffer.from("legacy slides"),
          fileName: "legacy.ppt",
          mimeType: "application/vnd.ms-powerpoint",
        },
        {
          contents: Cypress.Buffer.from("legacy sheet"),
          fileName: "legacy.xls",
          mimeType: "application/vnd.ms-excel",
        },
        {
          contents: Cypress.Buffer.from("legacy rich text"),
          fileName: "legacy.rtf",
          mimeType: "application/rtf",
        },
      ],
      { force: true },
    );

    cy.get('[data-testid="attached-file-item"]').should("not.exist");
    cy.get('[data-testid="generate-presentation-button"]').should("be.disabled");
  });

  it("creates from documents when document-aware mode is disabled", () => {
    cy.intercept("POST", "**/api/v1/ppt/files/upload", {
      body: ["tmp-notes-upload.txt"],
    }).as("uploadDoc");
    cy.intercept("POST", "**/api/v1/ppt/files/decompose", {
      body: [{ name: "notes.txt", file_path: "tmp-notes-decomposed.txt" }],
    }).as("decomposeDocuments");
    cy.intercept("POST", "**/api/v1/ppt/presentation/create", (request) => {
      expect(request.body.file_paths).to.deep.equal([
        "tmp-notes-decomposed.txt",
      ]);
      request.reply({ body: { id: "presentation-doc-only" } });
    }).as("createPresentation");

    mountUploadPage();
    attachFile("notes.txt");
    cy.get('[data-testid="generate-presentation-button"]').click();

    cy.wait("@uploadDoc");
    cy.wait("@decomposeDocuments");
    cy.wait("@createPresentation");
  });

  it("keeps documents out of the outline but includes them in Create when the flag is disabled", () => {
    let uploadCalls = 0;
    let decomposeCalls = 0;
    cy.intercept("POST", "**/api/v1/ppt/files/upload", (request) => {
      uploadCalls += 1;
      request.reply({ body: ["tmp-notes-upload.txt"] });
    }).as("uploadDoc");
    cy.intercept("POST", "**/api/v1/ppt/files/decompose", (request) => {
      decomposeCalls += 1;
      request.reply({
        body: [{ name: "notes.txt", file_path: "tmp-notes-decomposed.txt" }],
      });
    }).as("decomposeDocuments");
    cy.intercept("POST", "**/api/v1/ppt/prompt/rewrite", (request) => {
      expect(request.body.file_paths).to.be.undefined;
      expect(uploadCalls).to.equal(0);
      expect(decomposeCalls).to.equal(0);
      request.reply({ body: { rewritten_prompt: "Brief prompt-only đã tối ưu" } });
    }).as("outlineRequest");
    cy.intercept("POST", "**/api/v1/ppt/presentation/create", (request) => {
      expect(request.body.file_paths).to.deep.equal([
        "tmp-notes-decomposed.txt",
      ]);
      request.reply({ body: { id: "presentation-prompt-and-doc" } });
    }).as("createPresentation");

    mountUploadPage();
    typeIdea("Viết về báo cáo Q3");
    attachFile("notes.txt");
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.wait("@outlineRequest");
    cy.get('[data-testid="generate-presentation-button"]').should("be.enabled").click();

    cy.wait("@uploadDoc");
    cy.wait("@decomposeDocuments");
    cy.wait("@createPresentation");
  });
});

/**
 * Document-aware outline generation. The upload page prepares the selected
 * files (upload + decompose) at most once per file set and language, grounds
 * the outline on the decomposed paths, and reuses the prepared set for
 * Create. Obsolete in-flight work is aborted and discarded.
 */
describe("document-aware outline flow", () => {
  const counters = () => {
    const state = { upload: 0, decompose: 0, outline: 0, create: 0 };
    cy.intercept("POST", "**/api/v1/ppt/files/upload", (request) => {
      state.upload += 1;
      request.reply({ body: ["tmp-notes-0.txt"] });
    }).as("uploadDoc");
    cy.intercept("POST", "**/api/v1/ppt/files/decompose", (request) => {
      state.decompose += 1;
      request.reply({
        body: [{ name: "notes.txt", file_path: "tmp-notes-0.txt" }],
      });
    }).as("decomposeDocuments");
    cy.intercept("POST", "**/api/v1/ppt/prompt/rewrite", (request) => {
      state.outline += 1;
      request.reply({
        body: { rewritten_prompt: "## Slide 1 - Mở đầu\n## Slide 2 - Bối cảnh" },
      });
    }).as("outlineRequest");
    cy.intercept("POST", "**/api/v1/ppt/presentation/create", (request) => {
      state.create += 1;
      request.reply({ body: { id: "presentation-123" } });
    }).as("createPresentation");
    return state;
  };

  it("prepares documents once, grounds the outline, and reuses them for Create", () => {
    const state = counters();

    mountUploadPage({ documentAwareRewrite: true });
    typeIdea("Viết về báo cáo Q3");
    attachFile("notes.txt");

    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.wait("@uploadDoc");
    cy.wait("@decomposeDocuments");
    cy.wait("@outlineRequest");
    cy.get('[data-testid="prompt-input"]').should(
      "have.value",
      "## Slide 1 - Mở đầu\n## Slide 2 - Bối cảnh",
    );
    cy.get('[data-testid="detected-slides-badge"]').should(
      "contain.text",
      "Phát hiện 2 slide",
    );

    // A second run with the same files and language skips upload and
    // decomposition entirely.
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.wait("@outlineRequest").then(() => {
      expect(state.upload, "upload runs once").to.equal(1);
      expect(state.decompose, "decomposition runs once").to.equal(1);
    });

    // Create reuses the prepared paths and the outline in box 2.
    cy.get('[data-testid="generate-presentation-button"]').click();
    cy.wait("@createPresentation").then(() => {
      expect(state.upload, "Create does not re-upload").to.equal(1);
      expect(state.decompose, "Create does not re-decompose").to.equal(1);
    });
    cy.get("@routerPush").should(
      "have.been.calledWith",
      "/presentation?id=presentation-123&auto=1&template=momentum",
    );
  });

  it("sends the decomposed document paths on the grounded request and on Create", () => {
    const state = counters();

    mountUploadPage({ documentAwareRewrite: true });
    typeIdea("Viết về báo cáo Q3");
    attachFile("notes.txt");

    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.wait("@uploadDoc");
    cy.wait("@decomposeDocuments");
    cy.wait("@outlineRequest").its("request.body.file_paths").should("deep.equal", ["tmp-notes-0.txt"]);

    cy.get('[data-testid="generate-presentation-button"]').click();
    cy.wait("@createPresentation")
      .its("request.body")
      .should((body) => {
        expect(body.file_paths).to.deep.equal(["tmp-notes-0.txt"]);
        expect(body.content).to.equal("## Slide 1 - Mở đầu\n## Slide 2 - Bối cảnh");
      });
    cy.then(() => {
      expect(state.decompose).to.equal(1);
    });
  });

  it("never performs document requests for a prompt-only outline", () => {
    const state = counters();

    // Flag is off: the outline and Create paths skip preparation entirely.
    mountUploadPage();
    typeIdea("AI trong giáo dục");
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.wait("@outlineRequest");
    cy.get('[data-testid="prompt-input"]').should(
      "have.value",
      "## Slide 1 - Mở đầu\n## Slide 2 - Bối cảnh",
    );

    // Prompt-only Create goes through the direct path with no file paths.
    cy.get('[data-testid="generate-presentation-button"]').click();
    cy.wait("@createPresentation")
      .its("request.body")
      .should((body) => {
        expect(body.file_paths).to.deep.equal([]);
        expect(body.content).to.equal("## Slide 1 - Mở đầu\n## Slide 2 - Bối cảnh");
      });
    cy.then(() => {
      expect(state.upload, "no upload happens").to.equal(0);
      expect(state.decompose, "no decomposition happens").to.equal(0);
    });
  });

  it("discards obsolete work when the file set changes mid-flight", () => {
    const state = counters();
    cy.intercept("POST", "**/api/v1/ppt/prompt/rewrite", (request) => {
      state.outline += 1;
      request.reply({
        delay: 600,
        body: { rewritten_prompt: "Brief đã lỗi thời" },
      });
    }).as("outlineRequest");

    mountUploadPage({ documentAwareRewrite: true });
    typeIdea("Viết về báo cáo Q3");
    attachFile("notes.txt");
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.wait("@uploadDoc");
    cy.wait("@decomposeDocuments");
    cy.wait("@outlineRequest");
    cy.get('[data-testid="prompt-input"]').should("have.value", "Brief đã lỗi thời");

    // Start another run with the slow intercept, then change the file set
    // mid-flight: the request is aborted and its response must never land.
    cy.get('[data-testid="rewrite-action-button"]').click();
    attachFile("report.txt", "second file");
    cy.wait(800);
    cy.get('[data-testid="prompt-input"]').should("have.value", "Brief đã lỗi thời");
    cy.get('[data-testid="rewrite-action-button"]').should("be.enabled");
    cy.then(() => {
      expect(state.upload, "the aborted attempt never uploaded").to.equal(1);
    });
  });

  it("re-decomposes on language change without re-uploading", () => {
    const state = counters();
    const decomposeLanguages: string[] = [];
    cy.intercept("POST", "**/api/v1/ppt/files/decompose", (request) => {
      state.decompose += 1;
      decomposeLanguages.push(request.body.language);
      request.reply({
        body: [{ name: "notes.txt", file_path: "tmp-notes-0.txt" }],
      });
    }).as("decomposeDocuments");

    mountUploadPage({ documentAwareRewrite: true });
    typeIdea("Viết về báo cáo Q3");
    attachFile("notes.txt");
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.wait("@uploadDoc");
    cy.wait("@decomposeDocuments");
    cy.wait("@outlineRequest");

    // The dropdown uses cmdk with substring/keyword matching, so the
    // selector finds the option by its language code rather than by partial
    // text matching.
    cy.get('[data-testid="language-select"]').click();
    cy.get('[role="option"][data-value="english"]').click();
    // Wait for the popover to close before clicking the outline action,
    // otherwise the click lands on the dismissing overlay.
    cy.get('[data-testid="language-select"]').should("contain.text", "Tiếng Anh");
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.then(() => {
      expect(state.upload, "originals are uploaded once").to.equal(1);
      expect(decomposeLanguages).to.deep.equal([
        "Vietnamese (Tiếng Việt)",
        "English",
      ]);
    });
  });

  it("passes the configured slide count to the outline without re-preparing documents", () => {
    const state = counters();

    mountUploadPage({ documentAwareRewrite: true });
    typeIdea("Viết về báo cáo Q3");
    attachFile("notes.txt");

    cy.get('[data-testid="slides-select"]').click();
    // The Vietnamese slide pluralization renders the count with no trailing
    // "s"; the option is rendered as `${option} slide` regardless of count.
    cy.get('[role="option"]').contains("8").click();
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.wait("@uploadDoc");
    cy.wait("@decomposeDocuments");
    cy.wait("@outlineRequest").its("request.body.n_slides").should("equal", 8);
    cy.then(() => {
      expect(state.upload, "slide count does not re-upload").to.equal(1);
      expect(state.decompose, "slide count does not re-decompose").to.equal(1);
    });
  });

  it("prepares documents on Create when no content is given", () => {
    const state = counters();

    mountUploadPage({ documentAwareRewrite: true });
    // Template readiness: the trigger is enabled once the list has loaded.
    // It reads "Auto" until a template is explicitly confirmed, because the
    // template is resolved at Create time otherwise.
    cy.get('[data-testid="upload-template-trigger"]')
      .should("be.enabled")
      .and("contain", "Auto");
    attachFile("notes.txt");
    cy.get('[data-testid="generate-presentation-button"]').should("be.enabled");

    cy.get('[data-testid="generate-presentation-button"]').click();
    cy.wait("@uploadDoc");
    cy.wait("@decomposeDocuments");
    cy.wait("@createPresentation")
      .its("request.body")
      .should((body) => {
        expect(body.file_paths).to.deep.equal(["tmp-notes-0.txt"]);
        expect(body.content).to.equal("");
      });
    cy.get("@routerPush").should(
      "have.been.calledWith",
      "/presentation?id=presentation-123&auto=1&template=momentum",
    );
    cy.then(() => {
      expect(state.outline, "no outline request happens without a click").to.equal(0);
    });
  });

  it("keeps the existing outline when document preparation fails", () => {
    let uploadShouldFail = false;
    const state = { upload: 0, decompose: 0, outline: 0, create: 0 };
    cy.intercept("POST", "**/api/v1/ppt/files/upload", (request) => {
      state.upload += 1;
      if (uploadShouldFail) {
        request.reply({ statusCode: 500, body: { detail: "provider exploded" } });
      } else {
        request.reply({ body: ["tmp-notes-0.txt"] });
      }
    }).as("uploadDoc");
    cy.intercept("POST", "**/api/v1/ppt/files/decompose", (request) => {
      state.decompose += 1;
      request.reply({
        body: [{ name: "notes.txt", file_path: "tmp-notes-0.txt" }],
      });
    }).as("decomposeDocuments");
    cy.intercept("POST", "**/api/v1/ppt/prompt/rewrite", (request) => {
      state.outline += 1;
      request.reply({ body: { rewritten_prompt: "Brief dựa trên tài liệu" } });
    }).as("outlineRequest");
    cy.intercept("POST", "**/api/v1/ppt/presentation/create", (request) => {
      state.create += 1;
      request.reply({ body: { id: "presentation-123" } });
    }).as("createPresentation");

    mountUploadPage({ documentAwareRewrite: true });
    typeIdea("Viết về báo cáo Q3");
    attachFile("notes.txt");
    cy.get('[data-testid="attached-file-item"]', { timeout: 5000 }).should(
      "have.length",
      1,
    );
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.wait("@uploadDoc");
    cy.wait("@decomposeDocuments");
    cy.wait("@outlineRequest");
    cy.get('[data-testid="prompt-input"]').should("have.value", "Brief dựa trên tài liệu");

    // Flip the upload to fail before the next click so the re-preparation
    // of the changed file set returns the localized preparation fallback.
    // Whatever the user already has must survive it.
    cy.then(() => {
      uploadShouldFail = true;
    });
    attachFile("report.txt", "second file");
    cy.get('[data-testid="rewrite-action-button"]').click();

    cy.get('[data-testid="rewrite-error"]')
      .should("be.visible")
      .and("contain.text", "chuẩn bị tài liệu");
    cy.get('[data-testid="prompt-input"]').should(
      "have.value",
      "Brief dựa trên tài liệu",
    );
    // Create is never blocked by a failed outline request.
    cy.get('[data-testid="generate-presentation-button"]').should("be.enabled");
    cy.then(() => {
      expect(state.upload, "upload is retried for the new file set").to.equal(2);
      expect(state.decompose, "decompose never runs when upload fails").to.equal(1);
      expect(state.outline, "outline does not run after preparation failure").to.equal(1);
    });
  });
});

/**
 * Redesign 2026-09-28 — the composer is two boxes: the idea plus its AI
 * outline action, then the outline itself, then attachments, then Create.
 * Tests pin that DOM order, the attachment helper copy, and the explicit
 * Create label.
 */
describe("upload redesign composition", () => {
  it("renders idea → attachments → AI action → outline → Create in that order", () => {
    mountUploadPage();

    // Box 1 owns the idea, the attachment picker, and the AI action in its
    // footer; box 2 owns the outline; Create stays outside the composer.
    const milestones = [
      '[data-testid="idea-input"]',
      '[data-testid="attachments-uploader"]',
      '[data-testid="rewrite-action-button"]',
      '[data-testid="prompt-input"]',
      '[data-testid="generate-presentation-button"]',
    ].join(", ");

    cy.get(milestones).then(($elements) => {
      const order = [...$elements].map((element) => element.dataset.testid);
      expect(order).to.deep.equal([
        "idea-input",
        "attachments-uploader",
        "rewrite-action-button",
        "prompt-input",
        "generate-presentation-button",
      ]);
    });
  });

  it("keeps the attachment picker keyboard-focusable", () => {
    mountUploadPage();

    cy.get('[data-testid="file-upload-input"]').then(($input) => {
      const input = $input[0] as HTMLInputElement;
      input.focus();
      expect(input.ownerDocument.activeElement).to.equal(input);
    });
  });

  it("labels the Create button with a visible text label", () => {
    mountUploadPage();
    cy.get('[data-testid="generate-presentation-button"]')
      .should("contain.text", "Tạo bài thuyết trình")
      .and("not.have.attr", "aria-label", "");
  });

  it("lets the outline box actually be resized by its grip", () => {
    mountUploadPage();

    cy.get('[data-testid="prompt-input"]').then(($input) => {
      const el = $input[0] as HTMLTextAreaElement;
      const style = getComputedStyle(el);
      expect(style.resize).to.equal("vertical");
      // A flex-basis:0 item takes its height from the flex container, so the
      // height the resize grip writes is ignored and the box springs back —
      // which is what made the grip feel dead.
      expect(style.flexBasis).to.equal("auto");

      const before = el.getBoundingClientRect().height;
      el.style.height = `${before + 140}px`;
      expect(el.getBoundingClientRect().height).to.be.greaterThan(before + 120);
    });
  });

  it("keeps the AI action readable once the idea has content", () => {
    mountUploadPage();

    // Empty idea and no files: nothing to rewrite into an outline.
    cy.get('[data-testid="rewrite-action-button"]')
      .should("be.disabled")
      .and("contain.text", "Viết lại");

    typeIdea("Ý tưởng về báo cáo quý");
    cy.get('[data-testid="rewrite-action-button"]')
      .should("be.enabled")
      .and("contain.text", "Viết lại")
      .and(($button) => {
        // White label text must never sit on a background that failed to
        // apply — that makes the button look like an empty white box.
        const style = getComputedStyle($button[0]);
        expect(style.color).to.equal("rgb(255, 255, 255)");
        expect(style.backgroundColor).to.not.equal("rgba(0, 0, 0, 0)");
        expect(style.opacity).to.equal("1");
      });
  });

  it("shows the document-aware helper when the flag is on and files are attached", () => {
    mountUploadPage({ documentAwareRewrite: true });
    attachFile("report.pdf", "supporting notes", "application/pdf");
    cy.get('[data-testid="attachments-helper"]').should(
      "contain.text",
      "AI sẽ dùng 1 tài liệu để tối ưu prompt",
    );
  });

  it("shows the presentation-only helper when the flag is off and files are attached", () => {
    mountUploadPage({ documentAwareRewrite: false });
    attachFile(
      "data.xlsx",
      "supporting notes",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    cy.get('[data-testid="attachments-helper"]').should(
      "contain.text",
      "Tài liệu này sẽ được dùng khi tạo bài thuyết trình",
    );
  });
});
