import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { collectHardcodedCopy } from "../scripts/check-i18n-hardcoded-copy.mjs";

test("localized UI files contain no unexplained hard-coded visible copy", async () => {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const findings = await collectHardcodedCopy(repositoryRoot);
  assert.deepEqual(findings, []);
});
