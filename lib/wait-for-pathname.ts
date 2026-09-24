export const NAVIGATION_WAIT_INTERVAL_MS = 500;
export const NAVIGATION_WAIT_TIMEOUT_MS = 10_000;

type TimerHandle = ReturnType<typeof setInterval>;

type PathnameWaitOptions = {
  getPathname: () => string;
  targetPathname: string;
  onDone: () => void;
  intervalMs?: number;
  timeoutMs?: number;
  setIntervalFn?: (callback: () => void, ms: number) => TimerHandle;
  clearIntervalFn?: (handle: TimerHandle) => void;
  setTimeoutFn?: (callback: () => void, ms: number) => TimerHandle;
  clearTimeoutFn?: (handle: TimerHandle) => void;
};

function defaultSetInterval(callback: () => void, ms: number): TimerHandle {
  return setInterval(callback, ms);
}

function defaultClearInterval(handle: TimerHandle): void {
  clearInterval(handle);
}

function defaultSetTimeout(callback: () => void, ms: number): TimerHandle {
  return setTimeout(callback, ms);
}

function defaultClearTimeout(handle: TimerHandle): void {
  clearTimeout(handle);
}

/** Poll until the browser lands on `targetPathname`, then stop. */
export function startPathnameWait(options: PathnameWaitOptions): () => void {
  const intervalMs = options.intervalMs ?? NAVIGATION_WAIT_INTERVAL_MS;
  const timeoutMs = options.timeoutMs ?? NAVIGATION_WAIT_TIMEOUT_MS;
  const setIntervalFn = options.setIntervalFn ?? defaultSetInterval;
  const clearIntervalFn = options.clearIntervalFn ?? defaultClearInterval;
  const setTimeoutFn = options.setTimeoutFn ?? defaultSetTimeout;
  const clearTimeoutFn = options.clearTimeoutFn ?? defaultClearTimeout;

  if (options.getPathname() === options.targetPathname) {
    options.onDone();
    return () => {};
  }

  let finished = false;
  const timers: { interval?: TimerHandle; timeout?: TimerHandle } = {};

  const stopTimers = () => {
    if (timers.interval !== undefined) clearIntervalFn(timers.interval);
    if (timers.timeout !== undefined) clearTimeoutFn(timers.timeout);
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    stopTimers();
    options.onDone();
  };

  timers.interval = setIntervalFn(() => {
    if (options.getPathname() === options.targetPathname) finish();
  }, intervalMs);
  timers.timeout = setTimeoutFn(finish, timeoutMs);

  return () => {
    if (finished) return;
    finished = true;
    stopTimers();
  };
}
