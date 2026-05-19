import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { setInputSignal } from '@ethlete/core';
import '../../../test-helpers';
import { OverlayTemplateHostData } from '../overlay-template-host.component';
import { OverlayAnchorDirective } from './overlay-anchor.directive';
import { OverlaySurfaceDirective } from './overlay-surface.directive';
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
    const positionStrategy = overlayRef?.config.positionStrategy;

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

    expect(overlayDirective.overlayRef()?.config.positionStrategy?.kind).toBe('center');
  });

  it('closes through the surface context close callback', () => {
    overlayDirective.show();
    fixture.detectChanges();

    const overlayData = overlayDirective.overlayRef()?.config.data as OverlayTemplateHostData | undefined;
    overlayData?.context.close('done');
    fixture.detectChanges();

    expect(overlayDirective.open()).toBe(false);
    expect(host.getAttribute('data-overlay-open')).toBeNull();
  });
});
