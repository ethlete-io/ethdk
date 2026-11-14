import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { OverlayConfig } from './overlay-config';
import { injectOverlayManager } from './overlay-manager';
import { OverlayRef } from './overlay-ref';

@Component({ template: 'overlay content' })
class PlainOverlayComponent {}

describe('overlay backdropClick', () => {
  const open = (config: OverlayConfig = {}) => {
    const ref = TestBed.runInInjectionContext(() =>
      injectOverlayManager().open(PlainOverlayComponent, { mode: 'modal', ...config }),
    );
    TestBed.tick();

    return ref as OverlayRef<PlainOverlayComponent>;
  };

  const click = (element: HTMLElement | null | undefined) => element?.click();

  beforeEach(() => TestBed.configureTestingModule({}));

  it('emits once per backdrop click without closing when close-on-backdrop is off', () => {
    const ref = open({ closeOnOutsidePointer: false });
    const emitted = vi.fn();
    ref.backdropClick().subscribe(emitted);

    click(ref.elements?.backdropElement());
    click(ref.elements?.backdropElement());

    expect(emitted).toHaveBeenCalledTimes(2);
    expect(ref.elements?.hostElement.isConnected).toBe(true);

    ref.close();
  });

  it('emits when the backdrop click also closes the overlay', () => {
    const ref = open({ closeOnOutsidePointer: true });
    const emitted = vi.fn();
    ref.backdropClick().subscribe(emitted);
    const backdrop = ref.elements?.backdropElement();

    backdrop?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));

    expect(emitted).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])('emits exactly once for a press and click when closeOnOutsidePointer is %s', (close) => {
    const ref = open({ closeOnOutsidePointer: close });
    const emitted = vi.fn();
    ref.backdropClick().subscribe(emitted);
    const backdrop = ref.elements?.backdropElement();

    backdrop?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    TestBed.tick();
    backdrop?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));

    expect(emitted).toHaveBeenCalledTimes(1);

    ref.close();
  });

  it('does not emit for a click inside the pane', () => {
    const ref = open({ closeOnOutsidePointer: false });
    const emitted = vi.fn();
    ref.backdropClick().subscribe(emitted);

    click(ref.elements?.paneElement);

    expect(emitted).not.toHaveBeenCalled();

    ref.close();
  });

  it('completes after the overlay closed', () => {
    const ref = open({ closeOnOutsidePointer: false });
    const completed = vi.fn();
    ref.backdropClick().subscribe({ complete: completed });

    ref.close();
    TestBed.tick();

    expect(completed).toHaveBeenCalledTimes(1);
  });
});
