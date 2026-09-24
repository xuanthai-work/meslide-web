import assert from "node:assert/strict";
import test from "node:test";

import {
  acknowledgeSavedSlide,
  createAutoSaveSnapshot,
  getAutoSaveChanges,
  nextAutoSaveTick,
  queueAutoSaveTimer,
} from "../app/(presentation-generator)/presentation/utils/autoSaveDiff.ts";
import reducer, {
  addToHistory,
  redo,
  undo,
} from "../store/slices/undoRedoSlice.ts";

function slide(id, index, text) {
  return {
    id,
    index,
    content: { title: text },
  };
}

function deck(slides, extra = {}) {
  return {
    id: "deck-1",
    language: "vi",
    layout: null,
    n_slides: slides.length,
    title: "Deck",
    slides,
    theme: null,
    ...extra,
  };
}

test("autosave treats reorder and index fixes as structural, and a text edit as one slide", () => {
  const original = deck([slide("a", 0, "A"), slide("b", 1, "B")]);
  const snapshot = createAutoSaveSnapshot(original);

  const edited = deck([slide("a", 0, "A"), slide("b", 1, "B2")]);
  const editChanges = getAutoSaveChanges(snapshot, edited);
  assert.equal(editChanges.structuralChange, false);
  assert.equal(editChanges.metadataChanged, false);
  assert.deepEqual(editChanges.changedSlides.map((item) => item.id), ["b"]);

  const reordered = deck([slide("b", 0, "B"), slide("a", 1, "A")]);
  const reorderChanges = getAutoSaveChanges(snapshot, reordered);
  assert.equal(reorderChanges.structuralChange, true);
  assert.deepEqual(reorderChanges.changedSlides, []);

  const reindexed = deck([slide("a", 1, "A"), slide("b", 0, "B")]);
  assert.equal(getAutoSaveChanges(snapshot, reindexed).structuralChange, true);

  const renamed = deck([slide("a", 0, "A"), slide("b", 1, "B")], { title: "Renamed" });
  const metadata = getAutoSaveChanges(snapshot, renamed);
  assert.equal(metadata.metadataChanged, true);
  assert.equal(metadata.structuralChange, false);
  assert.deepEqual(metadata.changedSlides, []);

  const failed = getAutoSaveChanges(snapshot, reordered);
  assert.equal(failed.structuralChange, true);

  const partial = acknowledgeSavedSlide(snapshot, edited.slides[1]);
  assert.deepEqual(getAutoSaveChanges(partial, edited).changedSlides, []);
  assert.deepEqual(
    getAutoSaveChanges(acknowledgeSavedSlide(snapshot, edited.slides[0]), edited).changedSlides.map((item) => item.id),
    ["b"],
  );
});

test("autosave waits out a pause, a presentation switch, and rapid edits", () => {
  const first = deck([slide("a", 0, "A")]);
  const paused = nextAutoSaveTick({
    data: first,
    paused: true,
    wasPaused: false,
    saving: false,
    acknowledged: null,
  });
  assert.equal(paused.tick.kind, "paused");
  assert.equal(paused.tick.recordHistory, false);
  assert.equal(paused.wasPaused, true);

  const resumed = nextAutoSaveTick({
    data: first,
    paused: false,
    wasPaused: true,
    saving: false,
    acknowledged: paused.tick.snapshot,
  });
  assert.equal(resumed.tick.kind, "resumed");
  assert.equal(resumed.tick.recordHistory, true);
  assert.equal(resumed.wasPaused, false);

  const switched = nextAutoSaveTick({
    data: deck([slide("a", 0, "A")], { id: "deck-2" }),
    paused: false,
    wasPaused: false,
    saving: false,
    acknowledged: createAutoSaveSnapshot(first),
  });
  assert.equal(switched.tick.kind, "baseline");
  assert.equal(switched.tick.snapshot.presentationId, "deck-2");

  const scheduled = nextAutoSaveTick({
    data: deck([slide("a", 0, "A2")]),
    paused: false,
    wasPaused: false,
    saving: false,
    acknowledged: createAutoSaveSnapshot(first),
  });
  assert.equal(scheduled.tick.kind, "schedule");

  const timers = [];
  const cleared = [];
  const firstTimer = queueAutoSaveTimer(null, 1000, () => timers.push("first"), {
    set(callback, waitMs) {
      const timer = { callback, waitMs, id: timers.length + 1 };
      timers.push(timer);
      return timer;
    },
    clear(timer) {
      cleared.push(timer.id);
    },
  });
  const secondTimer = queueAutoSaveTimer(firstTimer, 1000, () => timers.push("second"), {
    set(callback, waitMs) {
      const timer = { callback, waitMs, id: 2 };
      timers.push(timer);
      return timer;
    },
    clear(timer) {
      cleared.push(timer.id);
    },
  });
  assert.deepEqual(cleared, [1]);
  assert.equal(secondTimer.waitMs, 1000);
  secondTimer.callback();
  assert.equal(timers.includes("first"), false);
  assert.equal(timers.at(-1), "second");
});

test("undo keeps thirty snapshots, skips the restore, and redo returns the edit", () => {
  let state = reducer(undefined, { type: "init" });
  const decks = Array.from({ length: 32 }, (_, index) => [slide(`s${index}`, 0, `t${index}`)]);
  for (const slides of decks) {
    state = reducer(state, addToHistory({ slides, actionType: "AUTO_SAVE" }));
  }
  assert.equal(state.past.length, 30);
  assert.equal(state.present.slides[0].id, "s31");

  const sameSlides = state.present.slides;
  const before = state.past.length;
  state = reducer(state, addToHistory({ slides: sameSlides, actionType: "AUTO_SAVE" }));
  assert.equal(state.past.length, before);

  state = reducer(state, undo());
  assert.equal(state.present.slides[0].id, "s30");
  assert.equal(state.future[0].slides[0].id, "s31");
  assert.equal(state.pendingHistorySkips, 1);

  state = reducer(state, addToHistory({ slides: state.present.slides, actionType: "AUTO_SAVE" }));
  assert.equal(state.present.slides[0].id, "s30");
  assert.equal(state.pendingHistorySkips, 0);
  assert.equal(state.future.length, 1);

  state = reducer(state, redo());
  assert.equal(state.present.slides[0].id, "s31");
  state = reducer(state, addToHistory({ slides: state.present.slides, actionType: "AUTO_SAVE" }));
  state = reducer(state, undo());
  state = reducer(state, addToHistory({ slides: state.present.slides, actionType: "AUTO_SAVE" }));
  state = reducer(state, addToHistory({ slides: [slide("fresh", 0, "y")], actionType: "AUTO_SAVE" }));
  assert.equal(state.future.length, 0);
  assert.equal(state.present.slides[0].id, "fresh");
});

test("fingerprinting two hundred slides stays bounded and sees one edit", () => {
  const slides = Array.from({ length: 200 }, (_, index) => slide(`s${index}`, index, `title ${index}`));
  const started = Date.now();
  const snapshot = createAutoSaveSnapshot(deck(slides));
  const edited = slides.map((item, index) => (index === 199 ? slide(item.id, index, "changed") : item));
  const changes = getAutoSaveChanges(snapshot, deck(edited));
  const elapsed = Date.now() - started;
  assert.equal(changes.structuralChange, false);
  assert.deepEqual(changes.changedSlides.map((item) => item.id), ["s199"]);
  assert.ok(elapsed < 1000, `fingerprint took ${elapsed}ms`);
});
