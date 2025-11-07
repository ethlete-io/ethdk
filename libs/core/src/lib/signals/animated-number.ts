import { inject, isSignal, NgZone, signal, Signal, untracked } from '@angular/core';
import { MaybeSignal } from './signal-data-utils';

export type SignalAnimatedNumberOptions = {
  /**
   * The initial value to start animating from.
   * If not provided, the animation will start from 0
   */
  initialValue?: number;

  /**
   * Duration of the animation in milliseconds.
   * @default 1000
   */
  duration?: number;

  /**
   * Easing function that takes a progress value (0 to 1) and returns an eased value (0 to 1).
   * Options:
   * - `easeLinear()`
   * - `easeIn()`
   * - `easeOut()`
   * - `easeInOut()`
   * - `easeElastic()`
   * - `easeOutBack()`
   * - `easeOutBackStrong()`
   * @default easeOut()
   */
  easing?: (t: number) => number;

  /**
   * Function to round the animated value.
   * @default (v: number) => Math.round(v)
   */
  round?: (value: number) => number;

  /**
   * Callback invoked when the animation starts.
   */
  onAnimationStart?: () => void;

  /**
   * Callback invoked when the animation ends.
   */
  onAnimationEnd?: () => void;
};

export type AnimatedNumberSignal = Signal<number> & {
  /**
   * Starts the animation from the current value to the target value.
   * @returns The animated signal for chaining
   */
  play: () => AnimatedNumberSignal;

  /**
   * Resets the animation to the initial value and stops any ongoing animation.
   * @returns The animated signal for chaining
   */
  reset: () => AnimatedNumberSignal;

  /**
   * Stops the current animation at its current position.
   * @returns The animated signal for chaining
   */
  stop: () => AnimatedNumberSignal;
};

/**
 * Creates a signal that animates the transition of a numeric signal's value over time.
 */
export const signalAnimatedNumber = (
  source: MaybeSignal<number>,
  options: SignalAnimatedNumberOptions = {},
): AnimatedNumberSignal => {
  const ngZone = inject(NgZone);
  const duration = options.duration ?? 1000;
  const easing = options.easing ?? easeOut;
  const round = options.round ?? ((v: number) => Math.round(v));

  const initialValue = options.initialValue ?? 0;
  const animatedValue = signal(initialValue);

  let rafId: number | null = null;
  let currentAnimatedValue = initialValue;

  const cancelAnimation = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  const readonlySignal = animatedValue.asReadonly() as AnimatedNumberSignal;

  const play = () => {
    const targetValue = isSignal(source) ? source() : source;

    cancelAnimation();

    const startValue = currentAnimatedValue;
    const startTime = performance.now();
    const delta = targetValue - startValue;

    // Skip animation if no change
    if (delta === 0) {
      options.onAnimationEnd?.();
      return readonlySignal;
    }

    options.onAnimationStart?.();

    ngZone.runOutsideAngular(() => {
      const animate = (timestamp: number) => {
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easing(progress);

        const value = startValue + delta * easedProgress;
        currentAnimatedValue = value;

        untracked(() => {
          animatedValue.set(round(value));
        });

        if (progress < 1) {
          rafId = requestAnimationFrame(animate);
        } else {
          rafId = null;

          ngZone.run(() => {
            options.onAnimationEnd?.();
          });
        }
      };

      rafId = requestAnimationFrame(animate);
    });

    return readonlySignal;
  };

  const reset = () => {
    cancelAnimation();
    currentAnimatedValue = initialValue;
    animatedValue.set(initialValue);
    return readonlySignal;
  };

  const stop = () => {
    cancelAnimation();
    return readonlySignal;
  };

  readonlySignal.play = play;
  readonlySignal.reset = reset;
  readonlySignal.stop = stop;

  return readonlySignal;
};

/* Linear easing function */
export const easeLinear = (t: number) => t;

/* Ease in (slow start) */
export const easeIn = (t: number) => t * t;

/* Ease out (slow end) */
export const easeOut = (t: number) => t * (2 - t);

/* Ease in-out (slow start and end) */
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

/** Elastic easing function (overshoots) */
export const easeElastic = (t: number) => {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

/** Back easing function (overshoots slightly then settles) */
export const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/** Back easing function with more overshoot */
export const easeOutBackStrong = (t: number) => {
  const c1 = 2.5;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
