const FRAME_DURATION_MS = 16;

/**
 * A `requestAnimationFrame` that only runs when told to. A callback requested while a frame runs
 * waits for the next one, as it does in a browser.
 */
export const installFakeFrames = () => {
  const globals = globalThis as unknown as Window;
  const originalRequest = globals.requestAnimationFrame;
  const originalCancel = globals.cancelAnimationFrame;
  const windowRequest = window.requestAnimationFrame;
  const windowCancel = window.cancelAnimationFrame;

  let nextId = 1;
  let timestamp = 0;
  let queue = new Map<number, FrameRequestCallback>();

  const request = (callback: FrameRequestCallback) => {
    const id = nextId++;
    queue.set(id, callback);

    return id;
  };

  const cancel = (id: number) => {
    queue.delete(id);
  };

  globals.requestAnimationFrame = request;
  globals.cancelAnimationFrame = cancel;
  window.requestAnimationFrame = request;
  window.cancelAnimationFrame = cancel;

  return {
    pending: () => queue.size,
    run: () => {
      const batch = queue;
      queue = new Map();
      timestamp += FRAME_DURATION_MS;
      batch.forEach((callback) => callback(timestamp));

      return batch.size;
    },
    restore: () => {
      globals.requestAnimationFrame = originalRequest;
      globals.cancelAnimationFrame = originalCancel;
      window.requestAnimationFrame = windowRequest;
      window.cancelAnimationFrame = windowCancel;
    },
  };
};
