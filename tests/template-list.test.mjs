import assert from "node:assert/strict";
import test from "node:test";

import {
  TEMPLATE_SUMMARY_POLL_MS,
  filterTemplatesWithLayouts,
  orderBuiltInTemplates,
  processingTemplateTasksPath,
  shouldRefreshTemplatesAfterPoll,
  splitTemplatesByDefault,
  templateClonePath,
  templateDeletePath,
  templateDetailsPath,
  templateSummariesPath,
} from "../app/(presentation-generator)/services/api/template-list.ts";

test("template list requests keep the current default and custom queries", () => {
  assert.equal(
    templateSummariesPath(true),
    "/api/v1/ppt/template/all?page_size=100&default=true",
  );
  assert.equal(
    templateSummariesPath(false),
    "/api/v1/ppt/template/all?page_size=100&default=false",
  );
  assert.equal(templateDetailsPath("template-v2-abc/def"), "/api/v1/ppt/template/abc%2Fdef");
  assert.equal(templateDeletePath("my template"), "/api/v1/ppt/template/my%20template");
  assert.equal(templateClonePath(), "/api/v1/ppt/template/clone");
  assert.equal(TEMPLATE_SUMMARY_POLL_MS, 30_000);

  const tasks = new URL(processingTemplateTasksPath(new Date("2026-01-01T00:00:00.000Z")), "http://local");
  assert.equal(tasks.pathname, "/api/v1/async-tasks");
  assert.equal(tasks.searchParams.get("type"), "template.create");
  assert.equal(tasks.searchParams.get("status"), "pending");
  assert.equal(tasks.searchParams.get("created_at"), "2026-01-01T00:00:00.000Z");
});

test("built-in templates keep the featured order and empty layouts stay hidden", () => {
  const templates = [
    { name: "Other", is_default: true, layout_count: 2 },
    { name: "Executive", is_default: true, layout_count: 1 },
    { name: "momentum", is_default: true, layout_count: null },
    { name: "dynamic", is_default: true, layout_count: 0 },
    { name: "Mine", is_default: false, layout_count: 3 },
  ];
  const visible = filterTemplatesWithLayouts(templates);
  assert.deepEqual(visible.map((template) => template.name), ["Other", "Executive", "momentum", "Mine"]);

  const split = splitTemplatesByDefault(visible);
  assert.deepEqual(split.defaultTemplates.map((template) => template.name), ["momentum", "Executive", "Other"]);
  assert.deepEqual(split.customTemplates.map((template) => template.name), ["Mine"]);
  assert.deepEqual(
    orderBuiltInTemplates([{ name: "  Dynamic " }, { name: "momentum" }]).map((template) => template.name),
    ["momentum", "  Dynamic "],
  );
});

test("the template poll reloads while a task is active and once after it finishes", () => {
  assert.equal(shouldRefreshTemplatesAfterPoll(false, 0), false);
  assert.equal(shouldRefreshTemplatesAfterPoll(false, 2), true);
  assert.equal(shouldRefreshTemplatesAfterPoll(true, 0), true);
  assert.equal(shouldRefreshTemplatesAfterPoll(true, 1), true);
});
