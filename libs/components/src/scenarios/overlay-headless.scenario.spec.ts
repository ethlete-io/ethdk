import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  OVERLAY_ERROR_CODES,
  OVERLAY_IMPORTS,
  OverlayAnchorDirective,
  OverlayDirective,
  OverlaySurfaceDirective,
  OverlayTriggerDirective,
  provideOverlay,
} from '../index';
import { Scenario, useScenario } from './harness';

@Component({
  selector: 'et-scenario-filters',
  imports: [OVERLAY_IMPORTS],
  template: `
    <div
      [(open)]="open"
      [disabled]="disabled()"
      [mode]="mode()"
      [closeOnOutsidePointer]="closeOnOutside()"
      etOverlay
      placement="bottom-start"
      panelClass="filters-pane"
    >
      <button class="toggle" etOverlayTrigger type="button">Filters</button>
      <span class="anchor" etOverlayAnchor>anchor</span>

      <ng-template etOverlaySurface let-close="close">
        <div class="filters-panel">
          <button (click)="close('applied')" class="done" type="button">Done</button>
        </div>
      </ng-template>
    </div>
    <button class="elsewhere" type="button">Elsewhere</button>
  `,
})
class FiltersComponent {
  open = signal(false);
  disabled = signal(false);
  mode = signal<'modal' | 'non-modal'>('non-modal');
  closeOnOutside = signal(true);
  overlay = viewChild.required(OverlayDirective);
  trigger = viewChild.required(OverlayTriggerDirective);
  anchor = viewChild.required(OverlayAnchorDirective);
  surface = viewChild.required(OverlaySurfaceDirective);
}

@Component({
  selector: 'et-scenario-surfaceless',
  imports: [OverlayDirective],
  template: '<div etOverlay></div>',
})
class SurfacelessComponent {}

@Component({
  selector: 'et-scenario-stray-trigger',
  imports: [OverlayTriggerDirective],
  template: '<button etOverlayTrigger type="button">stray</button>',
})
class StrayTriggerComponent {}

@Component({
  selector: 'et-scenario-stray-anchor',
  imports: [OverlayAnchorDirective],
  template: '<span etOverlayAnchor>stray</span>',
})
class StrayAnchorComponent {}

@Component({
  selector: 'et-scenario-stray-surface',
  imports: [OverlaySurfaceDirective],
  template: '<ng-template etOverlaySurface>stray</ng-template>',
})
class StraySurfaceComponent {}

const query = (selector: string, root: ParentNode = document) => {
  const element = root.querySelector<HTMLElement>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const takeErrorPayload = (s: Scenario) => {
  const index = s.errors.findIndex((entry) => entry.source === 'console.error' && typeof entry.error === 'object');

  expect(index).not.toBe(-1);

  return s.errors.splice(index, 1)[0]?.error as { element: HTMLElement };
};

const mount = (s: Scenario) => {
  const fixture = TestBed.createComponent(FiltersComponent);

  s.flush();

  return { fixture, filters: fixture.componentInstance, host: fixture.nativeElement as HTMLElement };
};

const panes = () => document.querySelectorAll('.filters-pane').length;

describe('headless overlay scenarios', () => {
  const scenario = useScenario({ providers: [provideOverlay()] });

  it('toggles a non-modal popover from its trigger and closes it from the surface', () => {
    const s = scenario();
    const { filters, host } = mount(s);
    const toggle = query('.toggle', host);

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(filters.surface()).toBeInstanceOf(OverlaySurfaceDirective);
    expect(filters.trigger().elementRef.nativeElement).toBe(toggle);
    expect(filters.anchor().elementRef.nativeElement).toBe(query('.anchor', host));

    toggle.click();
    s.flush();

    expect(filters.open()).toBe(true);
    expect(filters.overlay().isMounted()).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.dataset['overlayOpen']).toBe('true');
    expect(panes()).toBe(1);
    expect(document.querySelector('.et-overlay-runtime-backdrop')).toBeNull();
    expect(query('.et-overlay-runtime-entry').hasAttribute('role')).toBe(false);

    query('.done').click();
    s.flush();

    expect(filters.open()).toBe(false);
    expect(panes()).toBe(0);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('.et-overlay-runtime-root')).toBeNull();
  });

  it('drives the popover through the open model and the directive api', () => {
    const s = scenario();
    const { filters } = mount(s);

    filters.open.set(true);
    s.flush();
    expect(panes()).toBe(1);

    filters.open.set(false);
    s.flush();
    expect(panes()).toBe(0);

    filters.overlay().show();
    s.flush();
    expect(filters.open()).toBe(true);

    filters.overlay().toggle();
    s.flush();
    expect(filters.open()).toBe(false);

    filters.overlay().show();
    s.flush();
    filters.overlay().hide();
    s.flush();
    expect(panes()).toBe(0);
  });

  it('closes on Escape and an outside press, and stays open when outside close is off', () => {
    const s = scenario();
    const { filters, host } = mount(s);

    filters.open.set(true);
    s.flush();
    s.keydown('Escape');
    s.flush();
    expect(filters.open()).toBe(false);

    filters.open.set(true);
    s.flush();
    query('.elsewhere', host).dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    s.flush();
    expect(filters.open()).toBe(false);

    filters.closeOnOutside.set(false);
    filters.open.set(true);
    s.flush();
    query('.elsewhere', host).dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    s.flush();
    expect(filters.open()).toBe(true);

    filters.open.set(false);
    s.flush();
  });

  it('ignores open requests while disabled and closes an open popover on disable', () => {
    const s = scenario();
    const { filters, host } = mount(s);

    filters.open.set(true);
    s.flush();

    filters.disabled.set(true);
    s.flush();
    expect(filters.open()).toBe(false);
    expect(panes()).toBe(0);

    query('.toggle', host).click();
    s.flush();
    expect(filters.open()).toBe(false);
    expect(panes()).toBe(0);
  });

  it('adds a backdrop and a dialog role in modal mode', () => {
    const s = scenario();
    const { filters } = mount(s);

    filters.mode.set('modal');
    filters.open.set(true);
    s.flush();

    expect(document.querySelector('.et-overlay-runtime-backdrop')).not.toBeNull();
    expect(query('.et-overlay-runtime-entry').getAttribute('role')).toBe('dialog');

    filters.open.set(false);
    s.flush();
  });

  it('reports a popover without a surface and pieces outside an overlay', () => {
    const s = scenario();

    for (const [component, code] of [
      [SurfacelessComponent, OVERLAY_ERROR_CODES.MISSING_OVERLAY_SURFACE],
      [StrayTriggerComponent, OVERLAY_ERROR_CODES.TRIGGER_OUTSIDE_OVERLAY],
      [StrayAnchorComponent, OVERLAY_ERROR_CODES.ANCHOR_OUTSIDE_OVERLAY],
      [StraySurfaceComponent, OVERLAY_ERROR_CODES.SURFACE_OUTSIDE_OVERLAY],
    ] as const) {
      const fixture = TestBed.createComponent(component);

      s.flush();
      s.expectError(`ET${code}`);
      expect(takeErrorPayload(s).element.isConnected).toBe(true);
      fixture.destroy();
    }
  });
});
