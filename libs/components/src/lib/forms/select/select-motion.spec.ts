import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { mountSelect, SelectDriver } from '../testing/select-driver';
import { SelectOptionData } from './headless';
import { SELECT_IMPORTS } from './select.imports';

@Component({
  template: `
    <et-select [value]="value()" multiple placeholder="Pick fruits">
      <et-select-option value="apple">Apple</et-select-option>
      <et-select-option value="banana">Banana</et-select-option>
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class MultiSelectHost {
  value = signal<string[]>([]);
}

@Component({
  template: `
    <et-select [value]="value()" [options]="options" (valueChange)="value.set($event)" placeholder="Pick an item">
      <input etSelectSearch placeholder="Search" />
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class VirtualSelectHost {
  value = signal<unknown>(null);
  options: SelectOptionData[] = Array.from({ length: 200 }, (_, index) => ({
    value: 'item-' + (index + 1),
    label: 'Item ' + (index + 1),
  }));
}

type AnimateCall = { element: Element; keyframes: Keyframe[] };

describe('select chip removal', () => {
  const originalAnimate = Element.prototype.animate;
  let calls: AnimateCall[];
  let fixture: ComponentFixture<MultiSelectHost>;

  const render = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    calls = [];
    Element.prototype.animate = function (this: Element, keyframes: Keyframe[] | PropertyIndexedKeyframes | null) {
      calls.push({ element: this, keyframes: keyframes as Keyframe[] });

      return { finished: new Promise(() => undefined), cancel: () => undefined } as unknown as Animation;
    };

    fixture = TestBed.createComponent(MultiSelectHost);
    await render();
  });

  afterEach(() => {
    Element.prototype.animate = originalAnimate;
  });

  it('removes a chip at once, without a fading copy over the chips that take its place', async () => {
    fixture.componentInstance.value.set(['apple', 'banana']);
    await render();

    fixture.componentInstance.value.set(['banana']);
    await render();

    const chips = [...fixture.nativeElement.querySelectorAll('et-chip')] as HTMLElement[];

    expect(chips.map((chip) => chip.textContent?.trim())).toEqual(['Banana']);
  });
});

describe('select field height', () => {
  const originalAnimate = Element.prototype.animate;
  const originalResizeObserver = globalThis.ResizeObserver;
  const originalRect = HTMLElement.prototype.getBoundingClientRect;
  let calls: AnimateCall[];
  let resizeCallbacks: ResizeObserverCallback[];
  let triggerHeight: number;

  beforeEach(() => {
    calls = [];
    resizeCallbacks = [];
    triggerHeight = 24;

    Element.prototype.animate = function (this: Element, keyframes: Keyframe[] | PropertyIndexedKeyframes | null) {
      calls.push({ element: this, keyframes: keyframes as Keyframe[] });

      return { finished: new Promise(() => undefined), cancel: () => undefined } as unknown as Animation;
    };

    globalThis.ResizeObserver = class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallbacks.push(callback);
      }

      observe() {
        return undefined;
      }

      unobserve() {
        return undefined;
      }

      disconnect() {
        return undefined;
      }
    } as unknown as typeof ResizeObserver;

    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const height = this.classList.contains('et-select-trigger') ? triggerHeight : 0;

      return new DOMRect(0, 0, 300, height);
    };
  });

  afterEach(() => {
    Element.prototype.animate = originalAnimate;
    globalThis.ResizeObserver = originalResizeObserver;
    HTMLElement.prototype.getBoundingClientRect = originalRect;
  });

  it('changes the field height at once when a chip wraps to a new line', async () => {
    const fixture = TestBed.createComponent(MultiSelectHost);

    fixture.detectChanges();
    await fixture.whenStable();

    triggerHeight = 51;

    for (const callback of resizeCallbacks) callback([], {} as ResizeObserver);

    const trigger = fixture.nativeElement.querySelector('.et-select-trigger');

    expect(calls.some((call) => call.element === trigger)).toBe(false);
  });
});

describe('select virtual row motion', () => {
  const originalAnimate = Element.prototype.animate;
  let calls: AnimateCall[];
  let driver: SelectDriver<VirtualSelectHost>;

  const rowCalls = () => calls.filter((call) => call.element.classList.contains('et-select-option'));

  beforeEach(async () => {
    calls = [];
    Element.prototype.animate = function (this: Element, keyframes: Keyframe[] | PropertyIndexedKeyframes | null) {
      calls.push({ element: this, keyframes: keyframes as Keyframe[] });

      return { finished: new Promise(() => undefined), cancel: () => undefined } as unknown as Animation;
    };

    driver = mountSelect(VirtualSelectHost);
    await driver.open();
    await driver.fixture.whenStable();
  });

  afterEach(async () => {
    await driver.close();
    Element.prototype.animate = originalAnimate;
  });

  it('fades rows when the filter changes', async () => {
    driver.type('item 19');
    await driver.fixture.whenStable();

    expect(rowCalls().length).toBeGreaterThan(0);
  });

  it('does not fade rows the window renders on a scroll step', async () => {
    driver.select.handleTriggerKeydown(new KeyboardEvent('keydown', { key: 'End' }));
    driver.tick();
    await driver.fixture.whenStable();

    expect(driver.options().at(-1)?.textContent).toContain('Item 200');
    expect(rowCalls()).toEqual([]);
  });
});

@Component({
  template: `
    <et-select multiple placeholder="Pick fruits">
      <input [style.font-size.px]="10" etSelectSearch placeholder="Search fruits" />
      <et-select-option value="apple">Apple</et-select-option>
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class SearchableMultiSelectHost {}

describe('select search placeholder width', () => {
  const originalRect = HTMLElement.prototype.getBoundingClientRect;

  beforeEach(() => {
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      const width = this.tagName === 'SPAN' && this.textContent === 'Search fruits' ? 79 : 0;

      return new DOMRect(0, 0, width, 0);
    };
  });

  afterEach(() => {
    HTMLElement.prototype.getBoundingClientRect = originalRect;
  });

  it('keeps the search input at least as wide as its placeholder, so it wraps instead of clipping it', async () => {
    const fixture = TestBed.createComponent(SearchableMultiSelectHost);

    fixture.detectChanges();
    await fixture.whenStable();

    const input = fixture.nativeElement.querySelector('input[etSelectSearch]') as HTMLInputElement;

    expect(input.style.getPropertyValue('--_et-select-search-placeholder-width')).toBe('8.1em');
  });
});
