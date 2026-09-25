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
  // Document-aware rewrite is gated behind a feature flag that defaults
  // to off; the doc-aware Cypress suite turns it on so the assertions
  // exercise the document paths.
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

describe("upload prompt rewrite flow", () => {
  it("sizes the prompt input from its content instead of manual resizing", () => {
    mountUploadPage();

    cy.get('[data-testid="prompt-input"]')
      .should("have.css", "resize", "none")
      .then(($input) => {
        const initialHeight = $input[0].getBoundingClientRect().height;

        cy.wrap($input)
          .type(
            "Dòng 1{shift}{enter}Dòng 2{shift}{enter}Dòng 3{shift}{enter}Dòng 4{shift}{enter}Dòng 5{shift}{enter}Dòng 6{shift}{enter}Dòng 7{shift}{enter}Dòng 8",
          )
          .should(($grownInput) => {
            expect($grownInput[0].getBoundingClientRect().height).to.be.greaterThan(
              initialHeight,
            );
          })
          .then(($grownInput) => {
            cy.wrap($grownInput)
              .type(
                "{shift}{enter}Dòng 9{shift}{enter}Dòng 10{shift}{enter}Dòng 11{shift}{enter}Dòng 12{shift}{enter}Dòng 13{shift}{enter}Dòng 14{shift}{enter}Dòng 15{shift}{enter}Dòng 16{shift}{enter}Dòng 17{shift}{enter}Dòng 18{shift}{enter}Dòng 19{shift}{enter}Dòng 20{shift}{enter}Dòng 21{shift}{enter}Dòng 22{shift}{enter}Dòng 23{shift}{enter}Dòng 24{shift}{enter}Dòng 25",
              )
              .should(($cappedInput) => {
                expect($cappedInput[0].getBoundingClientRect().height).to.equal(
                  400,
                );
                expect($cappedInput[0].scrollHeight).to.be.greaterThan(
                  $cappedInput[0].clientHeight,
                );
                expect(getComputedStyle($cappedInput[0]).overflowY).to.equal(
                  "auto",
                );
              })
              .clear()
              .should(($clearedInput) => {
                expect(
                  $clearedInput[0].getBoundingClientRect().height,
                ).to.be.lessThan(400);
              });
          });
      });
  });

  it("remeasures wrapped prompt content when the available width changes", () => {
    cy.viewport(1200, 720);
    mountUploadPage();

    cy.get('[data-testid="prompt-input"]')
      .type(
        "Nội dung trình bày cần giải thích rõ bối cảnh, mục tiêu, phương pháp, dữ liệu, kết quả, bài học và các bước hành động tiếp theo cho toàn bộ đội ngũ tham gia dự án trong quý này.",
      )
      .then(($wideInput) => {
        const wideWidth = $wideInput[0].getBoundingClientRect().width;
        const wideHeight = $wideInput[0].getBoundingClientRect().height;

        cy.viewport(420, 720);
        cy.get('[data-testid="prompt-input"]').should(($narrowInput) => {
          expect($narrowInput[0].getBoundingClientRect().width).to.be.lessThan(
            wideWidth,
          );
          expect($narrowInput[0].getBoundingClientRect().height).to.be.greaterThan(
            wideHeight,
          );
        });
      });
  });

  it("keeps source and rewrite separate, then invalidates a stale result", () => {
    let rewriteCalls = 0;
    cy.intercept("POST", "**/api/v1/ppt/prompt/rewrite", (request) => {
      rewriteCalls += 1;
      if (rewriteCalls === 1) {
        expect(request.body.previous_prompt).to.equal(undefined);
      } else {
        expect(request.body.prompt).to.equal("AI trong giáo dục tại Việt Nam");
        expect(request.body.previous_prompt).to.equal("Bản tối ưu thứ nhất");
      }
      request.reply({
        delay: 750,
        body: {
          rewritten_prompt:
            rewriteCalls === 1
              ? "Bản tối ưu thứ nhất"
              : "Bản tối ưu đã cập nhật",
        },
      });
    }).as("rewritePrompt");

    mountUploadPage();

    cy.get('[data-testid="rewrite-action-button"]').should("be.disabled");
    cy.get('[data-testid="generate-presentation-button"]').should("be.disabled");

    cy.get('[data-testid="prompt-input"]').type("AI trong giáo dục");
    cy.get('[data-testid="rewrite-action-button"]').should("be.enabled").click();
    cy.get('[data-testid="rewrite-action-button"]')
      .should("have.attr", "aria-busy", "true")
      .and("contain.text", "Đang viết lại");
    cy.get('[data-testid="generate-presentation-button"]').should("be.disabled");

    cy.wait("@rewritePrompt");
    cy.get('[data-testid="prompt-input"]').should(
      "have.value",
      "AI trong giáo dục",
    );
    cy.get('[data-testid="rewritten-prompt-output"]')
      .should("have.value", "Bản tối ưu thứ nhất")
      .and("not.have.attr", "readonly");
    cy.get('[data-testid="generate-presentation-button"]').should("be.enabled");

    cy.get('[data-testid="prompt-input"]').clear();
    cy.get('[data-testid="prompt-input"]').should("have.value", "");
    cy.get('[data-testid="rewritten-prompt-output"]').should(
      "have.value",
      "Bản tối ưu thứ nhất",
    );
    cy.get('[data-testid="rewritten-prompt-stale-badge"]').should("be.visible");
    cy.get('[data-testid="rewrite-action-button"]').should("be.disabled");
    cy.get('[data-testid="generate-presentation-button"]').should("be.disabled");

    cy.get('[data-testid="prompt-input"]').type(
      "AI trong giáo dục tại Việt Nam",
    );
    cy.get('[data-testid="generate-presentation-button"]').should("be.disabled");
    cy.get('[data-testid="rewritten-prompt-output"]').should(
      "have.value",
      "Bản tối ưu thứ nhất",
    );

    cy.get('[data-testid="rewrite-action-button"]')
      .should("contain.text", "Cập nhật bản viết lại")
      .click();
    cy.wait("@rewritePrompt");
    cy.get('[data-testid="rewritten-prompt-output"]').should(
      "have.value",
      "Bản tối ưu đã cập nhật",
    );
    cy.get('[data-testid="rewritten-prompt-stale-badge"]').should("not.exist");
    cy.get('[data-testid="generate-presentation-button"]').should("be.enabled");
  });

  it("submits the fresh rewrite from both the keyboard and generation boundary", () => {
    cy.intercept("POST", "**/api/v1/ppt/prompt/rewrite", {
      body: { rewritten_prompt: "Prompt cuối cùng dùng để tạo slide" },
    }).as("rewritePrompt");
    cy.intercept("POST", "**/api/v1/ppt/presentation/create", (request) => {
      expect(request.body.content).to.equal(
        "Prompt cuối cùng dùng để tạo slide",
      );
      request.reply({ body: { id: "presentation-123" } });
    }).as("createPresentation");

    mountUploadPage();
    cy.get('[data-testid="prompt-input"]').type("Prompt nguồn");

    // The shortcut follows the same validation and cannot submit stale input.
    cy.get('[data-testid="prompt-input"]').type("{ctrl}{enter}");
    cy.get("@routerPush").should("not.have.been.called");

    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.wait("@rewritePrompt");
    cy.get('[data-testid="prompt-input"]').type("{ctrl}{enter}");
    cy.wait("@createPresentation");
    cy.get("@routerPush").should(
      "have.been.calledWith",
      "/presentation?id=presentation-123&auto=1&template=momentum",
    );
  });

  it("submits a hand-edited rewrite", () => {
    cy.intercept("POST", "**/api/v1/ppt/prompt/rewrite", {
      body: { rewritten_prompt: "Bản AI gốc" },
    }).as("rewritePrompt");
    cy.intercept("POST", "**/api/v1/ppt/presentation/create", (request) => {
      expect(request.body.content).to.equal("Bản đã sửa tay");
      request.reply({ body: { id: "presentation-123" } });
    }).as("createPresentation");

    mountUploadPage();
    cy.get('[data-testid="prompt-input"]').type("Ý tưởng gốc");
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.wait("@rewritePrompt");
    cy.get('[data-testid="rewritten-prompt-output"]').should(
      "not.have.attr",
      "readonly",
    );
    cy.get('[data-testid="rewritten-prompt-output"]').clear();
    cy.get('[data-testid="rewritten-prompt-output"]').type("Bản đã sửa tay");
    cy.get('[data-testid="rewritten-prompt-output"]').should(
      "have.value",
      "Bản đã sửa tay",
    );
    cy.get('[data-testid="generate-presentation-button"]').click();
    cy.wait("@createPresentation");
  });

  it("rewrites from Enter and keeps Shift+Enter as a newline", () => {
    cy.intercept("POST", "**/api/v1/ppt/prompt/rewrite", {
      body: { rewritten_prompt: "Bản viết lại từ Enter" },
    }).as("rewritePrompt");

    mountUploadPage();
    cy.get('[data-testid="prompt-input"]').type("Ý tưởng gốc");
    cy.get('[data-testid="prompt-input"]').type("{enter}");
    cy.wait("@rewritePrompt");
    cy.get('[data-testid="rewritten-prompt-output"]').should(
      "have.value",
      "Bản viết lại từ Enter",
    );

    cy.get('[data-testid="prompt-input"]').type("{shift}{enter}dòng mới");
    cy.get('[data-testid="prompt-input"]').should("have.value", "Ý tưởng gốc\ndòng mới");
    cy.get("@rewritePrompt.all").should("have.length", 1);
  });

  it("ignores an obsolete response and retains a prior result after refresh failure", () => {
    let rewriteCalls = 0;
    cy.intercept("POST", "**/api/v1/ppt/prompt/rewrite", (request) => {
      rewriteCalls += 1;
      if (rewriteCalls === 1) {
        request.reply({
          delay: 250,
          body: { rewritten_prompt: "Kết quả đã lỗi thời" },
        });
      } else if (rewriteCalls === 2) {
        request.reply({ body: { rewritten_prompt: "Kết quả mới nhất" } });
      } else {
        request.reply({
          statusCode: 503,
          body: { detail: "provider unavailable" },
        });
      }
    }).as("rewritePrompt");

    mountUploadPage();
    cy.get('[data-testid="prompt-input"]').type("Nguồn đầu tiên");
    cy.get('[data-testid="rewrite-action-button"]').click();

    // Editing aborts/invalidates request one, then request two becomes current.
    cy.get('[data-testid="prompt-input"]').type(" đã sửa");
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.get('[data-testid="rewritten-prompt-output"]').should(
      "have.value",
      "Kết quả mới nhất",
    );
    cy.wait(300);
    cy.get('[data-testid="rewritten-prompt-output"]').should(
      "have.value",
      "Kết quả mới nhất",
    );

    cy.get('[data-testid="prompt-input"]').type(" lần nữa");
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.get('[data-testid="rewritten-prompt-error"]').should("be.visible");
    cy.get('[data-testid="rewritten-prompt-output"]').should(
      "have.value",
      "Kết quả mới nhất",
    );
    cy.get('[data-testid="generate-presentation-button"]').should("be.disabled");
  });

  it("keeps document-only creation eligible", () => {
    mountUploadPage();
    cy.get('[data-testid="generate-presentation-button"]').should("be.disabled");
    cy.get('[data-testid="file-upload-input"]').selectFile(
      {
        contents: Cypress.Buffer.from("supporting notes"),
        fileName: "notes.txt",
        mimeType: "text/plain",
      },
      { force: true },
    );
    cy.get('[data-testid="generate-presentation-button"]').should("be.enabled");
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

  it("creates from documents when document-aware rewrite is disabled", () => {
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
    cy.get('[data-testid="file-upload-input"]').selectFile(
      {
        contents: Cypress.Buffer.from("supporting notes"),
        fileName: "notes.txt",
        mimeType: "text/plain",
      },
      { force: true },
    );
    cy.get('[data-testid="generate-presentation-button"]').click();

    cy.wait("@uploadDoc");
    cy.wait("@decomposeDocuments");
    cy.wait("@createPresentation");
  });

  it("keeps documents out of rewrite but includes them in Create when the flag is disabled", () => {
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
    }).as("rewritePrompt");
    cy.intercept("POST", "**/api/v1/ppt/presentation/create", (request) => {
      expect(request.body.file_paths).to.deep.equal([
        "tmp-notes-decomposed.txt",
      ]);
      request.reply({ body: { id: "presentation-prompt-and-doc" } });
    }).as("createPresentation");

    mountUploadPage();
    cy.get('[data-testid="prompt-input"]').type("Viết về báo cáo Q3");
    cy.get('[data-testid="file-upload-input"]').selectFile(
      {
        contents: Cypress.Buffer.from("supporting notes"),
        fileName: "notes.txt",
        mimeType: "text/plain",
      },
      { force: true },
    );
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.wait("@rewritePrompt");
    cy.get('[data-testid="generate-presentation-button"]').should("be.enabled");
    cy.get('[data-testid="generate-presentation-button"]').click();

    cy.wait("@uploadDoc");
    cy.wait("@decomposeDocuments");
    cy.wait("@createPresentation");
  });

});

/**
 * Document-aware rewrite flow. The upload page prepares the selected files
 * (upload + decompose) at most once per file set and language, grounds the
 * rewrite on the decomposed paths, and reuses the prepared set for Create.
 * Any change to a rewrite input (files, language, slide count) marks the
 * stored result stale; obsolete in-flight work is aborted and discarded.
 */
describe("document-aware rewrite flow", () => {
  const attach = (name: string, contents = "supporting notes") =>
    cy
      .get('[data-testid="file-upload-input"]')
      .selectFile(
        {
          contents: Cypress.Buffer.from(contents),
          fileName: name,
          mimeType: "text/plain",
        },
        { force: true },
      );

  const counters = () => {
    const state = { upload: 0, decompose: 0, rewrite: 0, create: 0 };
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
      state.rewrite += 1;
      request.reply({
        body: { rewritten_prompt: "Brief dựa trên tài liệu" },
      });
    }).as("rewritePrompt");
    cy.intercept("POST", "**/api/v1/ppt/presentation/create", (request) => {
      state.create += 1;
      request.reply({ body: { id: "presentation-123" } });
    }).as("createPresentation");
    return state;
  };

  it("prepares documents once, grounds the rewrite, and reuses them for Create", () => {
    const state = counters();

    mountUploadPage({ documentAwareRewrite: true });
    cy.get('[data-testid="prompt-input"]').type("Viết về báo cáo Q3");
    attach("notes.txt");

    // Keyboard submission cannot run before a fresh document-aware rewrite.
    cy.get('[data-testid="prompt-input"]').type("{ctrl}{enter}");
    cy.get("@routerPush").should("not.have.been.called");

    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.wait("@uploadDoc");
    cy.wait("@decomposeDocuments");
    cy.wait("@rewritePrompt");
    cy.get('[data-testid="rewritten-prompt-output"]').should(
      "have.value",
      "Brief dựa trên tài liệu",
    );
    cy.get('[data-testid="generate-presentation-button"]').should("be.enabled");

    // A second rewrite with the same files and language skips upload and
    // decomposition entirely.
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.wait("@rewritePrompt").then(() => {
      expect(state.upload, "upload runs once").to.equal(1);
      expect(state.decompose, "decomposition runs once").to.equal(1);
    });
    cy.get('[data-testid="rewritten-prompt-output"]').should(
      "have.value",
      "Brief dựa trên tài liệu",
    );

    // Create reuses the prepared paths and the fresh rewrite.
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

  it("sends the decomposed document paths on every grounded request", () => {
    const state = counters();

    mountUploadPage({ documentAwareRewrite: true });
    cy.get('[data-testid="prompt-input"]').type("Viết về báo cáo Q3");
    attach("notes.txt");

    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.wait("@uploadDoc");
    cy.wait("@decomposeDocuments");
    cy.wait("@rewritePrompt").its("request.body.file_paths").should("deep.equal", ["tmp-notes-0.txt"]);

    cy.get('[data-testid="generate-presentation-button"]').click();
    cy.wait("@createPresentation")
      .its("request.body")
      .should((body) => {
        expect(body.file_paths).to.deep.equal(["tmp-notes-0.txt"]);
        expect(body.content).to.equal("Brief dựa trên tài liệu");
      });
    cy.then(() => {
      expect(state.decompose).to.equal(1);
    });
  });

  it("never performs document requests for a prompt-only rewrite", () => {
    const state = counters();

    // Flag is off: the rewrite and Create paths skip preparation entirely.
    mountUploadPage();
    cy.get('[data-testid="prompt-input"]').type("AI trong giáo dục");
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.wait("@rewritePrompt");
    cy.get('[data-testid="rewritten-prompt-output"]').should(
      "have.value",
      "Brief dựa trên tài liệu",
    );

    // Prompt-only Create goes through the direct path with no file paths.
    cy.get('[data-testid="generate-presentation-button"]').click();
    cy.wait("@createPresentation")
      .its("request.body")
      .should((body) => {
        expect(body.file_paths).to.deep.equal([]);
        expect(body.content).to.equal("Brief dựa trên tài liệu");
      });
    cy.then(() => {
      expect(state.upload, "no upload happens").to.equal(0);
      expect(state.decompose, "no decomposition happens").to.equal(0);
    });
  });

  it("discards obsolete work and marks the result stale when files change", () => {
    const state = counters();
    cy.intercept("POST", "**/api/v1/ppt/prompt/rewrite", (request) => {
      state.rewrite += 1;
      request.reply({
        delay: 600,
        body: { rewritten_prompt: "Brief đã lỗi thời" },
      });
    }).as("rewritePrompt");

    mountUploadPage({ documentAwareRewrite: true });
    cy.get('[data-testid="prompt-input"]').type("Viết về báo cáo Q3");
    attach("notes.txt");
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.wait("@uploadDoc");
    cy.wait("@decomposeDocuments");
    cy.wait("@rewritePrompt");
    cy.get('[data-testid="rewritten-prompt-output"]').should(
      "have.value",
      "Brief đã lỗi thời",
    );
    cy.get('[data-testid="generate-presentation-button"]').should("be.enabled");

    // Start a rewrite with the slow intercept, then change the file set
    // mid-flight: the request is aborted and its response must never land.
    cy.get('[data-testid="rewrite-action-button"]').click();
    attach("report.txt", "second file");
    cy.wait(800);
    cy.get('[data-testid="rewritten-prompt-output"]').should(
      "have.value",
      "Brief đã lỗi thời",
    );
    cy.get('[data-testid="rewritten-prompt-stale-badge"]').should("be.visible");
    cy.get('[data-testid="rewrite-action-button"]')
      .should("contain.text", "Cập nhật bản viết lại")
      .and("be.enabled");
    cy.get('[data-testid="generate-presentation-button"]').should("be.disabled");
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
    cy.get('[data-testid="prompt-input"]').type("Viết về báo cáo Q3");
    attach("notes.txt");
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.wait("@uploadDoc");
    cy.wait("@decomposeDocuments");
    cy.wait("@rewritePrompt");

    // Switching language marks the grounded result stale. The dropdown
    // uses cmdk with substring/keyword matching, so the selector finds the
    // "Auto (English)" option first; instead of relying on partial text
    // matching, we read the language code from each option and pick the one
    // whose code maps to "english".
    cy.get('[data-testid="language-select"]').click();
    cy.get('[role="option"][data-value="english"]').click();
    cy.get('[data-testid="rewritten-prompt-stale-badge"]').should("be.visible");
    cy.get('[data-testid="generate-presentation-button"]').should("be.disabled");

    // Refreshing reuses the uploaded originals but re-extracts the text.
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.wait("@decomposeDocuments");
    cy.wait("@rewritePrompt");
    cy.get('[data-testid="rewritten-prompt-stale-badge"]').should("not.exist");
    cy.get('[data-testid="generate-presentation-button"]').should("be.enabled");
    cy.then(() => {
      expect(state.upload, "originals are uploaded once").to.equal(1);
      expect(decomposeLanguages).to.deep.equal([
        "Vietnamese (Tiếng Việt)",
        "English",
      ]);
    });
  });

  it("marks slide-count changes stale without re-preparing documents", () => {
    const state = counters();

    mountUploadPage({ documentAwareRewrite: true });
    cy.get('[data-testid="prompt-input"]').type("Viết về báo cáo Q3");
    attach("notes.txt");
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.wait("@uploadDoc");
    cy.wait("@decomposeDocuments");
    cy.wait("@rewritePrompt");
    cy.get('[data-testid="rewritten-prompt-stale-badge"]').should("not.exist");

    cy.get('[data-testid="slides-select"]').click();
    // The Vietnamese slide pluralization renders the count with no trailing
    // "s"; the option is rendered as `${option} slide` regardless of count.
    cy.get('[role="option"]').contains("8").click();
    cy.get('[data-testid="rewritten-prompt-stale-badge"]').should("be.visible");
    cy.get('[data-testid="generate-presentation-button"]').should("be.disabled");

    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.wait("@rewritePrompt").its("request.body.n_slides").should("equal", 8);
    cy.get('[data-testid="rewritten-prompt-stale-badge"]').should("not.exist");
    cy.then(() => {
      expect(state.upload, "slide count does not re-upload").to.equal(1);
      expect(state.decompose, "slide count does not re-decompose").to.equal(1);
    });
  });

  it("prepares documents on Create when no prompt is given", () => {
    const state = counters();

    mountUploadPage({ documentAwareRewrite: true });
    cy.get('[data-testid="upload-template-trigger"]').should("contain", "Bứt phá");
    attach("notes.txt");
    cy.get('[data-testid="generate-presentation-button"]').should("be.enabled");
    cy.get('[data-testid="rewrite-action-button"]').should("be.disabled");

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
      expect(state.rewrite, "no rewrite happens without a prompt").to.equal(0);
    });
  });

  it("keeps the previous rewrite visible and Create blocked when preparation fails", () => {
    let uploadShouldFail = false;
    const state = { upload: 0, decompose: 0, rewrite: 0, create: 0 };
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
      state.rewrite += 1;
      request.reply({
        body: { rewritten_prompt: "Brief dựa trên tài liệu" },
      });
    }).as("rewritePrompt");
    cy.intercept("POST", "**/api/v1/ppt/presentation/create", (request) => {
      state.create += 1;
      request.reply({ body: { id: "presentation-123" } });
    }).as("createPresentation");

    mountUploadPage({ documentAwareRewrite: true });
    cy.get('[data-testid="prompt-input"]').type("Viết về báo cáo Q3");
    attach("notes.txt");
    cy.get('[data-testid="attached-file-item"]', { timeout: 5000 }).should(
      "have.length",
      1,
    );
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.wait("@uploadDoc");
    cy.wait("@decomposeDocuments");
    cy.wait("@rewritePrompt");
    cy.get('[data-testid="rewritten-prompt-output"]').should(
      "have.value",
      "Brief dựa trên tài liệu",
    );
    cy.get('[data-testid="generate-presentation-button"]').should("be.enabled");

    // Flip the upload to fail before the next rewrite click so the
    // re-preparation of the changed file set returns the localized
    // preparation fallback. The previous rewrite must stay visible.
    cy.then(() => {
      uploadShouldFail = true;
    });
    attach("report.txt", "second file");
    cy.get('[data-testid="rewritten-prompt-stale-badge"]').should("be.visible");
    cy.get('[data-testid="rewrite-action-button"]').click();

    cy.get('[data-testid="rewritten-prompt-error"]')
      .should("be.visible")
      .and("contain.text", "chuẩn bị tài liệu");
    cy.get('[data-testid="rewritten-prompt-output"]').should(
      "have.value",
      "Brief dựa trên tài liệu",
    );
    cy.get('[data-testid="generate-presentation-button"]').should("be.disabled");
    cy.then(() => {
      expect(state.upload, "upload is retried for the new file set").to.equal(2);
      expect(state.decompose, "decompose never runs when upload fails").to.equal(1);
      expect(state.rewrite, "rewrite does not run after preparation failure").to.equal(1);
    });
  });
});

/**
 * Redesign 2026-09-16 — the upload composer was recomposed so prompt and
 * documents appear as inputs first, the rewritten prompt and its grounding
 * helper sit between them, and Create is an explicit visible text action
 * below the rewrite output. Tests pin the DOM order, the new helper copy,
 * the compact empty state, and the explicit Create label.
 */
describe("upload redesign composition", () => {
  it("renders attachments before the Rewrite action and Create after the output", () => {
    mountUploadPage();

    const milestones = [
      '[data-testid="attachments-uploader"]',
      '[data-testid="rewrite-action-button"]',
      '[data-testid="rewritten-prompt"]',
      '[data-testid="generate-presentation-button"]',
    ].join(", ");

    cy.get(milestones).then(($elements) => {
      const order = [...$elements].map((element) => element.dataset.testid);
      expect(order).to.deep.equal([
        "attachments-uploader",
        "rewrite-action-button",
        "rewritten-prompt",
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

  it("shows the document-aware helper when the flag is on and files are attached", () => {
    mountUploadPage({ documentAwareRewrite: true });
    cy.get('[data-testid="file-upload-input"]').selectFile(
      {
        contents: Cypress.Buffer.from("supporting notes"),
        fileName: "report.pdf",
        mimeType: "application/pdf",
      },
      { force: true },
    );
    cy.get('[data-testid="attachments-helper"]').should(
      "contain.text",
      "AI sẽ dùng 1 tài liệu để tối ưu prompt",
    );
  });

  it("shows the presentation-only helper when the flag is off and files are attached", () => {
    mountUploadPage({ documentAwareRewrite: false });
    cy.get('[data-testid="file-upload-input"]').selectFile(
      {
        contents: Cypress.Buffer.from("supporting notes"),
        fileName: "data.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      { force: true },
    );
    cy.get('[data-testid="attachments-helper"]').should(
      "contain.text",
      "Tài liệu này sẽ được dùng khi tạo bài thuyết trình",
    );
  });

  it("renders the rewritten panel as a compact empty state before the first rewrite", () => {
    mountUploadPage();
    cy.get('[data-testid="rewritten-prompt"]')
      .should("have.attr", "data-compact-empty", "true")
      .and("not.contain.text", "AI-optimized prompt");
    cy.get('[data-testid="rewritten-prompt"]').should(
      "contain.text",
      "Chưa có bản viết lại",
    );
  });

  it("expands the panel once a fresh document-aware rewrite succeeds", () => {
    cy.intercept("POST", "**/api/v1/ppt/files/upload", {
      body: ["tmp-notes-0.txt"],
    }).as("uploadDoc");
    cy.intercept("POST", "**/api/v1/ppt/files/decompose", {
      body: [{ name: "notes.txt", file_path: "tmp-notes-0.txt" }],
    }).as("decomposeDocuments");
    cy.intercept("POST", "**/api/v1/ppt/prompt/rewrite", {
      body: { rewritten_prompt: "Brief dựa trên tài liệu" },
    }).as("rewritePrompt");
    mountUploadPage({ documentAwareRewrite: true });
    cy.get('[data-testid="prompt-input"]').type("Viết về báo cáo Q3");
    cy.get('[data-testid="file-upload-input"]').selectFile(
      {
        contents: Cypress.Buffer.from("supporting notes"),
        fileName: "notes.txt",
        mimeType: "text/plain",
      },
      { force: true },
    );
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.wait("@rewritePrompt");
    cy.get('[data-testid="rewritten-prompt"]').should(
      "not.have.attr",
      "data-compact-empty",
    );
    cy.get('[data-testid="rewritten-prompt-grounded-helper"]').should(
      "contain.text",
      "Đã tối ưu từ ý tưởng và 1 tài liệu",
    );
  });

  it("hides the grounded helper while the stored rewrite is stale", () => {
    cy.intercept("POST", "**/api/v1/ppt/files/upload", {
      body: ["tmp-notes-0.txt"],
    }).as("uploadDoc");
    cy.intercept("POST", "**/api/v1/ppt/files/decompose", {
      body: [{ name: "notes.txt", file_path: "tmp-notes-0.txt" }],
    }).as("decomposeDocuments");
    cy.intercept("POST", "**/api/v1/ppt/prompt/rewrite", {
      body: { rewritten_prompt: "Brief dựa trên tài liệu" },
    }).as("rewritePrompt");
    mountUploadPage({ documentAwareRewrite: true });
    cy.get('[data-testid="prompt-input"]').type("Viết về báo cáo Q3");
    cy.get('[data-testid="file-upload-input"]').selectFile(
      {
        contents: Cypress.Buffer.from("supporting notes"),
        fileName: "notes.txt",
        mimeType: "text/plain",
      },
      { force: true },
    );
    cy.get('[data-testid="rewrite-action-button"]').click();
    cy.wait("@rewritePrompt");
    cy.get('[data-testid="rewritten-prompt-grounded-helper"]').should("exist");
    cy.get('[data-testid="prompt-input"]').clear();
    cy.get('[data-testid="rewritten-prompt-stale-badge"]').should("be.visible");
    cy.get('[data-testid="rewritten-prompt-grounded-helper"]').should("not.exist");
  });
});
