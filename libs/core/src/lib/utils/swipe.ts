export type SwipeTracker = {
  update(event: TouchEvent | MouseEvent): SwipeUpdateEvent;
  end(): SwipeEndEvent;
  cancel(): void;
};

export type SwipeEndEvent = {
  /**
   * Speed at the moment of release, measured over the trailing {@link SWIPE_VELOCITY_WINDOW_MS} of
   * the gesture - not the whole-gesture average. A slow drag that ends in a flick reports the
   * flick, and a flick that ends parked reports ~0.
   */
  positivePixelPerSecondX: number;
  positivePixelPerSecondY: number;
  pixelPerSecondX: number;
  pixelPerSecondY: number;
  movementX: number;
  movementY: number;
  positiveMovementX: number;
  positiveMovementY: number;
  originClientX: number;
  originClientY: number;
};

export type SwipeUpdateEvent = {
  originClientX: number;
  originClientY: number;
  timestamp: number;
  movementX: number;
  movementY: number;
  positiveMovementX: number;
  positiveMovementY: number;
  isScrolling: boolean;
  isSwiping: boolean;
};

const getClientXY = (event: TouchEvent | MouseEvent): { clientX: number; clientY: number } => {
  if (event.type[0] === 't') {
    const touch = (event as TouchEvent).targetTouches[0] ?? (event as TouchEvent).changedTouches[0];
    return touch ? { clientX: touch.clientX, clientY: touch.clientY } : { clientX: 0, clientY: 0 };
  }
  return { clientX: (event as MouseEvent).clientX, clientY: (event as MouseEvent).clientY };
};

/** Trailing window over which {@link SwipeTracker.end} measures the release velocity. */
export const SWIPE_VELOCITY_WINDOW_MS = 100;

type SwipeSample = { t: number; movementX: number; movementY: number };

export const createSwipeTracker = (startEvent: TouchEvent | MouseEvent): SwipeTracker => {
  const { clientX: originClientX, clientY: originClientY } = getClientXY(startEvent);
  const startTime = Date.now();

  let movementX = 0;
  let movementY = 0;
  let isSwiping = false;
  let isScrolling = false;

  /**
   * Recent positions, oldest first, used to derive the release velocity. Trimmed to the trailing
   * window plus the one sample just before it, which serves as that window's baseline.
   */
  let samples: SwipeSample[] = [{ t: startTime, movementX: 0, movementY: 0 }];

  const update = (event: TouchEvent | MouseEvent): SwipeUpdateEvent => {
    const { clientX, clientY } = getClientXY(event);
    movementX = clientX - originClientX;
    movementY = clientY - originClientY;

    const now = Date.now();
    samples.push({ t: now, movementX, movementY });

    // Trim against the newest sample rather than `now + window`: `end()` measures from its own
    // timestamp, which is never earlier, so this always keeps a superset of what it needs.
    const cutoff = now - SWIPE_VELOCITY_WINDOW_MS;
    let dropCount = 0;
    while (dropCount + 1 < samples.length && samples[dropCount + 1]!.t < cutoff) dropCount++;
    if (dropCount) samples = samples.slice(dropCount);

    const positiveMovementX = Math.abs(movementX);
    const positiveMovementY = Math.abs(movementY);

    if (!isSwiping && !isScrolling) {
      if (positiveMovementY > positiveMovementX) {
        isScrolling = true;
      } else {
        isSwiping = true;
      }
    }

    return {
      originClientX,
      originClientY,
      timestamp: startTime,
      movementX,
      movementY,
      positiveMovementX,
      positiveMovementY,
      isScrolling,
      isSwiping,
    };
  };

  const measureReleaseVelocity = (endTime: number) => {
    const windowStart = endTime - SWIPE_VELOCITY_WINDOW_MS;
    const firstInWindow = samples.findIndex((sample) => sample.t >= windowStart);

    // Nothing moved during the window: the pointer was held still before release, so the gesture
    // carries no momentum no matter how fast it started out.
    if (firstInWindow === -1) return { x: 0, y: 0 };

    const newest = samples[samples.length - 1]!;

    // Measure across the window when it holds a span of its own. With a single sample in it - a
    // pointer emitting moves slower than the window - reach back one sample for a baseline instead
    // of reporting nothing.
    const hasSpanInWindow = samples.length - firstInWindow >= 2;
    const baseline = samples[hasSpanInWindow ? firstInWindow : Math.max(0, firstInWindow - 1)]!;
    const elapsed = newest.t - baseline.t;

    if (elapsed <= 0) return { x: 0, y: 0 };

    return {
      x: ((newest.movementX - baseline.movementX) / elapsed) * 1000,
      y: ((newest.movementY - baseline.movementY) / elapsed) * 1000,
    };
  };

  const end = (): SwipeEndEvent => {
    const positiveMovementX = Math.abs(movementX);
    const positiveMovementY = Math.abs(movementY);
    const { x: pixelPerSecondX, y: pixelPerSecondY } = measureReleaseVelocity(Date.now());

    return {
      movementX,
      movementY,
      positiveMovementX,
      positiveMovementY,
      pixelPerSecondX,
      pixelPerSecondY,
      positivePixelPerSecondX: Math.abs(pixelPerSecondX),
      positivePixelPerSecondY: Math.abs(pixelPerSecondY),
      originClientX,
      originClientY,
    };
  };

  const cancel = (): void => {
    movementX = 0;
    movementY = 0;
    samples = [{ t: Date.now(), movementX: 0, movementY: 0 }];
  };

  return { update, end, cancel };
};
