import {
  FeatureFlagsProvider,
  useFeatureFlags,
} from "../../components/FeatureFlagsProvider";
import { resolveFeatureFlags } from "../../lib/feature-flags";

const FeatureFlagProbe = () => {
  const flags = useFeatureFlags();

  return (
    <output data-testid="feature-flags">
      {flags.documentAwareRewrite ? "documents:on" : "documents:off"}
    </output>
  );
};

describe("feature flags", () => {
  it("keeps document-aware rewrite disabled by default", () => {
    expect(resolveFeatureFlags({})).to.deep.equal({
      documentAwareRewrite: false,
    });
  });

  it("resolves document-aware rewrite", () => {
    const flags = resolveFeatureFlags({
      GSLIDE_FEATURE_DOCUMENT_AWARE_REWRITE: "true",
    });

    cy.mount(
      <FeatureFlagsProvider value={flags}>
        <FeatureFlagProbe />
      </FeatureFlagsProvider>,
    );

    cy.get('[data-testid="feature-flags"]').should(
      "have.text",
      "documents:on",
    );
  });
});
