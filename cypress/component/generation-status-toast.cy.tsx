import React, { useState } from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { Provider } from "react-redux";

import GenerationStatusBar from "../../app/(presentation-generator)/components/GenerationStatusBar";
import { I18nProvider } from "../../i18n/provider";
import type { GenerationLifecycleState } from "../../lib/generation-lifecycle";
import { notify, Toaster } from "../../components/ui/sonner";
import {
  clearOutlines,
  clearPresentationData,
  setStreaming,
} from "../../store/slices/presentationGeneration";
import { store } from "../../store/store";

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

const createRouter = () => ({
  back: cy.stub(),
  forward: cy.stub(),
  refresh: cy.stub(),
  push: cy.stub(),
  replace: cy.stub(),
  prefetch: cy.stub(),
});

const mountStreamHarness = (children: React.ReactNode) => {
  cy.mount(
    <AppRouterContext.Provider value={createRouter()}>
      <Provider store={store}>
        <I18nProvider locale="vi-VN">{children}</I18nProvider>
      </Provider>
    </AppRouterContext.Provider>,
  );
};

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

const resetStreamFailureHarness = () => {
  FakeEventSource.instances = [];
  store.dispatch(clearOutlines());
  store.dispatch(clearPresentationData());
  store.dispatch(setStreaming(false));
  notify.dismiss("generation-status");
  notify.dismiss();
};

describe("generation status stream failure integration", () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    notify.dismiss();
  });

  afterEach(() => {
    FakeEventSource.instances = [];
    notify.dismiss("generation-status");
    notify.dismiss();
  });

  it("shows one operational error toast when the presentation stream fails", () => {
    const { usePresentationStreaming } =
      require("../../app/(presentation-generator)/presentation/hooks/usePresentationStreaming") as typeof import("../../app/(presentation-generator)/presentation/hooks/usePresentationStreaming");

    function PresentationStreamHarness() {
      const stream = usePresentationStreaming(
        "presentation-123",
        "true",
        () => {},
        () => {},
        () => {},
        { skipSlideFetch: true },
      );

      return (
        <>
          <GenerationStatusBar
            surface="presentation"
            lifecycle={stream.lifecycle}
            statusMessage={stream.statusMessage}
            draftCount={stream.draftCount}
            totalCount={null}
            canKeepWaiting={stream.canKeepWaiting}
            onCancel={() => void stream.cancel()}
            onKeepWaiting={stream.keepWaiting}
            onRetry={stream.retry}
          />
          <Toaster position="top-center" />
        </>
      );
    }

    resetStreamFailureHarness();
    cy.window().then((win) => {
      win.EventSource = FakeEventSource as unknown as typeof EventSource;
    });
    mountStreamHarness(<PresentationStreamHarness />);

    cy.wrap(null).should(() => {
      expect(FakeEventSource.instances).to.have.length(1);
    });
    cy.get('[data-testid="generation-status-toast"]').should("exist");
    cy.then(() => {
      FakeEventSource.instances[0].emitResponse({
        type: "error",
        detail: "Provider generation failed",
      });
    });

    cy.get('[data-testid="generation-status-toast"]')
      .should("have.length", 1)
      .and("contain", "Provider generation failed");
    cy.get('[data-sonner-toast]').should("have.length", 1);
  });

  it("shows one operational error toast when the outline stream fails", () => {
    const { useBackgroundOutlineStream } =
      require("../../app/(presentation-generator)/presentation/hooks/useBackgroundOutlineStream") as typeof import("../../app/(presentation-generator)/presentation/hooks/useBackgroundOutlineStream");

    function BackgroundOutlineStreamHarness() {
      const stream = useBackgroundOutlineStream("presentation-123", true);

      return (
        <>
          <GenerationStatusBar
            surface="outline"
            lifecycle={stream.lifecycle}
            statusMessage={stream.statusMessage}
            draftCount={0}
            totalCount={5}
            canKeepWaiting={stream.canKeepWaiting}
            onCancel={() => void stream.cancel()}
            onKeepWaiting={stream.keepWaiting}
            onRetry={stream.retry}
          />
          <Toaster position="top-center" />
        </>
      );
    }

    resetStreamFailureHarness();
    cy.window().then((win) => {
      win.EventSource = FakeEventSource as unknown as typeof EventSource;
    });
    mountStreamHarness(<BackgroundOutlineStreamHarness />);

    cy.wrap(null).should(() => {
      expect(FakeEventSource.instances).to.have.length(1);
    });
    cy.then(() => {
      FakeEventSource.instances[0].emitResponse({
        type: "error",
        detail: "Provider generation failed",
      });
    });

    cy.get('[data-testid="generation-status-toast"]')
      .should("have.length", 1)
      .and("contain", "Provider generation failed");
    cy.get('[data-sonner-toast]').should("have.length", 1);
  });
});

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
