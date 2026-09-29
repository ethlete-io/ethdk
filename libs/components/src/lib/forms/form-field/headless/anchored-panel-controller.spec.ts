import { Component, TemplateRef, computed, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../../../test-helpers';
import { createOverlayDriver } from '../../../testing/overlay-driver';
import { anchoredOverlayStrategy } from '../../../overlay/strategies';
import {
  AnchoredPanelOverlayRef,
  AnchoredPanelSurfaceLike,
  AnchoredPanelCloseInfo,
  createAnchoredPanelController,
} from './anchored-panel-controller';

@Component({ template: '' })
class MissingSurfaceHost {
  open = signal(false);
  missingSurfaceCalls = 0;

  constructor() {
    createAnchoredPanelController({
      canOpen: signal(true),
      open: this.open,
      overlayRef: signal<AnchoredPanelOverlayRef | null>(null),
      surface: signal<AnchoredPanelSurfaceLike | null>(null),
      anchor: () => null,
      config: () => ({}),
      onMissingSurface: () => this.missingSurfaceCalls++,
    });
  }
}

describe('createAnchoredPanelController', () => {
  it('closes the open model again when no surface is registered', () => {
    const fixture = TestBed.createComponent(MissingSurfaceHost);
    const host = fixture.componentInstance;

    fixture.detectChanges();
    host.open.set(true);
    fixture.detectChanges();

    expect(host.missingSurfaceCalls).toBe(1);
    expect(host.open()).toBe(false);
  });
});

@Component({
  template: `
    <button #before id="before" type="button">Before</button>
    <div #anchor id="anchor"><button id="trigger" type="button">Trigger</button></div>
    <button id="after" type="button">After</button>
    <ng-template #surface>
      <button id="first" type="button">First</button>
      <button id="last" type="button">Last</button>
    </ng-template>
  `,
})
class PanelHost {
  open = signal(false);
  overlayRef = signal<AnchoredPanelOverlayRef | null>(null);
  closes: AnchoredPanelCloseInfo[] = [];
  beforeClosedCalls = 0;
  private surfaceTemplate = viewChild.required<TemplateRef<unknown>>('surface');

  controller = createAnchoredPanelController({
    canOpen: signal(true),
    open: this.open,
    overlayRef: this.overlayRef,
    surface: computed(() => ({ templateRef: this.surfaceTemplate() })),
    anchor: () => document.getElementById('anchor'),
    config: ({ origin }) => ({
      mode: 'non-modal',
      hasBackdrop: false,
      autoFocus: false,
      restoreFocus: false,
      closeOnEscape: false,
      closeOnOutsidePointer: false,
      origin,
      strategies: anchoredOverlayStrategy({ containerClass: ['et-overlay--anchored'], placement: 'bottom-start' }),
    }),
    onBeforeClosed: () => this.beforeClosedCalls++,
    onAfterClosed: (info) => this.closes.push(info),
  });
}

describe('createAnchoredPanelController with a real overlay', () => {
  const setup = async () => {
    const fixture = TestBed.createComponent(PanelHost);
    const host = fixture.componentInstance;
    const driver = createOverlayDriver(fixture);

    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    host.open.set(true);
    await driver.openVia(() => fixture.detectChanges());

    return { fixture, host, driver };
  };

  const byId = (id: string) => document.getElementById(id) as HTMLElement;

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
    document.body.innerHTML = '';
  });

  it('closes on a pointerdown outside and reports it', async () => {
    const { host, driver } = await setup();

    expect(driver.pane()).not.toBeNull();

    byId('before').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await driver.settle();

    expect(host.open()).toBe(false);
    expect(host.closes).toEqual([{ byOutsidePointer: true, byFocusLeave: false, fromBottomSheet: false }]);
    driver.closeAll();
  });

  it('stays open for a pointerdown inside the pane or on the anchor', async () => {
    const { host, driver } = await setup();

    driver.paneEl('#first')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    byId('trigger').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await driver.settle();

    expect(host.open()).toBe(true);
    expect(host.closes).toEqual([]);
    driver.closeAll();
  });

  it('closes when focus moves outside and reports a focus leave', async () => {
    const { host, driver } = await setup();

    byId('after').focus();
    await driver.settle();

    expect(host.open()).toBe(false);
    expect(host.closes).toEqual([{ byOutsidePointer: false, byFocusLeave: true, fromBottomSheet: false }]);
    driver.closeAll();
  });

  it('moves focus to the tab stop after the anchor and closes when Tab leaves the last pane element', async () => {
    const { host, driver } = await setup();
    const last = driver.paneEl('#last')!;

    last.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    last.dispatchEvent(event);
    await driver.settle();

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(byId('after'));
    expect(host.open()).toBe(false);
    expect(host.closes[0]?.byFocusLeave).toBe(true);
    driver.closeAll();
  });

  it('moves focus to the tab stop before the anchor on Shift+Tab from the first pane element', async () => {
    const { host, driver } = await setup();
    const first = driver.paneEl('#first')!;

    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    await driver.settle();

    expect(document.activeElement).toBe(byId('before'));
    expect(host.open()).toBe(false);
    driver.closeAll();
  });

  it('does not close on Tab from a pane element that is not the edge', async () => {
    const { host, driver } = await setup();
    const first = driver.paneEl('#first')!;

    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    await driver.settle();

    expect(host.open()).toBe(true);
    driver.closeAll();
  });

  it('mounts a fresh pane when the model reopens during the leave animation', async () => {
    const { fixture, host, driver } = await setup();

    byId('before').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    fixture.detectChanges();
    expect(host.open()).toBe(false);

    host.open.set(true);
    fixture.detectChanges();
    await driver.settle();
    await driver.settle();

    expect(host.open()).toBe(true);
    expect(host.overlayRef()).not.toBeNull();
    expect(driver.openOverlays()).toHaveLength(1);
    driver.closeAll();
  });

  it('closes the pane without writing the open model when the host is destroyed while open', async () => {
    const { fixture, host, driver } = await setup();

    fixture.destroy();
    driver.tick();

    expect(host.beforeClosedCalls).toBe(0);
    expect(host.open()).toBe(true);
    driver.closeAll();
  });
});
