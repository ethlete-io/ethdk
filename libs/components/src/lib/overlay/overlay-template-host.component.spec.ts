import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { createOverlayDriver } from '../testing/overlay-driver';
import { OverlaySurfaceDirective } from './headless/overlay-surface.directive';
import { OverlayTriggerDirective } from './headless/overlay-trigger.directive';
import { OverlayDirective } from './headless/overlay.directive';

@Component({
  template: `
    <div etOverlay>
      <button etOverlayTrigger type="button">Open</button>

      <ng-template etOverlaySurface let-close="close" let-overlay="overlay">
        <span class="projected-message">{{ message }}</span>
        <span class="projected-mode">{{ overlay.mode() }}</span>
        <button (click)="close('done')" class="surface-close" type="button">Close</button>
      </ng-template>
    </div>
  `,
  imports: [OverlayDirective, OverlayTriggerDirective, OverlaySurfaceDirective],
})
class OverlayTemplateHostTestComponent {
  message = 'Rendered through ngTemplateOutlet';
}

describe('OverlayTemplateHostComponent', () => {
  let fixture: ComponentFixture<OverlayTemplateHostTestComponent>;
  let driver: ReturnType<typeof createOverlayDriver<OverlayTemplateHostTestComponent>>;
  let overlay: OverlayDirective;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [OverlayTemplateHostTestComponent] });

    fixture = TestBed.createComponent(OverlayTemplateHostTestComponent);
    fixture.detectChanges();

    driver = createOverlayDriver(fixture);
    overlay = driver.directive(OverlayDirective, '[etOverlay]');

    const trigger = driver.query<HTMLButtonElement>('[etOverlayTrigger]');

    expect(trigger).not.toBeNull();

    await driver.openVia(() => trigger!.click());
  });

  afterEach(() => {
    driver.closeAll();
  });

  it('renders the surface template into the overlay pane with the context the overlay supplies', () => {
    expect(driver.paneEl('.et-overlay-template-host')).not.toBeNull();
    expect(driver.paneText('.projected-message')).toBe('Rendered through ngTemplateOutlet');
    expect(driver.paneText('.projected-mode')).toBe('non-modal');
    expect(driver.query('.projected-message')).toBeNull();
  });

  it('closes through the context close callback the overlay passed in', async () => {
    const closeButton = driver.paneEl<HTMLButtonElement>('.surface-close');

    expect(closeButton).not.toBeNull();

    closeButton!.click();
    await driver.settle();

    expect(driver.openOverlays()).toHaveLength(0);
    expect(overlay.open()).toBe(false);
  });

  it('closes on Escape', async () => {
    await driver.escape();

    expect(driver.openOverlays()).toHaveLength(0);
    expect(overlay.open()).toBe(false);
  });

  it('closes on a pointer down outside the pane', async () => {
    await driver.pointerDownOutside();

    expect(driver.openOverlays()).toHaveLength(0);
    expect(overlay.open()).toBe(false);
  });

  it('keeps the overlay open on a pointer down inside the pane', async () => {
    const message = driver.paneEl('.projected-message');

    expect(message).not.toBeNull();

    message!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await driver.settle();

    expect(driver.openOverlays()).toHaveLength(1);
  });
});
