import { ComponentFixture } from '@angular/core/testing';

export type DestroyedMidGestureOptions = {
  /** The fixture the gesture belongs to. {@link expectNothingRunsAfterDestroy} destroys it. */
  fixture: ComponentFixture<unknown>;
  /**
   * Runs the gesture up to the point where it is live. It has to schedule an animation frame or add a
   * listener to a watched target, or the assertion throws instead of passing.
   */
  start: () => void | Promise<void>;
  /** Drives the started gesture further, still before the destroy. */
  settle?: () => void | Promise<void>;
  /** Event targets to watch for leaked listeners, on top of `document` and `window`. */
  targets?: EventTarget[];
};

/** The activity the assertion found running at the moment it destroyed the fixture. */
export type MidGestureActivity = {
  framesRun: number;
  framesScheduled: number;
  listenerCalls: number;
  listenersRegistered: number;
};

type Registration = { target: EventTarget; type: string };

const once = (restore: () => void) => {
  let restored = false;

  return () => {
    if (restored) return;

    restored = true;
    restore();
  };
};

const installProperty = (holder: object, property: string, value: unknown) => {
  const original = Object.getOwnPropertyDescriptor(holder, property);

  Object.defineProperty(holder, property, { configurable: true, value, writable: true });

  return () => {
    if (original) Object.defineProperty(holder, property, original);
    else Reflect.deleteProperty(holder, property);
  };
};

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const recordFrames = () => {
  const original = globalThis.requestAnimationFrame;
  const errors: string[] = [];
  let scheduled = 0;
  let run = 0;

  const patched = (callback: FrameRequestCallback) => {
    scheduled++;

    return original.call(globalThis, (time) => {
      run++;

      try {
        callback(time);
      } catch (error) {
        errors.push(messageOf(error));
      }
    });
  };

  const restore = once(installProperty(globalThis, 'requestAnimationFrame', patched));

  return {
    errors,
    restore,
    run: () => run,
    scheduled: () => scheduled,
    // Flushing through the captured original, never through the patched global or `flushFrames`: the
    // recorder must not count the frames it spends looking for leaked ones.
    flush: () =>
      new Promise<void>((resolve) => original.call(globalThis, () => void original.call(globalThis, () => resolve()))),
  };
};

const recordListeners = (targets: EventTarget[]) => {
  const registrations: Registration[] = [];
  const wrappers = new Map<EventListenerOrEventListenerObject, EventListener>();
  const restores: (() => void)[] = [];
  let calls = 0;

  const wrapperFor = (listener: EventListenerOrEventListenerObject) => {
    const existing = wrappers.get(listener);

    if (existing) return existing;

    const wrapper: EventListener = function (this: EventTarget, event: Event) {
      calls++;

      if (typeof listener === 'function') listener.call(this, event);
      else listener.handleEvent(event);
    };

    wrappers.set(listener, wrapper);

    return wrapper;
  };

  for (const target of targets) {
    const add = target.addEventListener.bind(target);
    const remove = target.removeEventListener.bind(target);

    restores.push(
      installProperty(
        target,
        'addEventListener',
        (type: string, listener: EventListenerOrEventListenerObject | null, options?: unknown) => {
          if (!listener) return;

          registrations.push({ target, type });
          add(type, wrapperFor(listener), options as AddEventListenerOptions);
        },
      ),
      installProperty(
        target,
        'removeEventListener',
        (type: string, listener: EventListenerOrEventListenerObject | null, options?: unknown) => {
          if (!listener) return;

          remove(type, wrappers.get(listener) ?? listener, options as EventListenerOptions);
        },
      ),
    );
  }

  const restore = once(() => restores.forEach((entry) => entry()));

  return {
    registrations,
    restore,
    calls: () => calls,
    refireRegisteredEvents: () => {
      const fired = new Map<EventTarget, Set<string>>();

      for (const { target, type } of registrations) {
        const types = fired.get(target) ?? new Set<string>();

        if (types.has(type)) continue;

        types.add(type);
        fired.set(target, types);
        target.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
      }
    },
  };
};

/**
 * Destroys `fixture` in the middle of the gesture `start` began, and asserts the gesture left nothing
 * behind: no animation frame runs afterwards, and no listener it added still fires.
 *
 * A gesture outlives its component in two ways, and this covers both - a `requestAnimationFrame` loop
 * that re-schedules itself, and a document listener that was never unsubscribed. Both are recorded from
 * the moment `start` runs, so listeners the component registered while it was being built are none of
 * this assertion's business.
 *
 * It **throws** rather than passing when the gesture scheduled no frame and added no listener before the
 * destroy: "nothing ran after the destroy" is also true of a gesture that never ran at all, and a green
 * assertion on a gesture that never started is worse than no assertion. So it fails loudly instead.
 *
 * Returns what was running when the fixture was destroyed, for a caller that wants to assert the
 * gesture reached a particular depth.
 */
export const expectNothingRunsAfterDestroy = async ({
  fixture,
  start,
  settle,
  targets = [],
}: DestroyedMidGestureOptions): Promise<MidGestureActivity> => {
  const frames = recordFrames();
  const listeners = recordListeners([document, window, ...targets]);

  try {
    await start();
    await settle?.();
    await frames.flush();
    await frames.flush();

    const errorsBefore = frames.errors.length;
    const activity: MidGestureActivity = {
      framesRun: frames.run(),
      framesScheduled: frames.scheduled(),
      listenerCalls: listeners.calls(),
      listenersRegistered: listeners.registrations.length,
    };

    if (activity.framesScheduled === 0 && activity.listenersRegistered === 0) {
      throw new Error(
        'expectNothingRunsAfterDestroy: `start` scheduled no animation frame and added no listener, so ' +
          'there is no gesture for the destroy to interrupt and the assertion would pass vacuously. Drive ' +
          'the gesture until it is running, and pass any element it listens on via `targets`.',
      );
    }

    fixture.destroy();

    await frames.flush();
    await frames.flush();
    listeners.refireRegisteredEvents();
    await frames.flush();

    expect({
      errorsAfterDestroy: frames.errors.slice(errorsBefore),
      framesAfterDestroy: frames.run() - activity.framesRun,
      listenerCallsAfterDestroy: listeners.calls() - activity.listenerCalls,
    }).toEqual({ errorsAfterDestroy: [], framesAfterDestroy: 0, listenerCallsAfterDestroy: 0 });

    return activity;
  } finally {
    frames.restore();
    listeners.restore();
  }
};
