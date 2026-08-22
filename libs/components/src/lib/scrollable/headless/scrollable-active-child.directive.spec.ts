import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { SCROLLABLE_IMPORTS } from '../scrollable.imports';
import { ScrollableComponent } from '../scrollable.component';
import { ScrollableDirective } from './scrollable.directive';

const CONTAINER_WIDTH = 300;
const ITEM_WIDTH = 300;

// jsdom has no layout, so `getElementScrollCoordinates` would always answer "nothing to scroll". These
// stand-ins give the container an overflowing track and place each marked item by its id, far enough out
// that scrolling to it produces a distinct offset.
const ITEM_LEFTS: Record<string, number> = { a: 0, b: 320, c: 640 };

const installFakeLayout = () => {
  const scrollOffsets = new WeakMap<Element, number>();
  const originalRect = Element.prototype.getBoundingClientRect;
  const originalScrollLeft = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollLeft');

  const rectOf = (element: Element): DOMRect => {
    const isContainer = element.classList.contains('et-scrollable-container');
    const left = isContainer ? 0 : (ITEM_LEFTS[element.id] ?? 0);
    const width = isContainer ? CONTAINER_WIDTH : element.id in ITEM_LEFTS ? ITEM_WIDTH : 0;

    return {
      left,
      right: left + width,
      width,
      top: 0,
      bottom: 100,
      height: 100,
      x: left,
      y: 0,
      toJSON: () => ({}),
    };
  };

  Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
    configurable: true,
    writable: true,
    value: function (this: Element) {
      return rectOf(this);
    },
  });

  Object.defineProperty(Element.prototype, 'scrollLeft', {
    configurable: true,
    get(this: Element) {
      return scrollOffsets.get(this) ?? 0;
    },
    set(this: Element, value: number) {
      scrollOffsets.set(this, value);
    },
  });

  const sizes: Record<string, number> = {
    scrollWidth: (ITEM_LEFTS['c'] ?? 0) + ITEM_WIDTH,
    clientWidth: CONTAINER_WIDTH,
    scrollHeight: 100,
    clientHeight: 100,
  };

  for (const [name, value] of Object.entries(sizes)) {
    Object.defineProperty(Element.prototype, name, { configurable: true, get: () => value });
  }

  return () => {
    Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
      configurable: true,
      writable: true,
      value: originalRect,
    });

    if (originalScrollLeft) Object.defineProperty(Element.prototype, 'scrollLeft', originalScrollLeft);
    else Reflect.deleteProperty(Element.prototype, 'scrollLeft');

    for (const name of Object.keys(sizes)) Reflect.deleteProperty(Element.prototype, name);
  };
};

type Item = { id: string; active: boolean };

@Component({
  selector: 'et-test-active-child-host',
  template: `
    <et-scrollable renderMasks="false">
      @for (item of items(); track item.id) {
        <div [etScrollableActiveChild]="item.active" [id]="item.id">{{ item.id }}</div>
      }
    </et-scrollable>
  `,
  imports: [SCROLLABLE_IMPORTS],
})
class ActiveChildHostComponent {
  public items = signal<Item[]>([
    { id: 'a', active: false },
    { id: 'b', active: true },
    { id: 'c', active: false },
  ]);
}

const settle = async (fixture: ComponentFixture<ActiveChildHostComponent>) => {
  for (let i = 0; i < 3; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
  }
};

const scrollableDirective = (fixture: ComponentFixture<ActiveChildHostComponent>) =>
  fixture.debugElement.children[0]!.injector.get(ScrollableDirective);

const scrollContainer = (fixture: ComponentFixture<ActiveChildHostComponent>) =>
  (fixture.nativeElement as HTMLElement).querySelector('.et-scrollable-container') as HTMLElement;

describe('ScrollableActiveChildDirective', () => {
  let restoreLayout: () => void;

  beforeEach(() => {
    restoreLayout = installFakeLayout();

    TestBed.configureTestingModule({ imports: [ActiveChildHostComponent, ScrollableComponent] });
  });

  afterEach(() => restoreLayout());

  it('registers every marked child with the scrollable, in DOM order', async () => {
    const fixture = TestBed.createComponent(ActiveChildHostComponent);
    await settle(fixture);

    const refs = scrollableDirective(fixture).getActiveChildren()();

    expect(refs.map((ref) => ref.elementRef.nativeElement.id)).toEqual(['a', 'b', 'c']);
    expect(refs.map((ref) => ref.isActiveChildEnabled())).toEqual([false, true, false]);
  });

  it('unregisters a child when it is destroyed', async () => {
    const fixture = TestBed.createComponent(ActiveChildHostComponent);
    await settle(fixture);

    fixture.componentInstance.items.update((items) => items.filter((item) => item.id !== 'b'));
    await settle(fixture);

    const refs = scrollableDirective(fixture).getActiveChildren()();

    expect(refs.map((ref) => ref.elementRef.nativeElement.id)).toEqual(['a', 'c']);
  });

  it('opens the track on the first enabled active child', async () => {
    const fixture = TestBed.createComponent(ActiveChildHostComponent);
    await settle(fixture);

    expect(scrollContainer(fixture).scrollLeft).toBe(ITEM_LEFTS['b']);
  });

  it('skips a disabled marker in favour of the next enabled one', async () => {
    const fixture = TestBed.createComponent(ActiveChildHostComponent);

    fixture.componentInstance.items.set([
      { id: 'a', active: false },
      { id: 'b', active: false },
      { id: 'c', active: true },
    ]);

    await settle(fixture);

    expect(scrollContainer(fixture).scrollLeft).toBe(ITEM_LEFTS['c']);
  });
});
