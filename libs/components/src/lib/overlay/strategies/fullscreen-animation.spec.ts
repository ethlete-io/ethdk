import { ApplicationRef, DOCUMENT, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { injectRenderer } from '@ethlete/core';
import '../../../test-helpers';
import { FullscreenAnimationDeps, startFullscreenLeaveAnimation } from './fullscreen-animation';
import { OverlayStrategyContext } from './overlay-strategy.types';

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
});
