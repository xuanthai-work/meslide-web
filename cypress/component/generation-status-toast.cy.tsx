import React, { useState } from "react";

import GenerationStatusBar from "../../app/(presentation-generator)/components/GenerationStatusBar";
import { I18nProvider } from "../../i18n/provider";
import type { GenerationLifecycleState } from "../../lib/generation-lifecycle";
import { Toaster } from "../../components/ui/sonner";

type HarnessProps = {
  initialLifecycle?: GenerationLifecycleState;
  draftCount?: number;
  canKeepWaiting?: boolean;
  onCancel?: () => void;
  onRetry?: () => void;
  onKeepWaiting?: () => void;
};

function Harness({
  initialLifecycle = "generating",
  draftCount = 0,
  canKeepWaiting = false,
  onCancel = () => {},
  onRetry = () => {},
  onKeepWaiting = () => {},
}: HarnessProps) {
  const [lifecycle, setLifecycle] =
    useState<GenerationLifecycleState>(initialLifecycle);
  const [message, setMessage] = useState("Đang soạn dàn ý bài thuyết trình");

  return (
    <I18nProvider locale="vi-VN">
      <button
        data-testid="show-search-status"
        onClick={() => setMessage("Đang tìm kiếm bằng SearXNG: thị trường AI")}
      >
        Search status
      </button>
      <button data-testid="complete" onClick={() => setLifecycle("complete")}>
        Complete
      </button>
      <GenerationStatusBar
        surface="outline"
        lifecycle={lifecycle}
        statusMessage={message}
        draftCount={draftCount}
        totalCount={5}
        canKeepWaiting={canKeepWaiting}
        onCancel={onCancel}
        onRetry={onRetry}
        onKeepWaiting={onKeepWaiting}
      />
      <Toaster position="top-center" />
    </I18nProvider>
  );
}

describe("generation status toast", () => {
  it("updates one top-center toast when generation moves into SearXNG search", () => {
    const onCancel = cy.stub().as("cancel");
    cy.mount(<Harness onCancel={onCancel} />);

    cy.get('[data-sonner-toaster][data-x-position="center"][data-y-position="top"]')
      .should("exist");
    cy.get('[data-testid="generation-status-toast"]')
      .should("have.length", 1)
      .and("contain", "Đang soạn dàn ý bài thuyết trình");

    cy.get('[data-testid="show-search-status"]').click();
    cy.get('[data-testid="generation-status-toast"]')
      .should("have.length", 1)
      .and("contain", "Đang tìm kiếm bằng SearXNG: thị trường AI");

    cy.contains('[data-testid="generation-status-toast"] button', "Dừng").click();
    cy.get("@cancel").should("have.been.calledOnce");
  });

  it("shows recovery actions without a dismiss button", () => {
    const onCancel = cy.stub().as("cancel");
    const onRetry = cy.stub().as("retry");
    const onKeepWaiting = cy.stub().as("keepWaiting");

    cy.mount(
      <Harness
        initialLifecycle="stalled"
        canKeepWaiting
        onCancel={onCancel}
        onRetry={onRetry}
        onKeepWaiting={onKeepWaiting}
      />,
    );

    cy.get('[data-testid="generation-status-toast"] [data-close-button]')
      .should("not.exist");
    cy.contains("button", "Tiếp tục chờ").click();
    cy.contains("button", "Thử lại").click();
    cy.contains("button", "Dừng").click();
    cy.get("@keepWaiting").should("have.been.calledOnce");
    cy.get("@retry").should("have.been.calledOnce");
    cy.get("@cancel").should("have.been.calledOnce");
  });

  it("dismisses the operational toast when generation completes", () => {
    cy.mount(<Harness />);
    cy.get('[data-testid="generation-status-toast"]').should("exist");
    cy.get('[data-testid="complete"]').click();
    cy.get('[data-testid="generation-status-toast"]').should("not.exist");
  });

  it("keeps generation running when the draft-loss confirmation is rejected", () => {
    const onCancel = cy.stub().as("cancel");
    cy.on("window:confirm", () => false);
    cy.mount(<Harness draftCount={2} onCancel={onCancel} />);
    cy.contains('[data-testid="generation-status-toast"] button', "Dừng").click();
    cy.get("@cancel").should("not.have.been.called");
  });
});
