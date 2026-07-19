import { afterNextRender, DestroyRef, effect, ElementRef, inject, isSignal, Signal, untracked } from '@angular/core';
import { injectRenderer } from '../providers/renderer';
import { buildElementSignal, firstElementSignal, SignalElementBindingType } from './element';
import { injectPrefersReducedMotion } from './media-queries';

export type AnimatedSizeAxis = 'block' | 'inline';

export type AnimatedBlockSizeConfig = {
  /** The element whose size is animated. Defaults to the host `ElementRef`. */
  host?: SignalElementBindingType;
  /**
   * The content element(s) whose size changes drive the animation. Observe the content (children),
   * **not** the animated host — observing the host would feed the animation back into itself.
   * For the `inline` axis this also means the observed content must be content-sized (e.g.
   * `inline-size: max-content`); a plain block child just mirrors the host's animated width back.
   */
  observe: SignalElementBindingType | SignalElementBindingType[];
  /**
   * The axes to animate. May be a signal — e.g. to drop the `inline` axis while a panel is in a
   * presentation whose width follows the viewport instead of its content. @default ['block']
   */
  axes?: AnimatedSizeAxis[] | Signal<AnimatedSizeAxis[]>;
  /** Animation duration in ms. @default 160 */
  duration?: number;
  /** Animation easing. @default 'ease' */
  easing?: string;
  /** Class toggled on the host while animating — use it to `overflow: clip` during the resize. */
  resizingClass?: string;
};

/**
 * Smoothly animates an element's `block-size` (and optionally `inline-size`, via `axes`) when its
 * content changes size (e.g. a list filtering, a loading state resolving, a column being added).
 * Set up once in an injection context; it observes the given content element(s) and animates the
 * host from its previous size to its new natural size.
 *
 * Robustness notes: the baseline size is captured on the first render (via `afterNextRender`) and
 * only later changes animate, so the initial layout settling never plays as a grow-from-0.
 * A change that interrupts an in-flight animation continues from the current animated size, and
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
  const axes = () => (isSignal(config.axes) ? untracked(config.axes) : (config.axes ?? ['block']));

  let lastBlockSize: number | null = null;
  let lastInlineSize: number | null = null;
  let animation: Animation | null = null;
  let ready = false;

  const hostElement = () => hostSignal().currentElement;

  const run = () => {
    const host = hostElement();

    if (!host) return;

    // continue from the current animated size when interrupting a running animation
    const currentRect = animation?.playState === 'running' ? host.getBoundingClientRect() : null;
    const fromBlock = currentRect ? currentRect.height : lastBlockSize;
    const fromInline = currentRect ? currentRect.width : lastInlineSize;

    animation?.cancel();
    animation = null;

    const targetRect = host.getBoundingClientRect();
    const toBlock = targetRect.height;
    const toInline = targetRect.width;

    // never record or animate a zero / pre-layout size
    if (toBlock === 0 || toInline === 0) return;

    lastBlockSize = toBlock;
    lastInlineSize = toInline;

    if (prefersReducedMotion()) {
      return;
    }

    const activeAxes = axes();
    const animatesAxis = (from: number | null, to: number) => from !== null && from >= 1 && Math.abs(from - to) >= 1;
    const animateBlock = activeAxes.includes('block') && animatesAxis(fromBlock, toBlock);
    const animateInline = activeAxes.includes('inline') && animatesAxis(fromInline, toInline);

    if (!animateBlock && !animateInline) {
      return;
    }

    if (config.resizingClass && renderer) {
      renderer.addClass(host, config.resizingClass);
    }

    const fromFrame: Keyframe = {};
    const toFrame: Keyframe = {};

    if (animateBlock) {
      fromFrame['blockSize'] = `${fromBlock}px`;
      toFrame['blockSize'] = `${toBlock}px`;
    }

    if (animateInline) {
      fromFrame['inlineSize'] = `${fromInline}px`;
      toFrame['inlineSize'] = `${toInline}px`;
    }

    const nextAnimation = host.animate([fromFrame, toFrame], { duration, easing });

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

  // Capture the settled size of the first render as the baseline, then only animate later changes.
  afterNextRender(() => {
    const host = hostElement();
    const rect = host ? host.getBoundingClientRect() : null;

    lastBlockSize = rect ? rect.height || null : null;
    lastInlineSize = rect ? rect.width || null : null;
    ready = true;
  });

  destroyRef.onDestroy(() => {
    observer.disconnect();
    animation?.cancel();
  });
};
