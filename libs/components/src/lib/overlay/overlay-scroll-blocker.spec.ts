import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { injectOverlayRuntime } from '@ethlete/core';
import '../../test-helpers';
import { OverlayConfig } from './overlay-config';
import { injectOverlayManager } from './overlay-manager';
import { OverlayRef } from './overlay-ref';
import { injectOverlayScrollBlocker } from './overlay-scroll-blocker';
import { bottomSheetOverlayStrategy } from './strategies';

@Component({ template: 'overlay content' })
class OverlayContentComponent {}

@Component({ template: '' })
class HostComponent {}

describe('overlay scroll blocker', () => {
  let openedRef: OverlayRef<OverlayContentComponent, unknown> | null = null;
  let scrollHeightSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    openedRef = null;

    // jsdom reports every box as zero-sized, so the document never looks scrollable and the
    // blocker skips the lock it is here to test.
    scrollHeightSpy = vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(2000);

    TestBed.configureTestingModule({ providers: [] });
  });

  afterEach(() => {
    openedRef?.close();
    TestBed.tick();
    scrollHeightSpy?.mockRestore();
    document.documentElement.removeAttribute('style');
  });

  const setup = () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    TestBed.runInInjectionContext(() => injectOverlayScrollBlocker());
    TestBed.tick();

    return fixture;
  };

  const open = (config: Partial<OverlayConfig>) => {
    const overlayRef = TestBed.runInInjectionContext(() =>
      injectOverlayManager().open<OverlayContentComponent, unknown>(OverlayContentComponent, config),
    );

    openedRef = overlayRef;
    TestBed.tick();

    return overlayRef;
  };

  /** What a strategy switch does when its config turns the backdrop on or off. */
  const updateBackdrop = (hasBackdrop: boolean) => {
    const runtime = TestBed.runInInjectionContext(() => injectOverlayRuntime());

    runtime.openEntries().at(-1)?.updateBackdrop(hasBackdrop);
    TestBed.tick();
  };

  const isLocked = () => document.documentElement.style.position === 'fixed';

  it('does not lock the page for a non-modal overlay without a backdrop', () => {
    setup();
    open({ mode: 'non-modal', hasBackdrop: false });

    expect(isLocked()).toBe(false);
  });

  it('locks the page for a modal overlay', () => {
    setup();
    open({ mode: 'modal' });

    expect(isLocked()).toBe(true);
  });

  it('locks the page for a non-modal overlay that mounts with a backdrop', () => {
    setup();
    open({ mode: 'non-modal', strategies: bottomSheetOverlayStrategy({ hasBackdrop: true }) });

    expect(isLocked()).toBe(true);
  });

  it('locks the page once a strategy switch gives an open non-modal overlay a backdrop', () => {
    setup();
    open({ mode: 'non-modal', hasBackdrop: false });

    expect(isLocked()).toBe(false);

    updateBackdrop(true);

    expect(isLocked()).toBe(true);
  });

  it('unlocks the page once a strategy switch takes the backdrop away again', () => {
    setup();
    open({ mode: 'non-modal', hasBackdrop: false });

    updateBackdrop(true);

    expect(isLocked()).toBe(true);

    updateBackdrop(false);

    expect(isLocked()).toBe(false);
  });
});
