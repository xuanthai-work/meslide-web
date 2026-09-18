import React from "react";

import SettingSideBar from "../../app/(presentation-generator)/(dashboard)/settings/SettingSideBar";
import AdvanceSettings from "../../app/(presentation-generator)/upload/components/AdvanceSettings";
import {
  LanguageType,
  ToneType,
  VerbosityType,
} from "../../app/(presentation-generator)/upload/type";
import { I18nProvider } from "../../i18n/provider";

describe("Vietnamese golden-path controls", () => {
  it("renders settings tabs in Vietnamese and emits stable section identifiers", () => {
    const setSelectedProvider = cy.stub().as("setSelectedProvider");
    cy.viewport(768, 700);
    cy.mount(
      <I18nProvider>
        <SettingSideBar
          selectedProvider="text-provider"
          setSelectedProvider={setSelectedProvider}
        />
      </I18nProvider>,
    );

    cy.get('nav[aria-label="Các mục cài đặt"] [role="tablist"]').should("exist");
    cy.get('[role="tab"]').eq(0).should("contain.text", "Văn bản").and("have.attr", "aria-selected", "true");
    cy.get('[role="tab"]').should("have.length", 2);
    cy.contains('[role="tab"]', "Hình ảnh").should("not.exist");
    cy.get('[role="tab"]').eq(1).should("contain.text", "Tìm kiếm").click();
    cy.get("@setSelectedProvider").should("have.been.calledOnceWith", "web-search-provider");
  });

  it("shows localized tone and verbosity labels instead of API tokens", () => {
    cy.viewport(900, 800);
    cy.mount(
      <I18nProvider>
        <AdvanceSettings
          config={{
            slides: "8",
            language: LanguageType.Vietnamese,
            prompt: "",
            tone: ToneType.Default,
            verbosity: VerbosityType.Standard,
            instructions: "",
            includeTableOfContents: false,
            includeTitleSlide: false,
            webSearch: false,
          }}
          onConfigChange={cy.stub()}
        />
      </I18nProvider>,
    );

    cy.get('[data-testid="advanced-settings-button"]').click();

    cy.get('[data-testid="tone-select"]').should("contain.text", "Mặc định").click();
    cy.contains('[role="option"]', "Thuyết trình bán hàng").should("be.visible");
    cy.contains('[role="option"]', "Sales_pitch").should("not.exist");
    cy.contains('[role="option"]', "sales_pitch").should("not.exist");
    cy.contains('[role="option"]', "Mặc định").click();

    cy.get('[data-testid="verbosity-select"]').should("contain.text", "Tiêu chuẩn").click();
    cy.contains('[role="option"]', "Nhiều chữ").should("be.visible");
    cy.contains('[role="option"]', "Text-Heavy").should("not.exist");
    cy.contains('[role="option"]', "text-heavy").should("not.exist");
  });
});
