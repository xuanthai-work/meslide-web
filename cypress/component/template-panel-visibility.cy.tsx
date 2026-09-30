import React from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import TemplatePanel from "../../app/(presentation-generator)/(dashboard)/templates/components/TemplatePanel";

describe("public template library", () => {
  it("shows built-in templates without entry points to personal templates", () => {
    cy.intercept("GET", "**/api/v1/ppt/template/all?*", (request) => {
      const isDefault = new URL(request.url).searchParams.get("default") === "true";
      request.reply({
        body: {
          items: isDefault
            ? [{ id: "momentum", name: "Momentum", is_default: true, layout_count: 3 }]
            : [{ id: "personal", name: "Personal", is_default: false, layout_count: 3 }],
          total: 1,
          page: 1,
          page_size: 100,
        },
      });
    });

    const router = {
      back: cy.stub(),
      forward: cy.stub(),
      refresh: cy.stub(),
      push: cy.stub().as("routerPush"),
      replace: cy.stub(),
      prefetch: cy.stub(),
    };

    cy.mount(
      <AppRouterContext.Provider value={router}>
          <TemplatePanel />
      </AppRouterContext.Provider>,
    );

    cy.contains("Bứt phá").should("be.visible");
    cy.contains("Personal").should("not.exist");
    cy.contains("Tùy chỉnh").should("not.exist");
    cy.get('a[href="/custom-template"]').should("not.exist");
    cy.contains("Mẫu mới").should("not.exist");
  });
});
