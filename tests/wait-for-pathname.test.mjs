import assert from "node:assert/strict";
import test from "node:test";

import {
  NAVIGATION_WAIT_INTERVAL_MS,
  NAVIGATION_WAIT_TIMEOUT_MS,
  startPathnameWait,
} from "../lib/wait-for-pathname.ts";

function fakeTimers() {
  const intervals = [];
  const timeouts = [];
  return {
    intervals,
    timeouts,
    setIntervalFn(callback, ms) {
      intervals.push({ callback, ms, cleared: false });
      return intervals.length;
    },
    clearIntervalFn(handle) {
      intervals[handle - 1].cleared = true;
    },
    setTimeoutFn(callback, ms) {
      timeouts.push({ callback, ms, cleared: false });
      return timeouts.length;
    },
    clearTimeoutFn(handle) {
      timeouts[handle - 1].cleared = true;
    },
  };
}

test("finishes immediately when the pathname already matches", () => {
  let done = 0;
  const cancel = startPathnameWait({
    getPathname: () => "/dashboard",
    targetPathname: "/dashboard",
    onDone: () => {
      done += 1;
    },
    setIntervalFn() {
      throw new Error("interval should not start");
    },
  });

  assert.equal(done, 1);
  cancel();
  assert.equal(done, 1);
});

test("stops polling on match, timeout, and cancel", () => {
  const timers = fakeTimers();
  let path = "/login";
  let done = 0;
  const cancel = startPathnameWait({
    getPathname: () => path,
    targetPathname: "/dashboard",
    onDone: () => {
      done += 1;
    },
    ...timers,
  });

  assert.equal(timers.intervals[0].ms, NAVIGATION_WAIT_INTERVAL_MS);
  assert.equal(timers.timeouts[0].ms, NAVIGATION_WAIT_TIMEOUT_MS);

  path = "/dashboard";
  timers.intervals[0].callback();
  assert.equal(done, 1);
  assert.equal(timers.intervals[0].cleared, true);
  assert.equal(timers.timeouts[0].cleared, true);

  timers.intervals[0].callback();
  assert.equal(done, 1);

  const second = fakeTimers();
  let secondDone = 0;
  const cancelSecond = startPathnameWait({
    getPathname: () => "/login",
    targetPathname: "/dashboard",
    onDone: () => {
      secondDone += 1;
    },
    ...second,
  });
  cancelSecond();
  assert.equal(secondDone, 0);
  assert.equal(second.intervals[0].cleared, true);
  second.timeouts[0].callback();
  assert.equal(secondDone, 0);

  const third = fakeTimers();
  let thirdDone = 0;
  startPathnameWait({
    getPathname: () => "/login",
    targetPathname: "/dashboard",
    onDone: () => {
      thirdDone += 1;
    },
    ...third,
  });
  third.timeouts[0].callback();
  assert.equal(thirdDone, 1);
  assert.equal(third.intervals[0].cleared, true);

  assert.equal(typeof cancel, "function");
});
