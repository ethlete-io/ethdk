import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { FakeMatchMedia, fakeMatchMedia } from '../../testing/fake-match-media';
import { injectOverlayManager } from '../overlay-manager';
import { OverlayRef } from '../overlay-ref';
import { OverlayStrategy, OverlayStrategyContext } from './overlay-strategy.types';

const MD_QUERY = '(min-width: 768px)';

@Component({ template: 'overlay content' })
class StrategyTestContentComponent {}

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

describe('overlay strategy controller', () => {
  let fakeBreakpoints: FakeMatchMedia;

  const createTestStrategy = (id: string, config: OverlayStrategy['config']): OverlayStrategy => ({
    id,
    config,
    onSwitchedTo: vi.fn(),
    onSwitchedAwayFrom: vi.fn(),
    onBeforeEnter: vi.fn((context: OverlayStrategyContext) => context.lifecycle.enter()),
    onAfterEnter: vi.fn(),
    onBeforeLeave: vi.fn((context: OverlayStrategyContext) => context.lifecycle.leave()),
    onAfterLeave: vi.fn(),
  });

  let smallStrategy: OverlayStrategy;
  let largeStrategy: OverlayStrategy;
  let openedRef: OverlayRef<StrategyTestContentComponent, unknown> | null = null;

  beforeEach(() => {
    fakeBreakpoints = fakeMatchMedia();
    openedRef = null;

    TestBed.configureTestingModule({});

    smallStrategy = createTestStrategy('small', {
      width: '100%',
      maxWidth: '640px',
      containerClass: 'et-overlay--bottom-sheet',
      bodyClass: 'small-body',
      positionStrategy: () => ({ kind: 'global', vertical: 'end' }),
    });

    largeStrategy = createTestStrategy('large', {
      maxWidth: '80vw',
      containerClass: 'et-overlay--dialog',
      documentClass: 'large-document',
      positionStrategy: vi.fn(() => ({ kind: 'center' }) as const),
    });
  });

  afterEach(() => {
    openedRef?.close();
  });

  const openOverlay = () => {
    const overlayRef = TestBed.runInInjectionContext(() =>
      injectOverlayManager().open<StrategyTestContentComponent, unknown>(StrategyTestContentComponent, {
        strategies: () => [{ strategy: smallStrategy }, { breakpoint: 'md', strategy: largeStrategy }],
      }),
    );

    openedRef = overlayRef;
    TestBed.tick();

    return overlayRef;
  };

  it('applies the highest matched strategy on open', () => {
    const overlayRef = openOverlay();
    const elements = overlayRef.elements;

    expect(elements?.paneElement.classList.contains('et-overlay--bottom-sheet')).toBe(true);
    expect(elements?.paneElement.style.width).toBe('100%');
    // config max sizes are composed with the anchored auto-resize vars so the pane never exceeds the available space
    expect(elements?.paneElement.style.maxWidth).toBe('min(640px, var(--et-overlay-max-width, 640px))');
    expect(document.body.classList.contains('small-body')).toBe(true);
  });

  it('resolves event origins to the nearest clickable element', () => {
    const button = document.createElement('button');
    const icon = document.createElement('span');
    button.appendChild(icon);
    document.body.appendChild(button);

    const clickEvent = new MouseEvent('click', { bubbles: true });
    icon.dispatchEvent(clickEvent);

    const positionStrategy = vi.fn(() => ({ kind: 'global' }) as const);
    smallStrategy.config.positionStrategy = positionStrategy;

    openedRef = TestBed.runInInjectionContext(() =>
      injectOverlayManager().open<StrategyTestContentComponent, unknown>(StrategyTestContentComponent, {
        strategies: () => [{ strategy: smallStrategy }],
        origin: clickEvent,
      }),
    );
    TestBed.tick();

    expect(positionStrategy).toHaveBeenCalledWith(button);

    button.remove();
  });

  it('renders the content component inside the overlay container', () => {
    const overlayRef = openOverlay();

    expect(overlayRef.elements?.paneElement.textContent).toContain('overlay content');
    expect(overlayRef.componentInstance()).toBeInstanceOf(StrategyTestContentComponent);
  });

  it('delegates enter and leave animations to the active strategy', async () => {
    const overlayRef = openOverlay();

    await flushFrames();

    expect(smallStrategy.onBeforeEnter).toHaveBeenCalledOnce();
    expect(largeStrategy.onBeforeEnter).not.toHaveBeenCalled();

    overlayRef.close();

    expect(smallStrategy.onBeforeLeave).toHaveBeenCalledOnce();
  });

  it('adds and removes the backdrop when the switched-to strategy differs', async () => {
    smallStrategy.config.hasBackdrop = true;
    smallStrategy.config.backdropClass = 'small-backdrop';
    largeStrategy.config.hasBackdrop = false;

    const overlayRef = openOverlay();
    const elements = overlayRef.elements;

    await flushFrames();

    expect(elements?.backdropElement()?.classList.contains('small-backdrop')).toBe(true);
    expect(elements?.backdropElement()?.classList.contains('et-overlay-backdrop--visible')).toBe(true);

    fakeBreakpoints.setMatches(MD_QUERY, true);
    TestBed.tick();

    expect(elements?.backdropElement()).toBeNull();
    expect(elements?.hostElement.style.pointerEvents).toBe('none');

    fakeBreakpoints.setMatches(MD_QUERY, false);
    TestBed.tick();
    await flushFrames();

    const backdrop = elements?.backdropElement();

    expect(backdrop?.classList.contains('small-backdrop')).toBe(true);
    expect(backdrop?.classList.contains('et-overlay-backdrop--visible')).toBe(true);
    expect(elements?.hostElement.style.pointerEvents).toBe('auto');
  });

  it('switches strategies when the breakpoint changes', () => {
    const overlayRef = openOverlay();
    const elements = overlayRef.elements;

    fakeBreakpoints.setMatches(MD_QUERY, true);
    TestBed.tick();

    expect(smallStrategy.onSwitchedAwayFrom).toHaveBeenCalledOnce();
    expect(largeStrategy.onSwitchedTo).toHaveBeenCalledOnce();

    // class buckets are diffed per element
    expect(elements?.paneElement.classList.contains('et-overlay--bottom-sheet')).toBe(false);
    expect(elements?.paneElement.classList.contains('et-overlay--dialog')).toBe(true);
    expect(document.body.classList.contains('small-body')).toBe(false);
    expect(document.documentElement.classList.contains('large-document')).toBe(true);

    // position is re-resolved and sizing re-applied
    expect(largeStrategy.config.positionStrategy).toHaveBeenCalled();
    expect(elements?.hostElement.style.padding).toBe('16px');
    expect(elements?.paneElement.style.width).toBe('');
    expect(elements?.paneElement.style.maxWidth).toBe('min(80vw, var(--et-overlay-max-width, 80vw))');

    // switching back applies the previous strategy again
    fakeBreakpoints.setMatches(MD_QUERY, false);
    TestBed.tick();

    expect(largeStrategy.onSwitchedAwayFrom).toHaveBeenCalledOnce();
    expect(smallStrategy.onSwitchedTo).toHaveBeenCalledOnce();
    expect(elements?.paneElement.classList.contains('et-overlay--bottom-sheet')).toBe(true);
    expect(document.documentElement.classList.contains('large-document')).toBe(false);
  });

  it('renders the drag handle and arrow of the strategy switched to', () => {
    smallStrategy.config.dragToDismiss = { direction: 'to-bottom' };
    largeStrategy.config.arrow = true;

    const overlayRef = openOverlay();
    const pane = overlayRef.elements?.paneElement;

    expect(pane?.querySelector('.et-overlay-container-drag-handle')).not.toBeNull();
    expect(pane?.querySelector('.et-overlay-arrow')).toBeNull();

    fakeBreakpoints.setMatches(MD_QUERY, true);
    TestBed.tick();

    expect(pane?.querySelector('.et-overlay-container-drag-handle')).toBeNull();
    expect(pane?.querySelector('.et-overlay-arrow')).not.toBeNull();
  });

  it('switches strategies when the viewport width crosses the breakpoint', () => {
    const overlayRef = openOverlay();
    const elements = overlayRef.elements;

    fakeBreakpoints.setViewportWidth(1024);
    TestBed.tick();

    expect(largeStrategy.onSwitchedTo).toHaveBeenCalledOnce();
    expect(elements?.paneElement.classList.contains('et-overlay--dialog')).toBe(true);

    fakeBreakpoints.setViewportWidth(600);
    TestBed.tick();

    expect(smallStrategy.onSwitchedTo).toHaveBeenCalledOnce();
    expect(elements?.paneElement.classList.contains('et-overlay--bottom-sheet')).toBe(true);
  });

  describe('document and body classes shared between overlays', () => {
    const openWithoutBreakpoints = () => {
      const overlayRef = TestBed.runInInjectionContext(() =>
        injectOverlayManager().open<StrategyTestContentComponent, unknown>(StrategyTestContentComponent, {
          strategies: () => [{ strategy: smallStrategy }],
        }),
      );

      TestBed.tick();

      return overlayRef;
    };

    it('keeps them while another open overlay still asks for them', async () => {
      const first = openOverlay();
      const second = openWithoutBreakpoints();

      expect(document.body.classList.contains('small-body')).toBe(true);

      first.close();
      TestBed.tick();
      await flushFrames();

      expect(document.body.classList.contains('small-body')).toBe(true);

      second.close();
      TestBed.tick();
      await flushFrames();

      expect(document.body.classList.contains('small-body')).toBe(false);
    });

    it('keeps them when another overlay switches to a strategy without them', async () => {
      const switching = openOverlay();
      const staying = openWithoutBreakpoints();

      fakeBreakpoints.setMatches(MD_QUERY, true);
      TestBed.tick();

      expect(document.body.classList.contains('small-body')).toBe(true);

      switching.close();
      staying.close();
      TestBed.tick();
      await flushFrames();
    });
  });

  describe('strategies without a breakpoint-less entry', () => {
    const openWithoutBaseStrategy = () => {
      const overlayRef = TestBed.runInInjectionContext(() =>
        injectOverlayManager().open<StrategyTestContentComponent, unknown>(StrategyTestContentComponent, {
          strategies: () => [{ breakpoint: 'md', strategy: largeStrategy }],
        }),
      );

      openedRef = overlayRef;
      TestBed.tick();

      return overlayRef;
    };

    it('falls back to the smallest entry below its breakpoint instead of throwing', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      const overlayRef = openWithoutBaseStrategy();

      expect(overlayRef.elements?.paneElement.classList.contains('et-overlay--dialog')).toBe(true);
      expect(warn).toHaveBeenCalledOnce();

      warn.mockRestore();
    });

    it('does not throw when a resize drops below the smallest breakpoint', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      fakeBreakpoints.setMatches(MD_QUERY, true);
      openWithoutBaseStrategy();

      expect(() => {
        fakeBreakpoints.setMatches(MD_QUERY, false);
        TestBed.tick();
      }).not.toThrow();

      warn.mockRestore();
    });

    it('throws a named error when strategies resolves to an empty array', () => {
      expect(() =>
        TestBed.runInInjectionContext(() =>
          injectOverlayManager().open<StrategyTestContentComponent, unknown>(StrategyTestContentComponent, {
            strategies: () => [],
          }),
        ),
      ).toThrow(/strategies` resolved to an empty array/);
    });
  });
});
