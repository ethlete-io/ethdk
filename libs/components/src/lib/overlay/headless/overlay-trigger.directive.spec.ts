import { Component, signal } from '@angular/core';
import { OverlayMode } from '../overlay-config';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import '../../../test-helpers';
import { OverlaySurfaceDirective } from './overlay-surface.directive';
import { OverlayTriggerDirective } from './overlay-trigger.directive';
import { OverlayDirective } from './overlay.directive';

@Component({
  template: `
    <div [mode]="mode()" [disabled]="disabled()" etOverlay>
      @if (showTrigger) {
        <button etOverlayTrigger type="button">Open</button>
      }

      <ng-template etOverlaySurface>Surface</ng-template>
    </div>
  `,
  imports: [OverlayDirective, OverlayTriggerDirective, OverlaySurfaceDirective],
})
class OverlayTriggerDirectiveTestHost {
  showTrigger = true;
  mode = signal<OverlayMode>('non-modal');
  disabled = signal(false);
}

describe('OverlayTriggerDirective', () => {
  let fixture: ComponentFixture<OverlayTriggerDirectiveTestHost>;
  let overlayDirective: OverlayDirective;
  let button: HTMLButtonElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OverlayTriggerDirectiveTestHost],
    });

    fixture = TestBed.createComponent(OverlayTriggerDirectiveTestHost);
    fixture.detectChanges();
    overlayDirective = fixture.debugElement.query(By.directive(OverlayDirective)).injector.get(OverlayDirective);
    button = fixture.nativeElement.querySelector('button');
  });

  afterEach(() => {
    overlayDirective.hide();
  });

  it('registers the trigger directive with the parent overlay', () => {
    const triggerDirective = fixture.debugElement
      .query(By.directive(OverlayTriggerDirective))
      .injector.get(OverlayTriggerDirective);

    expect(overlayDirective.registeredTrigger()).toBe(triggerDirective);
  });

  it('toggles overlay state and host attributes on click', () => {
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('data-overlay-open')).toBeNull();

    button.click();
    fixture.detectChanges();

    expect(overlayDirective.open()).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('data-overlay-open')).toBe('true');
  });

  it('unregisters the trigger when the trigger element is removed', () => {
    fixture.destroy();

    expect(overlayDirective.registeredTrigger()).toBeNull();
  });

  it('announces a dialog popup only for a modal overlay', () => {
    expect(button.hasAttribute('aria-haspopup')).toBe(false);

    fixture.componentInstance.mode.set('modal');
    fixture.detectChanges();

    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('marks the trigger disabled while the overlay is disabled', () => {
    expect(button.hasAttribute('aria-disabled')).toBe(false);

    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();
    button.click();
    fixture.detectChanges();

    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(overlayDirective.open()).toBe(false);
  });
});
