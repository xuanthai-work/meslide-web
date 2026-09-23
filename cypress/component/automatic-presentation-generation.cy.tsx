import React from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { Provider } from "react-redux";

import { I18nProvider } from "../../i18n/provider";
import { clearOutlines } from "../../store/slices/presentationGeneration";
import { store } from "../../store/store";
import { useAutomaticPresentationGeneration } from "../../app/(presentation-generator)/presentation/hooks/useAutomaticPresentationGeneration";
import { useBackgroundOutlineStream } from "../../app/(presentation-generator)/presentation/hooks/useBackgroundOutlineStream";

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  onerror: ((event: Event) => void) | null = null;
  private responseListener: ((event: MessageEvent) => void) | null = null;

  constructor(public readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type !== "response") return;
    this.responseListener = (event) => {
      if (typeof listener === "function") {
        listener(event);
      } else {
        listener.handleEvent(event);
      }
    };
  }

  emitResponse(payload: unknown) {
    this.responseListener?.(
      new MessageEvent("response", { data: JSON.stringify(payload) }),
    );
  }

  close() {}
}

function AutomaticGenerationHarness() {
  const generation = useAutomaticPresentationGeneration(
    "presentation-123",
    true,
    "template-default",
  );

  return (
    <div>
      <span data-testid="lifecycle">{generation.lifecycle}</span>
      <button type="button" onClick={() => void generation.cancel()}>
        Stop
      </button>
    </div>
  );
}

function BackgroundOutlineHarness() {
  const stream = useBackgroundOutlineStream("presentation-123", true);

  return <span data-testid="lifecycle">{stream.lifecycle}</span>;
}

const createRouter = () => ({
  back: cy.stub(),
  forward: cy.stub(),
  refresh: cy.stub(),
  push: cy.stub(),
  replace: cy.stub(),
  prefetch: cy.stub(),
});

const mountHarness = (children: React.ReactNode) => {
  cy.mount(
    <AppRouterContext.Provider value={createRouter()}>
      <Provider store={store}>
        <I18nProvider locale="vi-VN">{children}</I18nProvider>
      </Provider>
    </AppRouterContext.Provider>,
  );
};

describe("automatic presentation generation", () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    store.dispatch(clearOutlines());
  });

  it("does not prepare after cancellation when pending hydration resolves", () => {
    let hydrationRequested = false;
    let releaseHydration = () => {};
    const hydrationGate = new Promise<void>((resolve) => {
      releaseHydration = resolve;
    });
    const prepareRequests: unknown[] = [];

    cy.intercept(
      "GET",
      "**/api/v1/ppt/outlines/presentation-123",
      (request) => {
        hydrationRequested = true;
        return hydrationGate.then(() => {
          request.reply({ body: { slides: [{ content: "Late outline" }] } });
        });
      },
    ).as("getOutlines");
    cy.intercept("POST", "**/api/v1/ppt/presentation/prepare", (request) => {
      prepareRequests.push(request.body);
      request.reply({ body: {} });
    });

    mountHarness(<AutomaticGenerationHarness />);

    cy.wrap(null).should(() => {
      expect(hydrationRequested).to.equal(true);
    });
    cy.contains("button", "Stop").click();
    cy.then(() => releaseHydration());
    cy.wait("@getOutlines");
    cy.get('[data-testid="lifecycle"]').should("have.text", "idle");
    cy.then(() => {
      expect(prepareRequests).to.have.length(0);
      expect(store.getState().presentationGeneration.outlines).to.deep.equal([]);
    });
  });

  it("rejects malformed persisted outlines and starts background generation", () => {
    const prepareRequests: unknown[] = [];

    cy.window().then((win) => {
      win.EventSource = FakeEventSource as unknown as typeof EventSource;
    });
    cy.intercept("GET", "**/api/v1/ppt/outlines/presentation-123", {
      body: { slides: [{ content: {} }] },
    }).as("getOutlines");
    cy.intercept("POST", "**/api/v1/ppt/presentation/prepare", (request) => {
      prepareRequests.push(request.body);
      request.reply({ body: {} });
    });

    mountHarness(<AutomaticGenerationHarness />);

    cy.wait("@getOutlines");
    cy.wrap(null).should(() => {
      expect(FakeEventSource.instances).to.have.length(1);
      expect(prepareRequests).to.have.length(0);
      expect(store.getState().presentationGeneration.outlines).to.deep.equal([]);
    });
  });

  it("fails the background stream when complete contains malformed outlines", () => {
    cy.window().then((win) => {
      win.EventSource = FakeEventSource as unknown as typeof EventSource;
    });
    mountHarness(<BackgroundOutlineHarness />);

    cy.wrap(null).should(() => {
      expect(FakeEventSource.instances).to.have.length(1);
    });
    cy.then(() => {
      FakeEventSource.instances[0].emitResponse({
        type: "complete",
        presentation: { outlines: { slides: [null] } },
      });
    });

    cy.get('[data-testid="lifecycle"]').should("have.text", "failed");
    cy.then(() => {
      expect(store.getState().presentationGeneration.outlines).to.deep.equal([]);
    });
  });
});
