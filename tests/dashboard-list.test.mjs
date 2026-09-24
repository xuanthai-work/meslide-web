import assert from "node:assert/strict";
import test from "node:test";

import {
  presentationDeletePath,
  presentationDuplicatePath,
  presentationsListPath,
  removePresentationsById,
  sortPresentationsNewestFirst,
} from "../app/(presentation-generator)/services/api/dashboard-list.ts";

test("dashboard lists V2 decks and V1 decks without slide payloads", () => {
  assert.equal(
    presentationsListPath("v2-standard"),
    "/api/v1/ppt/presentation/all?version=v2-standard",
  );
  assert.equal(
    presentationsListPath("v1-standard", { includeSlides: false }),
    "/api/v1/ppt/presentation/all?version=v1-standard&include_slides=false",
  );
  assert.equal(presentationsListPath(), "/api/v1/ppt/presentation/all");
});

test("dashboard sorts newest created decks first and keeps invalid dates last", () => {
  const decks = [
    { id: "old", created_at: "2024-01-01T00:00:00.000Z", version: "v2-standard" },
    { id: "new", created_at: "2026-03-01T00:00:00.000Z", version: "v2-standard" },
    { id: "bad", created_at: "not-a-date", version: "v1-standard" },
  ];
  assert.deepEqual(
    sortPresentationsNewestFirst(decks).map((deck) => deck.id),
    ["new", "old", "bad"],
  );
  assert.deepEqual(decks.map((deck) => deck.id), ["old", "new", "bad"]);
  assert.deepEqual(sortPresentationsNewestFirst([]), []);
});

test("deleting a deck removes it from the list and keeps the request paths", () => {
  const decks = [
    { id: "keep", created_at: "2026-01-01T00:00:00.000Z" },
    { id: "gone", created_at: "2026-02-01T00:00:00.000Z" },
  ];
  assert.deepEqual(
    removePresentationsById(decks, ["gone"]).map((deck) => deck.id),
    ["keep"],
  );
  assert.equal(decks.length, 2);
  assert.equal(presentationDeletePath("gone"), "/api/v1/ppt/presentation/gone");
  assert.equal(
    presentationDuplicatePath("keep"),
    "/api/v1/ppt/presentation/keep/duplicate",
  );
});
