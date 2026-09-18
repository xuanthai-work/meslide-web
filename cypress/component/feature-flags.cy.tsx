import {
  FeatureFlagsProvider,
  useFeatureFlags,
} from "../../components/FeatureFlagsProvider";
import { resolveFeatureFlags } from "../../lib/feature-flags";

const FeatureFlagProbe = () => {
  const flags = useFeatureFlags();

  return (
    <output data-testid="feature-flags">
      {flags.smartModeEnabled ? "smart:on" : "smart:off"};
      {flags.communityEnabled ? "community:on" : "community:off"}
    </output>
  );
};

describe("retained feature lanes", () => {
  it("keeps both features disabled by default", () => {
    expect(resolveFeatureFlags({})).to.deep.equal({
      smartModeEnabled: false,
      communityEnabled: false,
      documentAwareRewrite: false,
    });
  });

  it("does not expose Community without Smart mode", () => {
    expect(
      resolveFeatureFlags({ GSLIDE_FEATURE_COMMUNITY: "true" }),
    ).to.deep.equal({
      smartModeEnabled: false,
      communityEnabled: false,
      documentAwareRewrite: false,
    });
  });

  it("runs with Smart and Community enabled", () => {
    const flags = resolveFeatureFlags({
      GSLIDE_FEATURE_SMART_MODE: "true",
      GSLIDE_FEATURE_COMMUNITY: "true",
    });

    cy.mount(
      <FeatureFlagsProvider value={flags}>
        <FeatureFlagProbe />
      </FeatureFlagsProvider>,
    );

    cy.get('[data-testid="feature-flags"]').should(
      "have.text",
      "smart:on;community:on",
    );
  });
});
