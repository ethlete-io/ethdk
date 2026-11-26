import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import '../../../test-helpers';
import { OverlayAnchorDirective } from './overlay-anchor.directive';
import { OverlaySurfaceDirective } from './overlay-surface.directive';
import { OverlayDirective } from './overlay.directive';

@Component({
  template: `
    <div etOverlay>
      <button etOverlayAnchor type="button">Anchor</button>

      @if (showSurface) {
        <ng-template etOverlaySurface>Surface</ng-template>
      }
    </div>
  `,
  imports: [OverlayDirective, OverlayAnchorDirective, OverlaySurfaceDirective],
})
class OverlaySurfaceDirectiveTestHost {
  showSurface = true;
}

describe('OverlaySurfaceDirective', () => {
  let fixture: ComponentFixture<OverlaySurfaceDirectiveTestHost>;
  let overlayDirective: OverlayDirective;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OverlaySurfaceDirectiveTestHost],
    });

    fixture = TestBed.createComponent(OverlaySurfaceDirectiveTestHost);
    fixture.detectChanges();
    overlayDirective = fixture.debugElement.query(By.directive(OverlayDirective)).injector.get(OverlayDirective);
  });

  it('registers the surface directive with the parent overlay', () => {
    const surfaceDirective = overlayDirective.registeredSurface();

    expect(surfaceDirective).not.toBeNull();
    expect(surfaceDirective?.templateRef).toBeDefined();
  });

  it('unregisters the surface directive when the fixture is destroyed', () => {
    fixture.destroy();

    expect(overlayDirective.registeredSurface()).toBeNull();
  });
});
