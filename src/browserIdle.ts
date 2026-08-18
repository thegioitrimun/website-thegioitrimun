interface DeferredTaskOptions {
  delayMs?: number;
  immediate?: boolean;
  timeout?: number;
}

type IdleWindow = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export function scheduleDeferredTask(
  task: () => void | Promise<void>,
  options: DeferredTaskOptions = {},
) {
  const idleWindow = typeof window !== 'undefined' ? (window as IdleWindow) : null;
  const { delayMs = 200, immediate = false, timeout = 1200 } = options;

  if (!idleWindow || immediate) {
    void Promise.resolve().then(task);
    return () => {};
  }

  let cancelled = false;
  let idleHandle: number | null = null;
  let timerHandle: number | null = null;

  const runTask = () => {
    if (cancelled) return;
    void Promise.resolve().then(task);
  };

  if (typeof idleWindow.requestIdleCallback === 'function' && typeof idleWindow.cancelIdleCallback === 'function') {
    idleHandle = idleWindow.requestIdleCallback(runTask, { timeout });
    return () => {
      cancelled = true;
      if (idleHandle !== null) {
        idleWindow.cancelIdleCallback?.(idleHandle);
      }
    };
  }

  timerHandle = window.setTimeout(runTask, delayMs);
  return () => {
    cancelled = true;
    if (timerHandle !== null) {
      window.clearTimeout(timerHandle);
    }
  };
}
