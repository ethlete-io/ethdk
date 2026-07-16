import { afterNextRender, DestroyRef, effect, ElementRef, inject, untracked } from '@angular/core';
import { injectRenderer } from '../providers/renderer';
import { buildElementSignal, firstElementSignal, SignalElementBindingType } from './element';
import { injectPrefersReducedMotion } from './media-queries';

export type AnimatedBlockSizeConfig = {
  /** The element whose `block-size` is animated. Defaults to the host `ElementRef`. */
  host?: SignalElementBindingType;
  /**
   * The content element(s) whose size changes drive the animation. Observe the content (children),
   * **not** the animated host — observing the host would feed the animation back into itself.
   */
  observe: SignalElementBindingType | SignalElementBindingType[];
  /** Animation duration in ms. @default 160 */
  duration?: number;
  /** Animation easing. @default 'ease' */
  easing?: string;
  /** Class toggled on the host while animating — use it to `overflow: clip` during the resize. */
  resizingClass?: string;
};

/**
 * Smoothly animates an element's `block-size` when its content changes size (e.g. a list filtering,
 * a loading state resolving). Set up once in an injection context; it observes the given content
 * element(s) and animates the host from its previous height to its new natural height.
 *
 * Robustness notes: the baseline height is captured on the first render (via `afterNextRender`) and
 * only later changes animate, so the initial layout settling never plays as a grow-from-0.
 * A change that interrupts an in-flight animation continues from the current animated height, and
 * zero/pre-layout measurements are ignored. Respects `prefers-reduced-motion`.
 *
 * The animation starts synchronously inside the `ResizeObserver` callback — it runs after layout
 * but **before paint**, so the host never paints a frame at its new natural size. Routing the
 * resize through a signal + effect instead would apply the animation one change-detection cycle
 * (= one painted frame) late: a growing panel would flash at its final size, snap back, and only
 * then animate.
 */
export const injectAnimatedBlockSize = (config: AnimatedBlockSizeConfig): void => {
  const hostBinding = config.host ?? inject(ElementRef);
  const renderer = injectRenderer();
  const prefersReducedMotion = injectPrefersReducedMotion();
  const destroyRef = inject(DestroyRef);

  const hostSignal = firstElementSignal(buildElementSignal(hostBinding));
  const observeTargets = Array.isArray(config.observe) ? config.observe : [config.observe];
  const observedElements = observeTargets.map((target) => firstElementSignal(buildElementSignal(target)));

  const duration = config.duration ?? 160;
  const easing = config.easing ?? 'ease';

  let lastBlockSize: number | null = null;
  let animation: Animation | null = null;
  let ready = false;

  const hostElement = () => hostSignal().currentElement;

  const run = () => {
    const host = hostElement();

    if (!host) return;

    // continue from the current animated height when interrupting a running animation
    const from = animation?.playState === 'running' ? host.getBoundingClientRect().height : lastBlockSize;

    animation?.cancel();
    animation = null;

    const to = host.getBoundingClientRect().height;

    // never record or animate a zero / pre-layout height
    if (to === 0) return;

    lastBlockSize = to;

    if (from === null || from < 1 || Math.abs(from - to) < 1 || prefersReducedMotion()) {
      return;
    }

    if (config.resizingClass && renderer) {
      renderer.addClass(host, config.resizingClass);
    }

    const nextAnimation = host.animate([{ blockSize: `${from}px` }, { blockSize: `${to}px` }], { duration, easing });

    const cleanup = () => {
      if (config.resizingClass && renderer) {
        renderer.removeClass(host, config.resizingClass);
      }

      if (animation === nextAnimation) {
        animation = null;
      }
    };

    nextAnimation.finished.then(cleanup).catch(cleanup);
    animation = nextAnimation;
  };

  // no zone/signal indirection — see the pre-paint timing note in the doc comment above
  const observer = new ResizeObserver(() => {
    if (!ready) return;

    run();
  });

  effect(() => {
    const elements = observedElements.map((element) => element().currentElement);

    untracked(() => {
      observer.disconnect();

      for (const element of elements) {
        if (element) {
          observer.observe(element);
        }
      }
    });
  });

  // Capture the settled height of the first render as the baseline, then only animate later changes.
  afterNextRender(() => {
    const host = hostElement();

    lastBlockSize = host ? host.getBoundingClientRect().height || null : null;
    ready = true;
  });

  destroyRef.onDestroy(() => {
    observer.disconnect();
    animation?.cancel();
  });
};
