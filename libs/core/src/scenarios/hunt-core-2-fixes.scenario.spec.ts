import { APP_BASE_HREF, BrowserPlatformLocation, PlatformLocation } from '@angular/common';
import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AnimatedLifecycleDirective,
  DEFAULT_OVERLAY_LAYER,
  injectOverlayRuntime,
  numberBreakpointTransform,
  provideBreakpointInstance,
  setupScrollRestoration,
} from '../index';
import { Scenario, useScenario } from './harness';

@Component({
  selector: 'et-scenario-summary-dialog',
  template: `
    <button class="scenario-first" type="button">First</button>
    <details>
      <summary class="scenario-summary">More</summary>
      <p>Details</p>
    </details>
  `,
  hostDirectives: [AnimatedLifecycleDirective],
})
class ScenarioSummaryDialogComponent {}

@Component({
  selector: 'et-scenario-fieldset-dialog',
  template: `
    <input class="scenario-input" />
    <fieldset disabled>
      <button type="button">Cancel</button>
      <button type="button">Save</button>
    </fieldset>
  `,
  hostDirectives: [AnimatedLifecycleDirective],
})
class ScenarioFieldsetDialogComponent {}

@Component({
  selector: 'et-scenario-item-overlay',
  template: '<button class="scenario-item" type="button">item</button>',
  hostDirectives: [AnimatedLifecycleDirective],
})
class ScenarioItemOverlayComponent {}

@Component({ selector: 'et-scenario-bp-child', template: '' })
class BreakpointChildComponent {
  columns = input(1, { transform: numberBreakpointTransform(1) });
}

@Component({
  selector: 'et-scenario-bp-parent',
  imports: [BreakpointChildComponent],
  template: '<et-scenario-bp-child [columns]="columns" />',
  providers: [provideBreakpointInstance(BreakpointParentComponent)],
})
class BreakpointParentComponent {
  columns: Record<string, number> = { md: 3 };
}

const mount = <T extends object>(s: Scenario, id: string, component: new () => T, zIndex?: number) =>
  s.run(() => injectOverlayRuntime().mount({ id, component, autoFocus: false, zIndex }));

const pressTab = (target: HTMLElement | null, shiftKey = false) => {
  target?.focus();
  const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
  target?.dispatchEvent(event);

  return event.defaultPrevented;
};

const mockVisible = () =>
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{} as DOMRect] as unknown as DOMRectList);

describe('hunt core 2 fix scenarios', () => {
  describe('overlays', () => {
    const scenario = useScenario();

    it('HC2-01 wraps Tab from a trailing <summary> back into the modal', () => {
      const s = scenario();
      const rectsSpy = mockVisible();
      const dialog = mount(s, 'summary', ScenarioSummaryDialogComponent);

      s.flush();

      const pane = dialog.elements.paneElement;
      const first = pane.querySelector<HTMLElement>('.scenario-first');

      expect(pressTab(pane.querySelector<HTMLElement>('.scenario-summary'))).toBe(true);
      expect(document.activeElement).toBe(first);

      dialog.close();
      s.flush();
      rectsSpy.mockRestore();
    });

    it('HC2-01 ignores controls inside a disabled fieldset when wrapping Tab', () => {
      const s = scenario();
      const rectsSpy = mockVisible();
      const dialog = mount(s, 'fieldset', ScenarioFieldsetDialogComponent);

      s.flush();

      const field = dialog.elements.paneElement.querySelector<HTMLElement>('.scenario-input');

      expect(pressTab(field)).toBe(true);
      expect(document.activeElement).toBe(field);

      expect(pressTab(field, true)).toBe(true);
      expect(document.activeElement).toBe(field);

      dialog.close();
      s.flush();
      rectsSpy.mockRestore();
    });

    it('HC2-04 skips an opener disabled during the dialog and restores focus further up the chain', () => {
      const s = scenario();
      const trigger = document.createElement('button');

      document.body.appendChild(trigger);
      trigger.focus();

      const menu = mount(s, 'menu', ScenarioItemOverlayComponent);
      s.flush();

      const item = menu.elements.paneElement.querySelector<HTMLButtonElement>('.scenario-item');
      item?.focus();

      const dialog = mount(s, 'dialog', ScenarioItemOverlayComponent);
      s.flush();
      dialog.elements.paneElement.querySelector<HTMLButtonElement>('.scenario-item')?.focus();

      if (item) item.disabled = true;

      dialog.close();
      s.flush();

      expect(document.activeElement).toBe(trigger);

      menu.close();
      s.flush();
      trigger.remove();
    });

    it('HC2-05 lets the overlay on the highest layer own Tab although it opened first', () => {
      const s = scenario();
      const rectsSpy = mockVisible();
      const high = mount(s, 'high', ScenarioSummaryDialogComponent, DEFAULT_OVERLAY_LAYER + 5);
      s.flush();
      const low = mount(s, 'low', ScenarioItemOverlayComponent);
      s.flush();

      const summary = high.elements.paneElement.querySelector<HTMLElement>('.scenario-summary');

      expect(pressTab(summary)).toBe(true);
      expect(document.activeElement).toBe(high.elements.paneElement.querySelector('.scenario-first'));

      low.close();
      high.close();
      s.flush();
      rectsSpy.mockRestore();
    });

    it('HC2-06 completes afterOpened() without a value for an overlay closed before its enter frame', async () => {
      const s = scenario();
      const ref = mount(s, 'early-close', ScenarioItemOverlayComponent);
      const opened = firstValueFrom(ref.afterOpened(), { defaultValue: 'completed' });

      ref.close();
      s.flush();

      expect(ref.state()).toBe('closed');
      await expect(opened).resolves.toBe('completed');
    });

    it('HC2-06 completes afterOpened() without a value for an overlay closed during its enter transition', async () => {
      const s = scenario();
      const ref = mount(s, 'entering-close', ScenarioItemOverlayComponent);
      const opened = firstValueFrom(ref.afterOpened(), { defaultValue: 'completed' });

      s.frame();
      ref.close();
      s.flush();

      expect(ref.state()).toBe('closed');
      await expect(opened).resolves.toBe('completed');
    });
  });

  describe('HC2-03 breakpoint transform under an ancestor that provides its own instance', () => {
    const scenario = useScenario();

    it('warns for the child that forgot provideBreakpointInstance()', () => {
      const s = scenario();
      const fixture = TestBed.createComponent(BreakpointParentComponent);

      s.tick();

      s.expectWarning(/provideBreakpointInstance\(\)/);
      fixture.destroy();
    });
  });

  describe('HC2-02 scroll restoration under a base href', () => {
    const originalUrl = window.location.href;

    beforeEach(() => window.history.replaceState(null, '', '/app/news#comments'));
    afterEach(() => window.history.replaceState(null, '', originalUrl));

    const scenario = useScenario({
      providers: [
        provideRouter([{ path: 'news', children: [] }]),
        { provide: PlatformLocation, useClass: BrowserPlatformLocation },
        { provide: APP_BASE_HREF, useValue: '/app/' },
      ],
    });

    it('keeps the scroll position of a deep link on the initial navigation', async () => {
      const s = scenario();
      const scroller = document.createElement('div');
      let scrollTop = 500;

      Object.defineProperty(scroller, 'scrollTop', {
        get: () => scrollTop,
        set: (value: number) => (scrollTop = value),
      });

      const c = s.consumer();

      c.run(() => setupScrollRestoration({ scrollElement: scroller }));

      const navigation = s.run(() => TestBed.inject(Router)).navigateByUrl('/news#comments');

      await s.settle();
      await navigation;

      expect(scrollTop).toBe(500);

      c.destroy();
    });
  });
});
