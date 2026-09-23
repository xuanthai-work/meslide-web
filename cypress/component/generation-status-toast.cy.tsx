import React, { Suspense, useState } from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import {
  PathnameContext,
  SearchParamsContext,
} from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { Provider } from "react-redux";

import GenerationStatusBar from "../../app/(presentation-generator)/components/GenerationStatusBar";
import PresentationPage from "../../app/(presentation-generator)/presentation/components/PresentationPage";
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

const mountPresentationPageWithStream = () => {
  const searchParams = new URLSearchParams({ stream: "1" });
  cy.mount(
    <SearchParamsContext.Provider value={searchParams}>
      <PathnameContext.Provider value="/presentation">
        <AppRouterContext.Provider value={createRouter()}>
          <Provider store={store}>
            <I18nProvider locale="vi-VN">
              <Suspense fallback={null}>
                <PresentationPage presentation_id="presentation-123" />
              </Suspense>
              <Toaster position="top-center" />
            </I18nProvider>
          </Provider>
        </AppRouterContext.Provider>
      </PathnameContext.Provider>
    </SearchParamsContext.Provider>,
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

  it("keeps one error toast visible on PresentationPage after stream failure", () => {
    resetStreamFailureHarness();
    cy.window().then((win) => {
      win.EventSource = FakeEventSource as unknown as typeof EventSource;
    });
    mountPresentationPageWithStream();

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

    cy.get('[role="alert"]').should("exist");
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
  beforeEach(() => {
    notify.dismiss("generation-status");
    notify.dismiss();
  });

  afterEach(() => {
    notify.dismiss("generation-status");
    notify.dismiss();
  });

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
    cy.get('[data-testid="generation-status-toast"]')
      .contains("button", "Tiếp tục chờ")
      .click();
    cy.get('[data-testid="generation-status-toast"]')
      .contains("button", "Thử lại")
      .click();
    cy.get('[data-testid="generation-status-toast"]')
      .contains("button", "Dừng")
      .click();
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

  it("clears stale description and action buttons when lifecycle changes", () => {
    function LifecycleHarness() {
      const [lifecycle, setLifecycle] =
        useState<GenerationLifecycleState>("stalled");
      const [message, setMessage] = useState(
        "Chi tiết trì hoãn từ backend",
      );

      return (
        <I18nProvider locale="vi-VN">
          <button
            type="button"
            data-testid="to-generating"
            onClick={() => {
              setLifecycle("generating");
              setMessage("Đang tạo slide mới");
            }}
          >
            Generating
          </button>
          <button
            type="button"
            data-testid="to-cancelling"
            onClick={() => setLifecycle("cancelling")}
          >
            Cancelling
          </button>
          <GenerationStatusBar
            surface="presentation"
            lifecycle={lifecycle}
            statusMessage={message}
            draftCount={0}
            totalCount={5}
            canKeepWaiting
            onCancel={() => {}}
            onRetry={() => {}}
            onKeepWaiting={() => {}}
          />
          <Toaster position="top-center" />
        </I18nProvider>
      );
    }

    cy.mount(<LifecycleHarness />);

    cy.get('[data-testid="generation-status-toast"]')
      .should("contain", "Chi tiết trì hoãn từ backend")
      .find('[data-description]')
      .should("exist");
    cy.get('[data-testid="generation-status-toast"] .generation-toast-actions button')
      .should("have.length.at.least", 1);

    cy.get('[data-testid="to-generating"]').click();
    cy.get('[data-testid="generation-status-toast"]')
      .should("contain", "Đang tạo slide mới")
      .find('[data-description]')
      .should("not.exist");

    cy.get('[data-testid="to-cancelling"]').click();
    cy.get('[data-testid="generation-status-toast"] .generation-toast-actions')
      .should("not.exist");
  });
});
