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
      @if (showAnchor) {
        <button etOverlayAnchor type="button">Anchor</button>
      }

      <ng-template etOverlaySurface>Surface</ng-template>
    </div>
  `,
  imports: [OverlayDirective, OverlayAnchorDirective, OverlaySurfaceDirective],
})
class OverlayAnchorDirectiveTestHost {
  showAnchor = true;
}

describe('OverlayAnchorDirective', () => {
  let fixture: ComponentFixture<OverlayAnchorDirectiveTestHost>;
  let overlayDirective: OverlayDirective;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OverlayAnchorDirectiveTestHost],
    });

    fixture = TestBed.createComponent(OverlayAnchorDirectiveTestHost);
    fixture.detectChanges();
    overlayDirective = fixture.debugElement.query(By.directive(OverlayDirective)).injector.get(OverlayDirective);
  });

  it('registers the anchor directive with the parent overlay', () => {
    const anchorDirective = fixture.debugElement
      .query(By.directive(OverlayAnchorDirective))
      .injector.get(OverlayAnchorDirective);

    expect(overlayDirective.registeredAnchor()).toBe(anchorDirective);
  });

  it('unregisters the anchor when the anchor element is removed', () => {
    fixture.destroy();

    expect(overlayDirective.registeredAnchor()).toBeNull();
  });
});
