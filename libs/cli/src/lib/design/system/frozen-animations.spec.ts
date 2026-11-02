// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { freezeAnimationsScriptOf, frozenAnimationsOf } from './frozen-animations';

const SPINNER_MOCK =
  '<div class="et-button-loader"><et-spinner class="et-spinner et-spinner--indeterminate" data-et-frozen-at style="--et-spinner-size: 14px; --et-spinner-frozen-at: 0.3"><div class="et-spinner-layer"></div></et-spinner></div>';

describe('frozenAnimationsOf', () => {
  it('reads the block and fraction of each frozen loader mock, in document order', () => {
    const markup = `${SPINNER_MOCK}<div class="et-progress-bar" data-et-frozen-at style="--et-progress-bar-frozen-at: 0.62"></div>`;

    expect(frozenAnimationsOf(markup)).toEqual([
      { block: 'et-spinner', at: 0.3 },
      { block: 'et-progress-bar', at: 0.62 },
    ]);
  });

  it('ignores a frozen-at variable on an element without the marker or its block class', () => {
    expect(frozenAnimationsOf('<div class="et-spinner" style="--et-spinner-frozen-at: 0.3"></div>')).toEqual([]);
    expect(
      frozenAnimationsOf('<div class="other" data-et-frozen-at style="--et-spinner-frozen-at: 0.3"></div>'),
    ).toEqual([]);
  });
});

type FakeAnimation = { currentTime: number; playbackRate: number; pause: () => void; effect: unknown };

const animationOf = (timing: { iterations: number; duration: number; delay?: number }): FakeAnimation => ({
  currentTime: 123,
  playbackRate: 1,
  pause: vi.fn(),
  effect: { getComputedTiming: () => ({ delay: 0, ...timing }) },
});

describe('freezeAnimationsScriptOf', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('holds each infinite animation of the block at the fraction of its duration, with a playback rate of 0', () => {
    document.body.innerHTML = '<et-spinner class="et-spinner" style="--et-spinner-duration: 1333ms"></et-spinner>';

    const spin = animationOf({ iterations: Infinity, duration: 1333 * 4, delay: 50 });
    const finite = animationOf({ iterations: 1, duration: 200 });

    Object.defineProperty(HTMLElement.prototype, 'getAnimations', {
      configurable: true,
      value: () => [spin, finite],
    });

    new Function(freezeAnimationsScriptOf([{ block: 'et-spinner', at: 0.3 }]))();

    expect(spin.pause).toHaveBeenCalled();
    expect(spin.currentTime).toBeCloseTo(0.3 * 1333 + 50);
    expect(spin.playbackRate).toBe(0);
    expect(finite.currentTime).toBe(123);
    expect(finite.playbackRate).toBe(1);
  });

  it('falls back to the private duration variable, then to the animation duration', () => {
    document.body.innerHTML =
      '<div class="et-brand-loader" style="--_et-brand-loader-duration: 3.2s"></div><div class="et-progress-bar"></div>';

    const brand = animationOf({ iterations: Infinity, duration: 9999 });
    const bar = animationOf({ iterations: Infinity, duration: 2000 });

    Object.defineProperty(HTMLElement.prototype, 'getAnimations', {
      configurable: true,
      value(this: HTMLElement) {
        return this.classList.contains('et-brand-loader') ? [brand] : [bar];
      },
    });

    new Function(
      freezeAnimationsScriptOf([
        { block: 'et-brand-loader', at: 0.5 },
        { block: 'et-progress-bar', at: 0.25 },
      ]),
    )();

    expect(brand.currentTime).toBeCloseTo(1600);
    expect(bar.currentTime).toBeCloseTo(500);
  });
});
