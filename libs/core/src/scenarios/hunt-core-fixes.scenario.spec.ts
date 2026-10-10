import { Component, ElementRef, inject, signal, viewChild, viewChildren } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  AnimatedLifecycleDirective,
  ClickOutsideDirective,
  createUnsavedChangesTracker,
  getScrollSnapTarget,
  isElementVisible,
  ScrollObserverDirective,
  ScrollObserverStartDirective,
  signalElementIntersection,
} from '../index';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-hc-lifecycle',
  template: '',
  hostDirectives: [AnimatedLifecycleDirective],
})
class LifecycleHostComponent {
  lifecycle = inject(AnimatedLifecycleDirective);
}

@Component({
  selector: 'et-scenario-hc-popover',
  imports: [ClickOutsideDirective],
  template: `
    <div (etClickOutside)="closed = closed + 1" class="panel"><p class="text">Scroll me</p></div>
    <button class="outside" type="button">Elsewhere</button>
  `,
})
class PopoverComponent {
  closed = 0;
}

@Component({
  selector: 'et-scenario-hc-list',
  template: `
    @for (item of items(); track item) {
      <div #item class="item"></div>
    }
  `,
})
class ListComponent {
  items = signal(['a', 'c']);
  itemRefs = viewChildren<ElementRef<HTMLElement>>('item');
  intersections = signalElementIntersection(this.itemRefs, { rootMargin: '10px' });
}

@Component({
  selector: 'et-scenario-hc-scroll-observer',
  imports: [ScrollObserverDirective, ScrollObserverStartDirective],
  template: `
    <div class="scroller" etScrollObserver>
      @if (showFirst()) {
        <div class="first" etScrollObserverStart></div>
      }
      @if (showSecond()) {
        <div class="second" etScrollObserverStart></div>
      }
    </div>
  `,
})
class ScrollObserverHostComponent {
  showFirst = signal(true);
  showSecond = signal(false);
  observer = viewChild.required(ScrollObserverDirective);
}

const rect = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

const placedAt = (value: DOMRect) => {
  const element = document.createElement('div');
  element.getBoundingClientRect = () => value;

  return element;
};

describe('hunt-core fixes', () => {
  const scenario = useScenario();

  describe('HC-01 animated lifecycle shortcuts', () => {
    const mount = () => {
      const fixture = TestBed.createComponent(LifecycleHostComponent);
      const host = fixture.nativeElement as HTMLElement;

      return {
        fixture,
        lifecycle: fixture.componentInstance.lifecycle,
        classes: () => [...host.classList].filter((cls) => cls.startsWith('et-animation-')),
      };
    };

    it('keeps only enter-done when forced to entered from left', () => {
      const s = scenario();
      const { fixture, lifecycle, classes } = mount();

      s.flush();
      lifecycle.forceLeftState();
      s.frame();
      lifecycle.forceEnteredState();

      expect(lifecycle.state()).toBe('entered');
      expect(classes()).toEqual(['et-animation-enter-done']);

      s.flush();
      fixture.destroy();
    });

    it('keeps only enter-done when an instant enter takes over a running leave', () => {
      const s = scenario();
      const { fixture, lifecycle, classes } = mount();

      s.flush();
      lifecycle.enter();
      s.flush();
      lifecycle.leave();
      s.frame();
      lifecycle.skipNextEnter.set(true);
      lifecycle.enter();

      expect(lifecycle.state()).toBe('entered');
      expect(classes()).toEqual(['et-animation-enter-done']);

      s.flush();
      expect(lifecycle.state()).toBe('entered');
      fixture.destroy();
    });
  });

  describe('HC-02 getScrollSnapTarget', () => {
    it('snaps to the misaligned item next to a hidden one', () => {
      scenario();
      const container = placedAt(rect(0, 0, 100, 100));
      const hidden = placedAt(rect(0, 0, 0, 0));
      const misaligned = placedAt(rect(37, 0, 20, 20));

      expect(getScrollSnapTarget([hidden, misaligned], container, 'horizontal', 'start')).toEqual({
        element: misaligned,
        origin: 'start',
      });
    });
  });

  describe('HC-03 etClickOutside', () => {
    it('reports a keyboard click outside after a cancelled press inside', () => {
      const s = scenario();
      const fixture = TestBed.createComponent(PopoverComponent);
      s.tick();

      const host = fixture.nativeElement as HTMLElement;
      const text = host.querySelector('.text') as HTMLElement;
      const outside = host.querySelector('.outside') as HTMLElement;

      text.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
      text.dispatchEvent(new MouseEvent('pointercancel', { bubbles: true, composed: true }));
      outside.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true }));

      expect(fixture.componentInstance.closed).toBe(1);

      fixture.destroy();
    });
  });

  describe('HC-04 signalElementIntersection with a root margin', () => {
    it('keeps entries in DOM order when an element is inserted in the middle', () => {
      const s = scenario();
      const fixture = TestBed.createComponent(ListComponent);
      const list = fixture.componentInstance;

      s.flush();

      const [a, c] = list.itemRefs().map((ref) => ref.nativeElement);

      if (!a || !c) throw new Error('items not rendered');

      s.intersect(a, true);
      s.intersect(c, true);

      list.items.set(['a', 'b', 'c']);
      s.flush();

      const current = list.itemRefs().map((ref) => ref.nativeElement);
      const b = current[1];

      if (!b) throw new Error('inserted item not rendered');

      s.intersect(b, true);

      expect(list.intersections().map((entry) => current.indexOf(entry.target as HTMLElement))).toEqual([0, 1, 2]);

      fixture.destroy();
    });
  });

  describe('HC-05 isElementVisible', () => {
    it('reports the visible share of the area for a corner-clipped element', () => {
      scenario();
      const container = document.createElement('div');
      const element = document.createElement('div');

      expect(
        isElementVisible({ container, containerRect: rect(0, 0, 100, 100), element, elementRect: rect(80, 75, 40, 50) })
          ?.intersectionRatio,
      ).toBe(0.25);
    });
  });

  describe('HC-06 unsaved-changes tracker with defaultValue null', () => {
    it('captures the first non-null value and turns dirty on an edit', () => {
      const s = scenario();
      const draft = signal<{ name: string } | null>(null);
      const tracker = s.run(() =>
        createUnsavedChangesTracker({ source: draft, defaultValue: null, confirm: () => true, tab: false }),
      );

      s.tick();
      draft.set({ name: 'Ada' });
      s.tick();
      expect(tracker.hasChanges()).toBe(false);
      expect(tracker.defaultValue()).toEqual({ name: 'Ada' });

      draft.set({ name: 'Grace' });
      s.tick();
      expect(tracker.hasChanges()).toBe(true);
    });
  });

  describe('HC-07 etScrollObserver start marker replaced', () => {
    it('keeps the replacement observed when the replaced marker is destroyed later', () => {
      const s = scenario();
      const fixture = TestBed.createComponent(ScrollObserverHostComponent);
      const host = fixture.componentInstance;

      s.flush();
      fixture.componentInstance.showSecond.set(true);
      s.flush();
      fixture.componentInstance.showFirst.set(false);
      s.flush();

      const root = fixture.nativeElement as HTMLElement;
      const second = root.querySelector('.second') as HTMLElement;

      expect(s.observedElements()).toEqual([second]);
      expect(host.observer().isAtStart()).toBe(false);

      s.intersect(second, true);
      expect(host.observer().isAtStart()).toBe(true);

      fixture.destroy();
      expect(s.observedElements()).toEqual([]);
    });
  });
});
