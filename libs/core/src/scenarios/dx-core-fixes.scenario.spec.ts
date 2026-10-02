import { provideLocationMocks } from '@angular/common/testing';
import { Component, inject, Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ClickOutsideDirective, createUnsavedChangesTracker, injectQueryParam, injectQueryParamAll } from '../index';
import { Scenario, useScenario } from './harness';

type Draft = { name: string };

@Component({
  selector: 'et-scenario-popover',
  imports: [ClickOutsideDirective],
  template: `
    @if (chips().length) {
      <div (etClickOutside)="closed = closed + 1" class="panel">
        <p class="text">Selectable</p>
        @for (chip of chips(); track chip) {
          <button (click)="remove(chip, $event)" class="chip" type="button">{{ chip }}</button>
        }
      </div>
    }
    <p class="outside">Elsewhere</p>
  `,
})
class PopoverComponent {
  chips = signal(['a', 'b']);
  closed = 0;

  remove(chip: string, event: Event) {
    (event.target as Element).remove();
    this.chips.update((chips) => chips.filter((c) => c !== chip));
  }
}

@Component({ selector: 'et-scenario-blank', template: '' })
class BlankComponent {}

const press = (target: Element, type: 'pointerdown' | 'click') =>
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, composed: true, cancelable: true }));

describe('dx-scan core fixes', () => {
  const scenario = useScenario({
    providers: [provideRouter([{ path: '**', component: BlankComponent }]), provideLocationMocks()],
  });

  describe('CORE-03 unsaved-changes with a plain signal that starts null', () => {
    it('turns dirty once the signal is filled and then edited', () => {
      const s = scenario();
      const draft = signal<Draft | null>(null);
      const tracker = s.run(() => createUnsavedChangesTracker({ source: draft, confirm: () => true, tab: false }));

      s.tick();
      expect(tracker.hasChanges()).toBe(false);

      draft.set({ name: 'Ada' });
      s.tick();
      expect(tracker.hasChanges()).toBe(false);

      draft.set({ name: 'Grace' });
      s.tick();
      expect(tracker.hasChanges()).toBe(true);

      tracker.restoreDefaultValue();
      s.tick();
      expect(draft()).toEqual({ name: 'Ada' });
      expect(tracker.hasChanges()).toBe(false);
    });
  });

  describe('CORE-06 etClickOutside', () => {
    const mount = (s: Scenario) => {
      const fixture = TestBed.createComponent(PopoverComponent);
      s.tick();

      return { fixture, host: fixture.nativeElement as HTMLElement };
    };

    it('ignores a click whose press began inside the host', () => {
      const s = scenario();
      const { fixture, host } = mount(s);
      const text = host.querySelector('.text') as Element;
      const outside = host.querySelector('.outside') as Element;

      press(text, 'pointerdown');
      press(outside, 'click');

      expect(fixture.componentInstance.closed).toBe(0);

      press(outside, 'pointerdown');
      press(outside, 'click');

      expect(fixture.componentInstance.closed).toBe(1);
    });

    it('treats a click on a node its own handler removed as inside', () => {
      const s = scenario();
      const { fixture, host } = mount(s);
      const chip = host.querySelector('.chip') as Element;

      press(chip, 'pointerdown');
      press(chip, 'click');

      expect(fixture.componentInstance.chips()).toEqual(['b']);
      expect(fixture.componentInstance.closed).toBe(0);
    });
  });

  describe('CORE-14 query params', () => {
    it('resolves a repeated param to its first value and exposes all of them through injectQueryParamAll', async () => {
      const s = scenario();
      const injector = s.run(() => inject(Injector));
      const router = s.run(() => inject(Router));

      const tag = injectQueryParam('tag', { injector });
      const tags = injectQueryParamAll('tag', { injector });

      await router.navigateByUrl('/x?tag=A&tag=B');
      await s.settle();
      s.tick();

      expect(tag()).toBe('A');
      expect(tags()).toEqual(['A', 'B']);

      await router.navigateByUrl('/x?tag=C');
      await s.settle();
      s.tick();

      expect(tag()).toBe('C');
      expect(tags()).toEqual(['C']);

      await router.navigateByUrl('/x');
      await s.settle();
      s.tick();

      expect(tag()).toBeNull();
      expect(tags()).toEqual([]);
    });
  });
});
