import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { setInputSignal } from '@ethlete/core';
import '../../../test-helpers';
import { OverlayAnchorDirective } from './overlay-anchor.directive';
import { OverlaySurfaceContext, OverlaySurfaceDirective } from './overlay-surface.directive';
import { OverlayDirective } from './overlay.directive';

@Component({
  template: `
    <div etOverlay>
      <button etOverlayAnchor type="button">Anchor</button>

      <ng-template etOverlaySurface let-close="close">
        <button (click)="close('done')" class="surface-close" type="button">Close</button>
      </ng-template>
    </div>
  `,
  imports: [OverlayDirective, OverlayAnchorDirective, OverlaySurfaceDirective],
})
class OverlayDirectiveTestHost {}

describe('OverlayDirective', () => {
  let fixture: ComponentFixture<OverlayDirectiveTestHost>;
  let host: HTMLElement;
  let anchor: HTMLButtonElement;
  let overlayDirective: OverlayDirective;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OverlayDirectiveTestHost],
    });

    fixture = TestBed.createComponent(OverlayDirectiveTestHost);
    fixture.detectChanges();
    host = fixture.debugElement.query(By.directive(OverlayDirective)).nativeElement;
    anchor = fixture.nativeElement.querySelector('button');
    overlayDirective = fixture.debugElement.query(By.directive(OverlayDirective)).injector.get(OverlayDirective);
  });

  afterEach(() => {
    overlayDirective.hide();
  });

  it('opens as an anchored overlay from the registered anchor in non-modal mode', () => {
    overlayDirective.show();
    fixture.detectChanges();

    const overlayRef = overlayDirective.overlayRef();
    const positionStrategy = TestBed.runInInjectionContext(() =>
      overlayRef?.config.strategies?.()[0]?.strategy.config.positionStrategy?.(anchor),
    );

    expect(host.getAttribute('data-overlay-open')).toBe('true');
    expect(overlayRef?.config.origin).toBe(anchor);
    expect(positionStrategy?.kind).toBe('anchored');

    if (positionStrategy?.kind === 'anchored') {
      expect(positionStrategy.referenceElement).toBe(anchor);
    }
  });

  it('uses center positioning in modal mode even when an anchor exists', () => {
    setInputSignal(overlayDirective.mode, 'modal');
    fixture.detectChanges();

    overlayDirective.show();
    fixture.detectChanges();

    const positionStrategy = TestBed.runInInjectionContext(() =>
      overlayDirective.overlayRef()?.config.strategies?.()[0]?.strategy.config.positionStrategy?.(),
    );

    expect(positionStrategy?.kind).toBe('center');
  });

  it('closes through the surface context close callback', () => {
    overlayDirective.show();
    fixture.detectChanges();

    const instance = overlayDirective.overlayRef()?.componentInstance() as {
      context: () => OverlaySurfaceContext;
    } | null;
    instance?.context().close('done');
    fixture.detectChanges();

    expect(overlayDirective.open()).toBe(false);
    expect(host.getAttribute('data-overlay-open')).toBeNull();
  });

  it('stays open when a close guard vetoes hide()', () => {
    overlayDirective.show();
    fixture.detectChanges();

    const overlayRef = overlayDirective.overlayRef();
    let guardCalls = 0;
    const unregister = overlayRef?.registerCloseGuard(() => {
      guardCalls++;

      return false;
    });

    overlayDirective.hide();
    fixture.detectChanges();

    expect(overlayDirective.open()).toBe(true);
    expect(host.getAttribute('data-overlay-open')).toBe('true');
    expect(overlayDirective.overlayRef()).toBe(overlayRef);
    expect(guardCalls).toBe(1);

    unregister?.();
  });

  it('reopens the model when a close guard vetoes an open=false write', () => {
    overlayDirective.show();
    fixture.detectChanges();

    const unregister = overlayDirective.overlayRef()?.registerCloseGuard(() => false);

    overlayDirective.open.set(false);
    fixture.detectChanges();

    expect(overlayDirective.open()).toBe(true);
    expect(host.getAttribute('data-overlay-open')).toBe('true');

    unregister?.();
  });

  it('closes its overlay when the host is destroyed', () => {
    overlayDirective.show();
    fixture.detectChanges();

    let closing = false;

    overlayDirective
      .overlayRef()
      ?.beforeClosed()
      .subscribe(() => (closing = true));

    fixture.destroy();

    expect(closing).toBe(true);
  });
});
