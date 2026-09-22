import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("community route and client are removed", () => {
  assert.equal(
    existsSync(
      new URL(
        "../app/(presentation-generator)/(dashboard)/community/page.tsx",
        import.meta.url,
      ),
    ),
    false,
  );
  assert.equal(
    existsSync(
      new URL(
        "../app/(presentation-generator)/services/api/community.ts",
        import.meta.url,
      ),
    ),
    false,
  );
});

test("only document-aware rewrite remains in feature flags", () => {
  const source = read("lib/feature-flags.ts");
  assert.match(source, /documentAwareRewrite/);
  assert.doesNotMatch(
    source,
    /smartModeEnabled|communityEnabled|GSLIDE_FEATURE_SMART_MODE|GSLIDE_FEATURE_COMMUNITY/,
  );
});
