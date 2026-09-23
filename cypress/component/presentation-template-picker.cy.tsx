import React from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import PresentationTemplatePicker from "../../app/(presentation-generator)/presentation/components/PresentationTemplatePicker";
import { I18nProvider } from "../../i18n/provider";

const response = (items: Array<Record<string, unknown>>) => ({
  items,
  total: items.length,
  page: 1,
  page_size: 100,
});

const builtIn = {
  id: "template-default",
  name: "Momentum",
  description: "Built-in template",
  is_default: true,
  layout_count: 3,
};

const custom = {
  id: "template-custom",
  name: "Sales Review",
  description: "Custom template",
  is_default: false,
  layout_count: 2,
};

const stubTemplateRequests = (
  defaults: Array<Record<string, unknown>>,
  customs: Array<Record<string, unknown>>,
  delay = 0,
) => {
  cy.intercept("GET", "**/api/v1/ppt/template/all?*", (request) => {
    const isDefault = new URL(request.url).searchParams.get("default") === "true";
    request.reply({
      delay,
      body: response(isDefault ? defaults : customs),
    });
  });
};

const mountPicker = ({ suggestedTemplate = null }: { suggestedTemplate?: string | null } = {}) => {
  const replace = cy.stub().as("routerReplace");
  const router = {
    back: cy.stub(),
    forward: cy.stub(),
    refresh: cy.stub(),
    push: cy.stub().as("routerPush"),
    replace,
    prefetch: cy.stub(),
  };
  cy.mount(
    <AppRouterContext.Provider value={router}>
      <I18nProvider locale="vi-VN">
        <PresentationTemplatePicker
          presentationId="presentation-123"
          suggestedTemplate={suggestedTemplate}
        />
      </I18nProvider>
    </AppRouterContext.Provider>,
  );
};

describe("presentation template picker", () => {
  it("shows loading then built-in and custom templates", () => {
    cy.intercept("GET", "**/api/v1/ppt/template/all?*default=true*", {
      delay: 100,
      body: response([builtIn]),
    });
    cy.intercept("GET", "**/api/v1/ppt/template/all?*default=false*", {
      delay: 100,
      body: response([custom]),
    });
    mountPicker();
    cy.contains(/đang tải|loading/i).should("exist");
    cy.contains("Momentum").should("exist");
    cy.contains("Sales Review").should("exist");
  });

  it("shows the load error", () => {
    cy.intercept("GET", "**/api/v1/ppt/template/all?*", { statusCode: 500, body: {} });
    mountPicker();
    cy.contains(/không thể tải mẫu|could not be loaded/i).should("exist");
  });

  it("marks a suggested template and navigates only after click", () => {
    stubTemplateRequests([builtIn], []);
    mountPicker({ suggestedTemplate: "momentum" });
    cy.contains(/đề xuất|suggested/i).should("exist");
    cy.get("@routerReplace").should("not.have.been.called");
    cy.get('[role="button"][aria-label*="Momentum"]').click();
    cy.get("@routerReplace").should(
      "have.been.calledWith",
      "/presentation?id=presentation-123&auto=1&template=template-default",
    );
  });
});
