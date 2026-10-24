import { TestBed } from '@angular/core/testing';
import { injectRenderer } from '@ethlete/core';
import '../../../test-helpers';
import { injectBottomSheetStrategy } from './bottom-sheet.strategy';
import { OverlayStrategyContext } from './overlay-strategy.types';
import { createSheetStrategy } from './sheet-strategy-hooks';

const LAYOUT_HEIGHT = 800;

describe('bottom sheet on the soft keyboard', () => {
  let pane: HTMLElement;
  let viewport: EventTarget & { offsetTop: number; height: number; width: number };
  let context: OverlayStrategyContext;

  const openSheet = (liftAboveKeyboard: boolean) => {
    const renderer = TestBed.runInInjectionContext(() => injectRenderer());
    const strategy = createSheetStrategy({}, { renderer, liftAboveKeyboard: () => liftAboveKeyboard });

    strategy.onBeforeEnter?.(context);

    return strategy;
  };

  const openKeyboard = (height: number) => {
    viewport.height = LAYOUT_HEIGHT - height;
    viewport.dispatchEvent(new Event('resize'));
  };

  beforeEach(() => {
    vi.useFakeTimers();
    viewport = Object.assign(new EventTarget(), { offsetTop: 0, height: LAYOUT_HEIGHT, width: 400 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ bottom: LAYOUT_HEIGHT } as DOMRect);

    pane = document.body.appendChild(document.createElement('div'));
    context = { containerEl: pane, lifecycle: { enter: vi.fn(), leave: vi.fn() } } as unknown as OverlayStrategyContext;
  });

  afterEach(() => {
    pane.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
    Reflect.deleteProperty(window, 'visualViewport');
  });

  it('sits on the keyboard and fits into the space above it', () => {
    const strategy = openSheet(true);

    openKeyboard(300);

    expect(pane.style.getPropertyValue('margin-block-end')).toBe('300px');
    expect(pane.style.getPropertyValue('--et-overlay-max-height')).toBe('calc(100% - 300px)');

    strategy.onAfterLeave?.(context);
  });

  it('drops back to the bottom edge when the keyboard closes', () => {
    const strategy = openSheet(true);

    openKeyboard(300);
    openKeyboard(0);

    expect(pane.style.getPropertyValue('margin-block-end')).toBe('');
    expect(pane.style.getPropertyValue('--et-overlay-max-height')).toBe('');

    strategy.onAfterLeave?.(context);
  });

  it('restores the lift a re-position cleared while the keyboard stays open', () => {
    const strategy = openSheet(true);

    openKeyboard(300);
    pane.style.removeProperty('--et-overlay-max-height');
    vi.advanceTimersByTime(500);

    expect(pane.style.getPropertyValue('--et-overlay-max-height')).toBe('calc(100% - 300px)');

    strategy.onAfterLeave?.(context);
  });

  it('stops tracking and clears the lift once closed', () => {
    const strategy = openSheet(true);

    openKeyboard(300);
    strategy.onAfterLeave?.(context);

    expect(pane.style.getPropertyValue('margin-block-end')).toBe('');
    expect(vi.getTimerCount()).toBe(0);

    openKeyboard(200);

    expect(pane.style.getPropertyValue('margin-block-end')).toBe('');
  });

  it('is on for the bottom sheet strategy on a touch device', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query === '(pointer: coarse)',
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          addListener: () => undefined,
          removeListener: () => undefined,
        }) as unknown as MediaQueryList,
    );

    const strategy = TestBed.runInInjectionContext(() => injectBottomSheetStrategy().build());

    strategy.onBeforeEnter?.(context);
    openKeyboard(300);

    expect(pane.style.getPropertyValue('margin-block-end')).toBe('300px');

    strategy.onAfterLeave?.(context);
  });

  it('stays put without touch input', () => {
    openSheet(false);

    openKeyboard(300);

    expect(pane.style.getPropertyValue('margin-block-end')).toBe('');
    expect(vi.getTimerCount()).toBe(0);
  });
});
