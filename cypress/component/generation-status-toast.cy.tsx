import React, { Suspense, useEffect, useState } from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import {
  PathnameContext,
  SearchParamsContext,
} from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { Provider } from "react-redux";

import GenerationStatusBar from "../../app/(presentation-generator)/components/GenerationStatusBar";
import { usePresentationStreaming } from "../../app/(presentation-generator)/presentation/hooks/usePresentationStreaming";
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
  closed = false;

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

  close() {
    this.closed = true;
  }
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

function StoppedPresentationStreamHarness() {
  const [streamParam, setStreamParam] = useState<string | null>("true");
  const [statusMounted, setStatusMounted] = useState(false);
  const stream = usePresentationStreaming(
    "presentation-123",
    streamParam,
    noopHarnessHandler,
    noopHarnessHandler,
    noopHarnessHandler,
    { skipSlideFetch: true },
  );

  useEffect(() => {
    if (stream.lifecycle !== "idle") {
      setStatusMounted(true);
    }
  }, [stream.lifecycle]);

  return (
    <>
      <button
        type="button"
        data-testid="sync-stream-param"
        onClick={() => setStreamParam(null)}
      >
        Sync stream URL
      </button>
      {statusMounted ? (
        <GenerationStatusBar
          surface="presentation"
          lifecycle={stream.lifecycle}
          statusMessage={stream.statusMessage}
          draftCount={stream.draftCount}
          totalCount={8}
          canKeepWaiting={stream.canKeepWaiting}
          onCancel={() => void stream.cancel()}
          onKeepWaiting={stream.keepWaiting}
          onRetry={stream.retry}
        />
      ) : null}
      <Toaster position="top-center" />
    </>
  );
}

const mountPresentationPageWithStream = () => {
  const PresentationPage =
    require("../../app/(presentation-generator)/presentation/components/PresentationPage")
      .default as typeof import("../../app/(presentation-generator)/presentation/components/PresentationPage").default;
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

const noopHarnessHandler = () => {};

type HarnessProps = {
  surface?: "outline" | "presentation";
  initialLifecycle?: GenerationLifecycleState;
  draftCount?: number;
  canKeepWaiting?: boolean;
  onCancel?: () => void;
  onRetry?: () => void;
  onKeepWaiting?: () => void;
};

function Harness({
  surface = "outline",
  initialLifecycle = "generating",
  draftCount = 0,
  canKeepWaiting = false,
  onCancel = noopHarnessHandler,
  onRetry = noopHarnessHandler,
  onKeepWaiting = noopHarnessHandler,
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
        surface={surface}
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

describe("generation status controller toast", () => {
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

  it("keeps the loading toast without recovery actions while stalled", () => {
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
      .should("contain", "Đang soạn dàn ý bài thuyết trình");
    cy.get('[data-testid="generation-status-toast"] .generation-toast-actions')
      .should("not.exist");
    cy.get("@keepWaiting").should("not.have.been.called");
    cy.get("@retry").should("not.have.been.called");
    cy.get("@cancel").should("not.have.been.called");
  });

  it("dismisses the operational toast when generation completes", () => {
    cy.mount(<Harness />);
    cy.get('[data-testid="generation-status-toast"]').should("exist");
    cy.get('[data-testid="complete"]').click();
    cy.get('[data-testid="generation-status-toast"]').should("not.exist");
  });

  it("keeps a retry action visible after presentation generation is stopped", () => {
    const onRetry = cy.stub().as("retry");
    cy.mount(
      <Harness
        surface="presentation"
        initialLifecycle="cancelled"
        draftCount={3}
        onRetry={onRetry}
      />,
    );

    cy.get('[data-testid="generation-status-toast"]')
      .should("have.length", 1)
      .and("contain", "Đã dừng tạo. Bản nháp hiện tại đã được giữ lại.");
    cy.contains('[data-testid="generation-status-toast"] button', "Thử lại")
      .click();
    cy.contains('[data-testid="generation-status-toast"] button', "Dừng")
      .should("not.exist");
    cy.get("@retry").should("have.been.calledOnce");
  });

  it("allows retry when presentation generation stopped before the first slide", () => {
    cy.mount(
      <Harness
        surface="presentation"
        initialLifecycle="cancelled"
        draftCount={0}
      />,
    );

    cy.get('[data-testid="generation-status-toast"]')
      .should("contain", "Đã dừng tạo.");
    cy.contains('[data-testid="generation-status-toast"] button', "Thử lại")
      .should("exist");
  });

  it("continues to dismiss a cancelled outline toast", () => {
    cy.mount(<Harness surface="outline" initialLifecycle="cancelled" />);
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
        useState<GenerationLifecycleState>("failed");
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

  it("keeps the presentation stream retrying when the backend reports an error", () => {
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

    cy.get('[data-testid="generation-status-toast"]')
      .should("have.length", 1)
      .and("contain", "Đang kết nối lại luồng tạo bài thuyết trình");
    cy.get('[data-sonner-toast]').should("have.length", 1);
    cy.wrap(null).should(() => {
      expect(FakeEventSource.instances[0].closed).to.equal(true);
    });
  });

  it("keeps a single loading toast on PresentationPage after a backend error", () => {
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

    cy.get('[data-testid="generation-status-toast"]')
      .should("have.length", 1)
      .and("contain", "Đang kết nối lại luồng tạo bài thuyết trình");
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
  });

  it("reopens exactly one presentation stream after a user stop", () => {
    resetStreamFailureHarness();
    cy.window().then((win) => {
      win.history.replaceState({}, "", "/presentation?stream=true");
      win.EventSource = FakeEventSource as unknown as typeof EventSource;
    });
    mountStreamHarness(<StoppedPresentationStreamHarness />);

    cy.wrap(null).should(() => {
      expect(FakeEventSource.instances).to.have.length(1);
    });

    cy.contains('[data-testid="generation-status-toast"] button', "Dừng")
      .click();
    cy.wrap(null).should(() => {
      expect(FakeEventSource.instances[0].closed).to.equal(true);
    });
    cy.location("search").should("not.contain", "stream");

    cy.get('[data-testid="sync-stream-param"]').click();
    cy.get('[data-testid="generation-status-toast"]')
      .should("contain", "Đã dừng tạo.");

    cy.contains('[data-testid="generation-status-toast"] button', "Thử lại")
      .click();
    cy.wrap(null).should(() => {
      expect(FakeEventSource.instances).to.have.length(2);
      expect(FakeEventSource.instances[1].closed).to.equal(false);
    });
    cy.location("search").should("not.contain", "stream");
  });

  it("keeps a presentation retry open when the stream prop clears after retry", () => {
    resetStreamFailureHarness();
    cy.window().then((win) => {
      win.history.replaceState({}, "", "/presentation?stream=true");
      win.EventSource = FakeEventSource as unknown as typeof EventSource;
    });
    mountStreamHarness(<StoppedPresentationStreamHarness />);

    cy.wrap(null).should(() => {
      expect(FakeEventSource.instances).to.have.length(1);
    });

    cy.contains('[data-testid="generation-status-toast"] button', "Dừng")
      .click();
    cy.wrap(null).should(() => {
      expect(FakeEventSource.instances[0].closed).to.equal(true);
    });
    cy.get('[data-testid="generation-status-toast"]')
      .should("contain", "Đã dừng tạo.");

    cy.contains('[data-testid="generation-status-toast"] button', "Thử lại")
      .click();
    cy.wrap(null).should(() => {
      expect(FakeEventSource.instances).to.have.length(2);
      expect(FakeEventSource.instances[1].closed).to.equal(false);
    });

    cy.get('[data-testid="sync-stream-param"]').click();
    cy.wrap(null).should(() => {
      expect(FakeEventSource.instances[1].closed).to.equal(false);
    });
    cy.get('[data-testid="generation-status-toast"]')
      .should("exist")
      .and("contain", "Đang tạo bài thuyết trình của bạn");
  });
});
