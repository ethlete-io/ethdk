import { ApplicationRef, DOCUMENT, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { injectRenderer } from '@ethlete/core';
import '../../../test-helpers';
import {
  FullscreenAnimationDeps,
  cleanupFullscreenAnimation,
  startFullscreenEnterAnimation,
  startFullscreenLeaveAnimation,
} from './fullscreen-animation';
import { OverlayStrategyContext } from './overlay-strategy.types';

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

describe('fullscreen leave animation', () => {
  let containerEl: HTMLElement;
  let deps: FullscreenAnimationDeps;
  let leave: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    containerEl = document.createElement('div');
    document.body.appendChild(containerEl);
    leave = vi.fn();

    deps = TestBed.runInInjectionContext(() => ({
      injector: TestBed.inject(EnvironmentInjector),
      document: TestBed.inject(DOCUMENT),
      appRef: TestBed.inject(ApplicationRef),
      renderer: injectRenderer(),
    }));
  });

  afterEach(() => containerEl.remove());

  const leaveFrom = (originElement: HTMLElement) =>
    startFullscreenLeaveAnimation({
      context: {
        containerEl,
        lifecycle: { leave, state$: { value: 'entered' } },
      } as unknown as OverlayStrategyContext,
      state: { originElement, cloneComponentRef: null, subscriptions: [], isOriginHidden: false },
      deps,
      applyTransformOrigin: true,
    });

  it.each([
    ['detached', () => document.createElement('button')],
    ['without a layout box', () => document.body.appendChild(document.createElement('button'))],
  ])('shrinks to the centre when the origin is %s', (_, createOrigin) => {
    const origin = createOrigin();
    const state = leaveFrom(origin);

    expect(state.cloneComponentRef).toBeNull();
    expect(containerEl.classList).toContain('et-overlay--full-screen-dialog--reduced-animation');
    expect(containerEl.style.transformOrigin).toBe('center center');
    expect(containerEl.getAttribute('style')).not.toContain('Infinity');
    expect(leave).toHaveBeenCalledTimes(1);

    origin.remove();
  });

  describe('with an origin that has a layout box', () => {
    let origin: HTMLButtonElement;

    const createContext = () =>
      ({
        containerEl,
        lifecycle: { enter: vi.fn(), forceEnteredState: vi.fn(), leave, state$: { value: 'entered' } },
      }) as unknown as OverlayStrategyContext;

    const enter = (context: OverlayStrategyContext, skipAnimation: boolean) =>
      startFullscreenEnterAnimation({
        context: { ...context, origin } as OverlayStrategyContext,
        deps,
        applyTransformOrigin: true,
        skipAnimation,
      });

    beforeEach(() => {
      origin = document.body.appendChild(document.createElement('button'));
      origin.style.transition = 'opacity 1s';
      vi.spyOn(origin, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 20, 100, 40));
    });

    afterEach(() => origin.remove());

    it('keeps the origin visible when the overlay closes before its first enter frame', () => {
      const context = createContext();
      const state = enter(context, false);

      const leaveState = startFullscreenLeaveAnimation({ context, state, deps, applyTransformOrigin: true });

      expect(leaveState.isOriginHidden).toBe(false);
      expect(origin.style.opacity).toBe('');
      expect(origin.hasAttribute('data-et-origin-hidden-count')).toBe(false);
    });

    it("does not show the origin under another overlay's clone on cleanup", () => {
      const secondState = enter(createContext(), true);

      cleanupFullscreenAnimation(
        { originElement: origin, cloneComponentRef: null, subscriptions: [], isOriginHidden: false },
        deps,
      );

      expect(origin.style.opacity).toBe('0');

      cleanupFullscreenAnimation(secondState, deps);
    });

    it('restores the original transition when the origin is hidden again before the restore frame', async () => {
      cleanupFullscreenAnimation(enter(createContext(), true), deps);

      const secondState = enter(createContext(), true);
      await flushFrames();
      cleanupFullscreenAnimation(secondState, deps);
      await flushFrames();

      expect(origin.style.transition).toBe('opacity 1s');
      expect(origin.style.opacity).toBe('');
    });

    it('sizes the clone from the layout viewport, not the visual viewport', () => {
      vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(400);
      vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(800);
      Object.defineProperty(window, 'visualViewport', {
        configurable: true,
        value: { width: 200, height: 300 },
      });

      try {
        const state = enter(createContext(), true);

        expect(containerEl.style.getPropertyValue('--origin-scale-x')).toBe(`${100 / 400}`);
        expect(containerEl.style.getPropertyValue('--origin-scale-y')).toBe(`${40 / 800}`);

        cleanupFullscreenAnimation(state, deps);
      } finally {
        Reflect.deleteProperty(window, 'visualViewport');
      }
    });
  });
});
